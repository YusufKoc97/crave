-- 010: allow the ride_the_wave technique through the technique_id CHECK.
--
-- Migration 009 (abuse lockdown) pinned technique_uses.technique_id to
-- the four MVP techniques. The new "Ride the Wave" exercise (Nicotine
-- pilot on the ExerciseRunner foundation) writes
-- technique_id = 'ride_the_wave'; without widening the CHECK, that
-- INSERT trips technique_uses_technique_id_check (23514) and the use
-- goes unrecorded — so the exercise runs but never counts toward the
-- toolkit stats.
--
-- No schema change: same column, same shape — only the allowed value
-- set grows by one.

alter table technique_uses
  drop constraint if exists technique_uses_technique_id_check;

alter table technique_uses
  add constraint technique_uses_technique_id_check
  check (
    technique_id in (
      'breathing_478',
      'urge_surfing',
      'grounding_54321',
      'body_scan',
      'ride_the_wave'
    )
  );

-- Verify the constraint is present after the swap.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'technique_uses_technique_id_check'
  ) then
    raise exception 'technique_uses_technique_id_check missing after 010';
  end if;
  raise notice '010 ok: ride_the_wave now permitted on technique_uses.technique_id';
end $$;
