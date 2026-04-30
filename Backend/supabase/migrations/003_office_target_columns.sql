-- Add office target fields with backward-compatible backfill.
ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS office_days_target INTEGER DEFAULT 0;

ALTER TABLE public.user_profiles
ADD COLUMN IF NOT EXISTS office_target_period TEXT DEFAULT 'week'
CHECK (office_target_period IN ('week', 'month'));

-- Backfill from legacy fields where available.
UPDATE public.user_profiles
SET office_days_target = COALESCE(wfh_days, office_days_target, 0)
WHERE office_days_target IS NULL OR office_days_target = 0;

UPDATE public.user_profiles
SET office_target_period = COALESCE(wfh_period, office_target_period, 'week')
WHERE office_target_period IS NULL;
