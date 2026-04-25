-- Team support for OfficeOrbit

CREATE TABLE IF NOT EXISTS public.teams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.team_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    user_id UUID NOT NULL UNIQUE REFERENCES public.user_profiles(id) ON DELETE CASCADE,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_team_members_team_id ON public.team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user_id ON public.team_members(user_id);

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can create teams"
    ON public.teams FOR INSERT
    TO authenticated
    WITH CHECK (true);

CREATE POLICY "Team members can view their teams"
    ON public.teams FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.team_members tm
            WHERE tm.team_id = teams.id
              AND tm.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can insert own team membership"
    ON public.team_members FOR INSERT
    TO authenticated
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can view members in their own team"
    ON public.team_members FOR SELECT
    TO authenticated
    USING (
        EXISTS (
            SELECT 1
            FROM public.team_members my_tm
            WHERE my_tm.team_id = team_members.team_id
              AND my_tm.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete own team membership"
    ON public.team_members FOR DELETE
    TO authenticated
    USING (user_id = auth.uid());
