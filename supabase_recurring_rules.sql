-- ============================================
-- Space D - 회의실 반복 예약 규칙 테이블 생성 SQL
-- ============================================
-- 이 SQL을 Supabase 대시보드 > SQL Editor에서 실행하세요

-- 1. 반복 예약 규칙 테이블 생성
CREATE TABLE IF NOT EXISTS public.meeting_recurring_rules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID REFERENCES meeting_rooms(id) ON DELETE CASCADE,
    room_name TEXT NOT NULL,
    rule_type TEXT NOT NULL, -- 'weekly', 'monthly'
    day_of_week INTEGER NOT NULL, -- 0 (Sun) to 6 (Sat)
    week_of_month INTEGER, -- 1 to 5 (for monthly), null for weekly
    start_time TEXT NOT NULL, -- 'HH:mm'
    end_time TEXT NOT NULL, -- 'HH:mm'
    department TEXT NOT NULL,
    purpose TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. 기존 예약 테이블에 규칙 ID 컬럼 추가 (연동 삭제를 위해)
ALTER TABLE public.meeting_reservations 
ADD COLUMN IF NOT EXISTS recurring_rule_id UUID REFERENCES meeting_recurring_rules(id) ON DELETE CASCADE;

-- RLS 정책 설정
ALTER TABLE public.meeting_recurring_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read for everyone" ON public.meeting_recurring_rules FOR SELECT USING (true);
CREATE POLICY "Enable all for everyone" ON public.meeting_recurring_rules FOR ALL USING (true) WITH CHECK (true);
