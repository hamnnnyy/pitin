-- Shared result links use a random id instead of the sequential entry id, so links can't be guessed.
-- No policies: only the security-definer functions below read or write this table.
create table public.shares (
  id uuid primary key default gen_random_uuid(),
  entry_id bigint not null unique references public.entries on delete cascade
);
alter table public.shares enable row level security;

-- The share id for one of my finished races, created on first ask.
create function public.share_link(p_entry bigint) returns uuid
language plpgsql security definer set search_path = public as $$
declare s uuid;
begin
  if not exists (select 1 from entries where id = p_entry and user_id = auth.uid() and ended_at is not null) then
    return null;
  end if;
  insert into shares (entry_id) values (p_entry) on conflict (entry_id) do nothing;
  select id into s from shares where entry_id = p_entry;
  return s;
end $$;

revoke all on function public.share_link(bigint) from public;
grant execute on function public.share_link(bigint) to authenticated;

drop function public.result_card(bigint);
create function public.result_card(p_share uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'entry', jsonb_build_object(
      'id', e.id, 'kind', e.kind, 'division', e.division, 'classified', e.classified, 'race_at', e.race_at,
      'name', e.name, 'started_at', e.started_at, 'duration', e.duration, 'off_total', e.off_total,
      'offs', e.offs, 'ended_at', e.ended_at, 'retired', e.retired, 'final_pos', e.final_pos,
      'final_ratio', e.final_ratio, 'focus_sec', e.focus_sec, 'lp', e.lp),
    'grid', case when e.kind = 'gp' then (
      select jsonb_agg(jsonb_build_object(
        'id', g.id, 'started_at', g.started_at, 'duration', g.duration, 'off_since', g.off_since,
        'off_reason', g.off_reason, 'off_total', g.off_total, 'ended_at', g.ended_at, 'retired', g.retired))
      from entries g where g.race_at = e.race_at and g.division = e.division and g.kind = 'gp'
    ) end)
  from shares s join entries e on e.id = s.entry_id
  where s.id = p_share and e.ended_at is not null;
$$;

revoke all on function public.result_card(uuid) from public;
grant execute on function public.result_card(uuid) to anon, authenticated;
