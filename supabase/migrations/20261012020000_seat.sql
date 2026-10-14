-- Camera mode: an empty seat is its own kind of off-track time.
alter table public.entries drop constraint if exists entries_off_reason_check;
alter table public.entries add constraint entries_off_reason_check check (off_reason in ('pit', 'away', 'seat'));
