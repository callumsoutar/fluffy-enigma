-- Refit flight_experience to support mixed units (hours/count/landings)
-- Keeps the normalized table for clean reporting while matching instructor workflow.

begin;

-- 1) Units enum (idempotent)
do $$
begin
  if not exists (select 1 from pg_type where typname = 'experience_unit') then
    create type public.experience_unit as enum ('hours', 'count', 'landings');
  end if;
end
$$;

-- 2) Rename duration_hours -> value (idempotent)
do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'flight_experience'
      and column_name = 'duration_hours'
  ) and not exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'flight_experience'
      and column_name = 'value'
  ) then
    alter table public.flight_experience rename column duration_hours to value;
  end if;
end
$$;

-- 3) Add unit + occurred_at
alter table public.flight_experience
  add column if not exists unit public.experience_unit not null default 'hours',
  add column if not exists occurred_at timestamptz;

-- 4) Backfill occurred_at (prefer booking start_time)
update public.flight_experience fe
set occurred_at = b.start_time
from public.bookings b
where b.id = fe.booking_id
  and fe.occurred_at is null;

-- Fallback for any rows that couldn't be backfilled (defensive)
update public.flight_experience
set occurred_at = now()
where occurred_at is null;

alter table public.flight_experience
  alter column occurred_at set not null;

-- 5) Replace old check constraint with a unit-aware constraint
alter table public.flight_experience
  drop constraint if exists flight_experience_duration_hours_check,
  drop constraint if exists flight_experience_value_check;

alter table public.flight_experience
  add constraint flight_experience_value_check
  check (
    value > 0
    and (
      unit = 'hours'
      or value = trunc(value)
    )
  );

-- 6) Upsert-friendly uniqueness (one entry per booking per experience type)
create unique index if not exists ux_flight_experience_booking_experience_type
  on public.flight_experience (booking_id, experience_type_id);

-- 7) Reporting indexes
create index if not exists idx_flight_experience_user_type_occurred
  on public.flight_experience (user_id, experience_type_id, occurred_at desc);

create index if not exists idx_flight_experience_type_occurred
  on public.flight_experience (experience_type_id, occurred_at desc);

commit;


