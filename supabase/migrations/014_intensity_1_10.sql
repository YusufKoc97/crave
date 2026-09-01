-- 014_intensity_1_10.sql
--
-- Widen the craving intensity scale from 1–5 to 1–10 so the stored
-- value matches the UI dial. The client previously halved on write
-- (ceil(v/2)) to satisfy the old CHECK from migration 003; that shim is
-- removed in the same change (app/active-session.tsx), and both Edge
-- Functions (resolve-craving validation, trigger-map-data label
-- bucketing) now speak 1–10.
--
-- Existing rows were stored on the old 1–5 scale, so double them to land
-- on the same 1–10 scale. This is an approximation — the original 1–10
-- pick was lossy-halved and can't be recovered exactly — but it keeps
-- averages and label buckets on one consistent scale. Pre-launch data
-- only; no production users yet.

alter table public.craving_sessions
  drop constraint if exists craving_sessions_intensity_check;

update public.craving_sessions
  set intensity = intensity * 2
  where intensity is not null
    and intensity <= 5;

alter table public.craving_sessions
  add constraint craving_sessions_intensity_check
  check (intensity is null or intensity between 1 and 10);
