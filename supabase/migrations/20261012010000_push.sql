-- Web push: one row per browser that turned notifications on.
create table public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null default auth.uid() references auth.users on delete cascade,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);
alter table public.push_subscriptions enable row level security;
create policy "own subscriptions" on public.push_subscriptions for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Grand prix hours (KST, 0-23) a player wants a reminder for, 5 minutes before lights out.
alter table public.profiles add column remind_hours smallint[] not null default '{}'
  check (0 <= all(remind_hours) and 23 >= all(remind_hours));

-- Check-ins: last time the player confirmed they were studying, and the last question we pushed.
alter table public.entries add column checked_at bigint, add column asked_at bigint;

-- Same rule as src/lib/race.ts: ask 20 min after the last check-in, answer within 5 min.
-- Marks each question as sent, so a retried tick does not push it twice.
create function public.due_checkins(now_ms bigint) returns table (user_id uuid, due bigint)
language sql as $$
  update public.entries e set asked_at = coalesce(e.checked_at, e.started_at) + 1200000
  where e.ended_at is null and e.off_since is null
    and coalesce(e.checked_at, e.started_at) + 1200000 <= now_ms
    and coalesce(e.checked_at, e.started_at) + 1500000 > now_ms
    and coalesce(e.checked_at, e.started_at) + 1200000 < e.started_at + e.duration * 1000
    and e.asked_at is distinct from coalesce(e.checked_at, e.started_at) + 1200000
  returning e.user_id, e.asked_at
$$;

-- Players who asked to be reminded about the grand prix at `slot` and have not joined it yet.
create function public.due_reminders(slot bigint) returns table (user_id uuid)
language sql stable as $$
  select p.id from public.profiles p
  where extract(hour from to_timestamp(slot / 1000) at time zone 'Asia/Seoul')::smallint = any(p.remind_hours)
    and not exists (select 1 from public.entries e where e.race_at = slot and e.user_id = p.id)
$$;

revoke execute on function public.due_checkins(bigint), public.due_reminders(bigint) from public, anon, authenticated;

-- Every minute, wake the push-tick edge function. Its shared secret lives in Vault, not in this file.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.schedule('push-tick', '* * * * *', $$
  select net.http_post(
    url := 'https://lveprnchpppawhhchijj.supabase.co/functions/v1/push-tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'push_tick_secret')
    ),
    body := '{}'::jsonb
  )
$$);
