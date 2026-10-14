-- "A player you follow just took a grid spot": one push per follower per grand prix.
alter table public.profiles add column friend_alerts boolean not null default true;

alter table public.entries add column joined_at timestamptz not null default now();
update public.entries set joined_at = to_timestamp(started_at / 1000.0); -- existing rows are not news

create table public.friend_alerts (
  user_id uuid not null references public.profiles on delete cascade,
  race_at bigint not null,
  primary key (user_id, race_at)
);
alter table public.friend_alerts enable row level security; -- no policies: only push-tick (service role) uses it

-- Followers to tell, each once per grand prix, while the grid is still open for them to join.
create function public.due_friend_alerts(now_ms bigint) returns table (user_id uuid, race_at bigint, friend_id uuid, friend text)
language sql volatile as $$
  with fresh as (
    select e.user_id, e.race_at, e.name from public.entries e
    where e.kind = 'gp' and e.joined_at > now() - interval '3 minutes' and e.race_at + 15 * 60000 > now_ms
  ), cand as (
    select distinct on (f.follower, fr.race_at) f.follower, fr.race_at, fr.user_id as friend_id, fr.name as friend
    from fresh fr
    join public.follows f on f.followee = fr.user_id
    join public.profiles p on p.id = f.follower and p.friend_alerts
    where not exists (select 1 from public.entries x where x.race_at = fr.race_at and x.user_id = f.follower)
    order by f.follower, fr.race_at, fr.name
  ), ins as (
    insert into public.friend_alerts (user_id, race_at)
    select follower, race_at from cand
    on conflict do nothing
    returning friend_alerts.user_id, friend_alerts.race_at
  )
  select c.follower, c.race_at, c.friend_id, c.friend from cand c
  join ins on ins.user_id = c.follower and ins.race_at = c.race_at;
$$;

revoke execute on function public.due_friend_alerts(bigint) from public, anon, authenticated;
