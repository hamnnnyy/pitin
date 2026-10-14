-- Divisions persist across seasons; promotion and relegation happen when a month closes.
alter table public.profiles
  add column division text not null default 'F3' check (division in ('F1', 'F2', 'F3')),
  add column daily_goal int not null default 180 check (daily_goal between 10 and 960); -- minutes a day

-- Practice runs are logged too (they count toward the study log, never toward LP).
-- Grand prix entries race on their division's grid; classified once the slot's final result is written.
alter table public.entries
  add column kind text not null default 'gp' check (kind in ('gp', 'practice')),
  add column division text not null default 'F3' check (division in ('F1', 'F2', 'F3')),
  add column classified boolean not null default false;
create index entries_unclassified on public.entries (race_at) where not classified and kind = 'gp';

-- Season standings count grand prix only, per division.
drop view public.season_standings;
create view public.season_standings with (security_invoker = true) as
select p.id as user_id, p.name, p.avatar_url, p.division,
  coalesce(sum(e.lp), 0)::int as lp,
  count(e.id) filter (where e.ended_at is not null)::int as races,
  coalesce(sum(e.focus_sec), 0)::real as focus_sec
from public.profiles p
left join public.entries e on e.user_id = p.id and e.kind = 'gp'
  and e.race_at >= extract(epoch from date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul') * 1000
group by p.id;

-- One row per player per closed season.
create table public.season_results (
  season text not null,          -- 'YYYY-MM', KST
  user_id uuid not null references public.profiles on delete cascade,
  division text not null,
  lp int not null,
  rank int not null,             -- within the division
  next_division text not null,
  primary key (season, user_id)
);
alter table public.season_results enable row level security;
create policy "season results readable" on public.season_results for select to authenticated using (true);

-- Closes last month: records results and moves players. Same thresholds as src/lib/race.ts
-- (promote at 100 LP, relegate under 20). Safe to run repeatedly: only newly recorded rows move anyone.
create function public.close_season() returns void language sql as $$
  with bounds as (
    select date_trunc('month', now() at time zone 'Asia/Seoul') - interval '1 month' as s,
           date_trunc('month', now() at time zone 'Asia/Seoul') as e
  ), totals as (
    select p.id, p.division, coalesce(sum(en.lp), 0)::int as lp, coalesce(sum(en.focus_sec), 0) as focus,
      count(en.id) as races
    from public.profiles p
    left join public.entries en on en.user_id = p.id and en.kind = 'gp'
      and en.race_at >= extract(epoch from (select s from bounds) at time zone 'Asia/Seoul') * 1000
      and en.race_at < extract(epoch from (select e from bounds) at time zone 'Asia/Seoul') * 1000
    group by p.id
  ), recorded as (
    insert into public.season_results (season, user_id, division, lp, rank, next_division)
    select to_char((select s from bounds), 'YYYY-MM'), id, division, lp,
      rank() over (partition by division order by lp desc, focus desc),
      case
        when lp >= 100 and division = 'F3' then 'F2'
        when lp >= 100 and division = 'F2' then 'F1'
        when lp < 20 and division = 'F1' then 'F2'
        when lp < 20 and division = 'F2' then 'F3'
        else division
      end
    from totals where races > 0 or division <> 'F3'
    on conflict do nothing
    returning user_id, next_division
  )
  update public.profiles p set division = r.next_division from recorded r where p.id = r.user_id
$$;
revoke execute on function public.close_season() from public, anon, authenticated;
select cron.schedule('close-season', '5 * * * *', 'select public.close_season()');

-- Following other players.
create table public.follows (
  follower uuid not null default auth.uid() references public.profiles on delete cascade,
  followee uuid not null references public.profiles on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower, followee),
  check (follower <> followee)
);
alter table public.follows enable row level security;
create policy "follows readable" on public.follows for select to authenticated using (true);
create policy "own follows insert" on public.follows for insert to authenticated with check (follower = auth.uid());
create policy "own follows delete" on public.follows for delete to authenticated using (follower = auth.uid());
