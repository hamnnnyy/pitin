-- The server keeps the race clock. Players can no longer write entries directly: they ask for an action
-- (join, pit, seat, resume, check in, finish, retire) and the server stamps it with its own time.
-- Every rule here mirrors src/lib/race.ts (apply, settle, finish); scripts/check-race.mts covers that side.

alter table public.entries add column offs jsonb not null default '[]'; -- [[since, until, reason], ...]

drop policy "own entry insert" on public.entries;
drop policy "own entry update" on public.entries;

create function public.now_ms() returns bigint language sql stable as $$
  select (extract(epoch from clock_timestamp()) * 1000)::bigint
$$;

-- A check-in left unanswered 5 min after it was asked (20 min after the last one) is a pit stop from the question.
create function public.settle_row(e public.entries, at bigint) returns public.entries language plpgsql as $$
declare due bigint := coalesce(e.checked_at, e.started_at) + 1200000;
begin
  if e.off_since is null and e.ended_at is null and at >= due + 300000 and due < e.started_at + e.duration * 1000 then
    e.off_since := due;
    e.off_reason := 'away';
  end if;
  return e;
end $$;

create function public.close_off(e public.entries, at bigint) returns public.entries language plpgsql as $$
declare s bigint;
begin
  if e.off_since is null then return e; end if;
  s := greatest(e.off_since, e.started_at);
  e.off_total := e.off_total + greatest(0, at - s);
  e.offs := e.offs || jsonb_build_array(jsonb_build_array(s, at, e.off_reason));
  e.off_since := null;
  e.off_reason := null;
  e.checked_at := at;
  return e;
end $$;

create function public.finish_row(e public.entries, at bigint, quit boolean) returns public.entries language plpgsql as $$
begin
  at := least(at, e.started_at + e.duration * 1000);
  e := public.close_off(e, at);
  e.ended_at := at;
  e.retired := quit;
  e.focus_sec := greatest(0, (at - e.started_at - e.off_total) / 1000.0);
  e.final_ratio := case when at - e.started_at < 1000 then 1 else least(1, e.focus_sec * 1000 / (at - e.started_at)) end;
  return e;
end $$;

create function public.save_row(e public.entries) returns public.entries language sql as $$
  update public.entries set off_since = e.off_since, off_reason = e.off_reason, off_total = e.off_total, offs = e.offs,
    checked_at = e.checked_at, ended_at = e.ended_at, retired = e.retired, focus_sec = e.focus_sec, final_ratio = e.final_ratio
  where id = e.id
  returning *
$$;

-- Grand prix: a 30-min slot that is open (up to 15 min after lights out). Practice: starts in 5 s, 25 min long.
create function public.join_race(p_race_at bigint, p_kind text, p_duration int) returns public.entries
language plpgsql security definer set search_path = public as $$
declare
  t bigint := public.now_ms();
  p public.profiles;
  e public.entries;
begin
  select * into p from public.profiles where id = auth.uid();
  if not found then raise exception 'no profile'; end if;
  if p_kind = 'gp' then
    if p_duration not in (1800, 3600, 5400, 7200) then raise exception 'bad duration'; end if;
    if p_race_at % 1800000 <> 0 or t >= p_race_at + 900000 or p_race_at > t + 1800000 then raise exception 'grid closed'; end if;
    insert into public.entries (race_at, user_id, name, kind, division, started_at, duration)
    values (p_race_at, p.id, p.name, 'gp', p.division, greatest(p_race_at, t + 5000), p_duration)
    returning * into e;
  elsif p_kind = 'practice' then
    if p_duration <> 1500 then raise exception 'bad duration'; end if;
    insert into public.entries (race_at, user_id, name, kind, division, started_at, duration)
    values (t + 5000, p.id, p.name, 'practice', p.division, t + 5000, p_duration)
    returning * into e;
  else
    raise exception 'bad kind';
  end if;
  return e;
end $$;

create function public.race_action(p_race_at bigint, p_action text, p_since bigint default null) returns public.entries
language plpgsql security definer set search_path = public as $$
declare
  t bigint := public.now_ms();
  e public.entries;
begin
  select * into e from public.entries where race_at = p_race_at and user_id = auth.uid() for update;
  if not found then raise exception 'no race'; end if;
  if e.ended_at is not null or t < e.started_at then return e; end if;
  e := public.settle_row(e, t);
  if t >= e.started_at + e.duration * 1000 and p_action <> 'retire' then p_action := 'finish'; end if;
  case p_action
    when 'pit' then
      if e.off_since is null then e.off_since := t; e.off_reason := 'pit'; end if;
    when 'seat' then -- the camera saw an empty seat since p_since; never earlier than the last check-in or comeback
      if e.off_since is null then
        e.off_since := least(t, greatest(coalesce(p_since, t), coalesce(e.checked_at, e.started_at)));
        e.off_reason := 'seat';
      end if;
    when 'resume' then e := public.close_off(e, t);
    when 'checkin' then if e.off_since is null then e.checked_at := t; end if;
    when 'finish' then e := public.finish_row(e, t, false);
    when 'retire' then e := public.finish_row(e, t, true);
    else raise exception 'bad action';
  end case;
  return public.save_row(e);
end $$;

-- Every minute: missed check-ins go to the pit for everyone watching, and races nobody closed are closed at their end.
create function public.settle_all() returns void language plpgsql as $$
declare
  t bigint := public.now_ms();
  e public.entries;
  s public.entries;
begin
  for e in select * from public.entries where ended_at is null and started_at <= t loop
    s := case when t >= e.started_at + e.duration * 1000 then public.finish_row(public.settle_row(e, t), t, false)
              else public.settle_row(e, t) end;
    if s is distinct from e then perform public.save_row(s); end if;
  end loop;
end $$;

revoke execute on function public.settle_row(public.entries, bigint), public.close_off(public.entries, bigint),
  public.finish_row(public.entries, bigint, boolean), public.save_row(public.entries), public.settle_all()
  from public, anon, authenticated;
grant execute on function public.join_race(bigint, text, int), public.race_action(bigint, text, bigint) to authenticated;
revoke execute on function public.join_race(bigint, text, int), public.race_action(bigint, text, bigint) from anon;

select cron.schedule('settle-races', '* * * * *', 'select public.settle_all()');
