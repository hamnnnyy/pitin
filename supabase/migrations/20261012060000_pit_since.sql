-- A pit stop sent late (the device was offline) keeps the time the player pressed it. Like a seat stop it can
-- only be dated back, never before the last check-in or comeback, so it can only take focus time away.
create or replace function public.race_action(p_race_at bigint, p_action text, p_since bigint default null) returns public.entries
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
    when 'pit', 'seat' then
      if e.off_since is null then
        e.off_since := least(t, greatest(coalesce(p_since, t), coalesce(e.checked_at, e.started_at)));
        e.off_reason := p_action;
      end if;
    when 'resume' then e := public.close_off(e, t);
    when 'checkin' then if e.off_since is null then e.checked_at := t; end if;
    when 'finish' then e := public.finish_row(e, t, false);
    when 'retire' then e := public.finish_row(e, t, true);
    else raise exception 'bad action';
  end case;
  return public.save_row(e);
end $$;
