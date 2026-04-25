-- Create attendance_logs table
CREATE TABLE public.attendance_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) NOT NULL,
    date DATE NOT NULL, -- Ensure one entry per day per user
    check_in TIMESTAMPTZ,
    check_out TIMESTAMPTZ,
    status TEXT CHECK (status IN ('present', 'wfh', 'leave', 'holiday', 'absent')),
    location_check_in JSONB, -- Stores { lat, lng, address }
    duration_minutes INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, date)
);

-- Enable Row Level Security
ALTER TABLE public.attendance_logs ENABLE ROW LEVEL SECURITY;

-- Policies
-- 1. Users can view their own logs
CREATE POLICY "Users can view own logs" ON public.attendance_logs
    FOR SELECT USING (auth.uid() = user_id);

-- 2. Users can insert their own logs
CREATE POLICY "Users can insert own logs" ON public.attendance_logs
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 3. Users can update their own logs (for check-out)
CREATE POLICY "Users can update own logs" ON public.attendance_logs
    FOR UPDATE USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_attendance_user_date ON public.attendance_logs(user_id, date);

-- SAMPLE DATA (Run this in Supabase SQL Editor to seed data for the current user)
-- Replace 'YOUR_USER_ID_HERE' with your actual User ID from Authentication > Users
/*
INSERT INTO public.attendance_logs (user_id, date, check_in, check_out, status, location_check_in, duration_minutes)
VALUES 
(auth.uid(), CURRENT_DATE, NOW() - INTERVAL '4 hours', NULL, 'present', '{"address": "Bangalore Hub"}', 0),
(auth.uid(), CURRENT_DATE - 1, NOW() - INTERVAL '1 day' - INTERVAL '9 hours', NOW() - INTERVAL '1 day', 'wfh', '{"address": "Home"}', 540),
(auth.uid(), CURRENT_DATE - 2, NOW() - INTERVAL '2 days' - INTERVAL '9 hours', NOW() - INTERVAL '2 days', 'present', '{"address": "Bangalore Hub"}', 540),
(auth.uid(), CURRENT_DATE - 3, NULL, NULL, 'leave', '{"address": "Home"}', 0),
(auth.uid(), CURRENT_DATE - 4, NOW() - INTERVAL '4 days' - INTERVAL '9 hours', NOW() - INTERVAL '4 days', 'present', '{"address": "Bangalore Hub"}', 540);
*/
