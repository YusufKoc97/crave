-- 011: allow the fake_feed technique through the technique_id CHECK.
--
-- Same shape as 010. The CHECK added by 009 pins technique_uses.
-- technique_id to a known set; the new "Fake Feed" exercise
-- (doomscrolling-only finite feed) writes technique_id = 'fake_feed',
-- and without widening the set that INSERT trips
-- technique_uses_technique_id_check (23514). The exercise would still
-- run end to end — the failure is silent — but the use would never be
-- recorded, so it would never count toward toolkit stats.
--
-- No schema change: same column, same shape, the allowed value set
-- grows by one.

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
      'ride_the_wave',
      'fake_feed'
    )
  );

-- Verify the constraint is present after the swap.
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'technique_uses_technique_id_check'
  ) then
    raise exception 'technique_uses_technique_id_check missing after 011';
  end if;
  raise notice '011 ok: fake_feed now permitted on technique_uses.technique_id';
end $$;
