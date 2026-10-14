-- A finished race, readable by anyone with the link, for the shared result card.
-- Returns the entry plus its grid (timing columns only) so the provisional position can be worked out
-- before the final classification is written.
create function public.result_card(p_id bigint) returns jsonb
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
  from entries e
  where e.id = p_id and e.ended_at is not null;
$$;

revoke all on function public.result_card(bigint) from public;
grant execute on function public.result_card(bigint) to anon, authenticated;
