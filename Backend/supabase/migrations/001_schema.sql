-- =============================================================================
-- OfficeOrbit — Fresh Schema (Drop & Recreate)
-- Run this in Supabase Dashboard → SQL Editor → New Query.
-- WARNING: Drops all existing tables. Use only on preview / fresh DB.
-- =============================================================================

-- Drop everything in reverse dependency order
DROP TABLE IF EXISTS public.billing_events      CASCADE;
DROP TABLE IF EXISTS public.user_entitlements   CASCADE;
DROP TABLE IF EXISTS public.attendance_sessions CASCADE;
DROP TABLE IF EXISTS public.attendance_records  CASCADE;
DROP TABLE IF EXISTS public.team_members        CASCADE;
DROP TABLE IF EXISTS public.teams               CASCADE;
DROP TABLE IF EXISTS public.user_profiles       CASCADE;

DROP FUNCTION IF EXISTS public.recompute_daily_summary CASCADE;
DROP FUNCTION IF EXISTS public.handle_new_user         CASCADE;
DROP TRIGGER IF EXISTS  on_auth_user_created ON auth.users;


-- ─────────────────────────────────────────────────────────────────────────────
-- 1. USER PROFILES
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.user_profiles (
    id                         UUID        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username                   TEXT        NOT NULL,
    email                      TEXT        NOT NULL,
    company                    TEXT,
    company_location           JSONB,                      -- { latitude, longitude, address }
    office_window_start        TIME        DEFAULT '09:00',
    office_window_end          TIME        DEFAULT '18:00',
    minimum_login_time_minutes INTEGER     DEFAULT 480,    -- 8 hours
    office_days_target         INTEGER     DEFAULT 0,
    office_target_period       TEXT        DEFAULT 'week'  CHECK (office_target_period IN ('week', 'month')),
    created_at                 TIMESTAMPTZ DEFAULT NOW(),
    updated_at                 TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile"   ON public.user_profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON public.user_profiles FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.user_profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, username, email)
    VALUES (
        NEW.id,
        COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        NEW.email
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. ATTENDANCE RECORDS  (one row per user per day — derived daily summary)
--    check_in      = MIN(sessions.entered_at)  — first arrival
--    check_out     = MAX(sessions.exited_at)   — last departure
--    total_minutes = SUM(session durations)    — NOT (checkout - checkin)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.attendance_records (
    id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID        NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    date               DATE        NOT NULL DEFAULT CURRENT_DATE,
    check_in           TIMESTAMPTZ,
    check_out          TIMESTAMPTZ,
    status             TEXT        DEFAULT 'absent' CHECK (status IN ('present', 'absent', 'wfh', 'leave', 'holiday')),
    check_in_location  JSONB,
    check_out_location JSONB,
    is_wfh             BOOLEAN     DEFAULT FALSE,
    total_minutes      INTEGER     DEFAULT 0,
    sessions_count     INTEGER     NOT NULL DEFAULT 0,
    is_manual_override BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at         TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own attendance"   ON public.attendance_records FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own attendance" ON public.attendance_records FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own attendance" ON public.attendance_records FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. ATTENDANCE SESSIONS  (one row per geofence enter/exit cycle)
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.attendance_sessions (
    id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id          UUID        NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    date             DATE        NOT NULL,
    entered_at       TIMESTAMPTZ NOT NULL,
    exited_at        TIMESTAMPTZ,            -- NULL = currently inside
    duration_minutes INTEGER,               -- calculated on exit
    source           TEXT        NOT NULL DEFAULT 'geofence' CHECK (source IN ('geofence', 'manual')),
    created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_attendance_sessions_user_date ON public.attendance_sessions (user_id, date);
CREATE INDEX idx_attendance_sessions_open      ON public.attendance_sessions (user_id, date) WHERE exited_at IS NULL;

ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own sessions"   ON public.attendance_sessions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own sessions" ON public.attendance_sessions FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sessions" ON public.attendance_sessions FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. TEAMS
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.teams (
    id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    name       TEXT        NOT NULL,
    code       TEXT        NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE public.team_members (
    id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id   UUID        NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id   UUID        NOT NULL UNIQUE REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(team_id, user_id)
);

CREATE INDEX idx_team_members_team_id ON public.team_members(team_id);
CREATE INDEX idx_team_members_user_id ON public.team_members(user_id);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated users can create teams"     ON public.teams FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Team members can view their teams"        ON public.teams FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.team_members tm WHERE tm.team_id = teams.id AND tm.user_id = auth.uid()));
CREATE POLICY "Users can insert own team membership"     ON public.team_members FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can view members in their own team" ON public.team_members FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM public.team_members my_tm WHERE my_tm.team_id = team_members.team_id AND my_tm.user_id = auth.uid()));
CREATE POLICY "Users can delete own team membership"     ON public.team_members FOR DELETE TO authenticated USING (user_id = auth.uid());


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. HELPER FUNCTION: recompute_daily_summary()
--    present : total >= 50% of minimum_login_time
--    wfh     : total > 0 but below threshold
--    absent  : total = 0
-- ─────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.recompute_daily_summary(
    p_user_id               UUID,
    p_date                  DATE,
    p_minimum_login_minutes INTEGER DEFAULT 480
)
RETURNS TABLE(
    total_minutes  INTEGER,
    status         TEXT,
    first_checkin  TIMESTAMPTZ,
    last_checkout  TIMESTAMPTZ,
    sessions_count INTEGER
)
LANGUAGE plpgsql AS $$
DECLARE
    v_total   INTEGER;
    v_count   INTEGER;
    v_first   TIMESTAMPTZ;
    v_last    TIMESTAMPTZ;
    v_status  TEXT;
    v_thresh  INTEGER;
BEGIN
    SELECT
        COALESCE(SUM(s.duration_minutes), 0),
        COUNT(*),
        MIN(s.entered_at),
        MAX(s.exited_at)
    INTO v_total, v_count, v_first, v_last
    FROM public.attendance_sessions s
    WHERE s.user_id    = p_user_id
      AND s.date       = p_date
      AND s.exited_at IS NOT NULL;

    v_thresh := GREATEST(1, FLOOR(p_minimum_login_minutes * 0.5));

    IF    v_total >= v_thresh THEN v_status := 'present';
    ELSIF v_total  > 0        THEN v_status := 'wfh';
    ELSE                           v_status := 'absent';
    END IF;

    RETURN QUERY SELECT v_total, v_status, v_first, v_last, v_count::INTEGER;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. USER ENTITLEMENTS TABLE
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.user_entitlements (
    id                 UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id            UUID        NOT NULL UNIQUE REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    plan_code          TEXT        NOT NULL CHECK (plan_code IN ('free', 'pro_lifetime', 'auto_lifetime')),
    status             TEXT        NOT NULL CHECK (status IN ('active', 'revoked', 'refunded', 'grace')),
    provider           TEXT        NOT NULL CHECK (provider IN ('razorpay', 'play', 'apple', 'manual')),
    provider_order_id  TEXT,
    provider_payment_id TEXT,
    started_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at         TIMESTAMPTZ, -- NULL for lifetime plans
    is_lifetime        BOOLEAN     NOT NULL DEFAULT FALSE,
    created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for fast user entitlement checks
CREATE INDEX idx_user_entitlements_user_id ON public.user_entitlements(user_id);

-- Enable RLS
ALTER TABLE public.user_entitlements ENABLE ROW LEVEL SECURITY;

-- Select policy: users can view their own active entitlements
CREATE POLICY "Users can view own entitlements" 
    ON public.user_entitlements 
    FOR SELECT 
    USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 7. BILLING EVENTS AUDIT LOG
-- ─────────────────────────────────────────────────────────────────────────────
CREATE TABLE public.billing_events (
    id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id           UUID        REFERENCES auth.users(id) ON DELETE SET NULL,
    provider          TEXT        NOT NULL,
    event_type        TEXT        NOT NULL,
    provider_event_id TEXT        UNIQUE,
    payload           JSONB       NOT NULL,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

-- Select policy: users can view their own billing history
CREATE POLICY "Users can view own billing events" 
    ON public.billing_events 
    FOR SELECT 
    USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- 8. TRIGGERS FOR AUTO-PROVISIONING & DEFAULTS
-- ─────────────────────────────────────────────────────────────────────────────

-- Create trigger function to auto-provision default plans & test accounts
CREATE OR REPLACE FUNCTION public.handle_new_user_entitlement()
RETURNS TRIGGER AS $$
DECLARE
    v_plan TEXT := 'free';
BEGIN
    -- Auto-provisioning by email prefix / suffix for test scenarios
    IF NEW.email LIKE 'test.pro@%' OR NEW.email LIKE 'test.pro+%' OR NEW.email LIKE '%+testpro@%' THEN
        v_plan := 'pro_lifetime';
    ELSIF NEW.email LIKE 'test.auto@%' OR NEW.email LIKE 'test.auto+%' OR NEW.email LIKE '%+testauto@%' THEN
        v_plan := 'auto_lifetime';
    END IF;

    INSERT INTO public.user_entitlements (
        user_id,
        plan_code,
        status,
        provider,
        is_lifetime
    )
    VALUES (
        NEW.id,
        v_plan,
        'active',
        'manual',
        TRUE
    )
    ON CONFLICT (user_id) DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind the trigger to user_profiles insertion
DROP TRIGGER IF EXISTS on_user_profile_created ON public.user_profiles;
CREATE TRIGGER on_user_profile_created
    AFTER INSERT ON public.user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user_entitlement();

-- ─────────────────────────────────────────────────────────────────────────────
-- 9. BACKWARD COMPATIBILITY / INITIALIZATION
-- ─────────────────────────────────────────────────────────────────────────────
-- Auto-insert a 'free' tier entitlement for all pre-existing profiles in the system
INSERT INTO public.user_entitlements (
    user_id,
    plan_code,
    status,
    provider,
    is_lifetime
)
SELECT 
    id, 
    'free', 
    'active', 
    'manual', 
    TRUE
FROM public.user_profiles
ON CONFLICT (user_id) DO NOTHING;
