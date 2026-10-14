-- Players. One row per (anonymous) auth user.
create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null unique check (name ~ '^[a-z0-9._]{2,20}$'),
  goals text[] not null default '{}',
  avatar_url text,
  created_at timestamptz not null default now()
);

-- One row per player per hourly grand prix. Times are epoch ms so the client maths stays plain numbers.
create table public.entries (
  id bigint generated always as identity primary key,
  race_at bigint not null,                -- the hour slot, epoch ms
  user_id uuid not null references public.profiles on delete cascade default auth.uid(),
  name text not null,                     -- denormalised for the live tower
  started_at bigint not null,
  duration int not null check (duration between 600 and 14400), -- seconds, chosen by the player
  off_since bigint,
  off_reason text check (off_reason in ('pit', 'away')),
  off_total bigint not null default 0,
  ended_at bigint,
  retired boolean not null default false,
  final_pos int,
  final_ratio real,
  focus_sec real,
  lp int not null default 0,
  unique (race_at, user_id)
);
create index entries_race_at on public.entries (race_at);
create index entries_user on public.entries (user_id, race_at desc);

alter table public.profiles enable row level security;
alter table public.entries enable row level security;

create policy "profiles readable" on public.profiles for select to authenticated using (true);
create policy "own profile insert" on public.profiles for insert to authenticated with check (id = auth.uid());
create policy "own profile update" on public.profiles for update to authenticated using (id = auth.uid());

create policy "entries readable" on public.entries for select to authenticated using (true);
create policy "own entry insert" on public.entries for insert to authenticated with check (user_id = auth.uid());
-- ponytail: results (pos/ratio/lp) are computed and written by the client; move to an RPC if cheating matters
create policy "own entry update" on public.entries for update to authenticated using (user_id = auth.uid() and ended_at is null) with check (user_id = auth.uid());

-- Season = calendar month (KST). LP and focus totals per player.
create view public.season_standings with (security_invoker = true) as
select p.id as user_id, p.name, p.avatar_url,
  coalesce(sum(e.lp), 0)::int as lp,
  count(e.id) filter (where e.ended_at is not null)::int as races,
  coalesce(sum(e.focus_sec), 0)::real as focus_sec
from public.profiles p
left join public.entries e on e.user_id = p.id
  and e.race_at >= extract(epoch from date_trunc('month', now() at time zone 'Asia/Seoul') at time zone 'Asia/Seoul') * 1000
group by p.id;

alter publication supabase_realtime add table public.entries;

-- Avatars: public read, each user writes only <uid>.* in the bucket root.
insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);
create policy "own avatar write" on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and name like auth.uid()::text || '.%');
create policy "own avatar update" on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and name like auth.uid()::text || '.%');
