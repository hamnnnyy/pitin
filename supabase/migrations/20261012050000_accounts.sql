-- Account management: rename, delete, friend invites, and clean-up of throwaway anonymous sign-ins.

-- Renames a player everywhere their name is shown (entries keep a copy for the live tower).
create function public.rename_player(p_name text) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.profiles set name = p_name where id = auth.uid();
  update public.entries set name = p_name where user_id = auth.uid();
end $$;

-- Deletes the caller's account and everything hanging off it (profiles, entries, follows, push, seasons cascade).
-- The avatar file is removed by the client first, through the storage API.
create function public.delete_account() returns void
language sql security definer set search_path = public as $$
  delete from auth.users where id = auth.uid()
$$;

create policy "own avatar delete" on storage.objects for delete to authenticated
  using (bucket_id = 'avatars' and name like auth.uid()::text || '.%');

-- Invites: a player may race on the grid of the friend who invited them, whatever their own division.
drop function public.join_race(bigint, text, int);
create function public.join_race(p_race_at bigint, p_kind text, p_duration int, p_with uuid default null) returns public.entries
language plpgsql security definer set search_path = public as $$
declare
  t bigint := public.now_ms();
  p public.profiles;
  e public.entries;
  d text;
begin
  select * into p from public.profiles where id = auth.uid();
  if not found then raise exception 'no profile'; end if;
  if p_kind = 'gp' then
    if p_duration not in (1800, 3600, 5400, 7200) then raise exception 'bad duration'; end if;
    if p_race_at % 1800000 <> 0 or t >= p_race_at + 900000 or p_race_at > t + 1800000 then raise exception 'grid closed'; end if;
    d := coalesce((select division from public.profiles where id = p_with), p.division);
    insert into public.entries (race_at, user_id, name, kind, division, started_at, duration)
    values (p_race_at, p.id, p.name, 'gp', d, greatest(p_race_at, t + 5000), p_duration)
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

grant execute on function public.rename_player(text), public.delete_account(), public.join_race(bigint, text, int, uuid) to authenticated;
revoke execute on function public.rename_player(text), public.delete_account(), public.join_race(bigint, text, int, uuid) from public, anon;

-- Anonymous sign-ins that never made a profile (a visit, or a device that then signed in with Google) are dropped after a day.
select cron.schedule('drop-stray-anonymous', '17 * * * *', $$
  delete from auth.users u
  where u.is_anonymous and u.created_at < now() - interval '1 day'
    and not exists (select 1 from public.profiles p where p.id = u.id)
$$);
