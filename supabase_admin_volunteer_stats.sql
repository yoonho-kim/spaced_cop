-- ============================================
-- 관리자용 봉사활동 통계 및 관리 기능을 위한 스키마 변경
-- ============================================

-- ============================================
-- 1. volunteer_registrations 테이블 컬럼 추가
-- ============================================

-- 인정 시간 (시간 단위) 컬럼 추가
-- 관리자가 참가자별로 봉사활동 인정 시간을 설정할 수 있도록 함
ALTER TABLE volunteer_registrations 
ADD COLUMN IF NOT EXISTS recognized_hours DECIMAL(5,2) DEFAULT 0;

COMMENT ON COLUMN volunteer_registrations.recognized_hours IS '봉사활동 인정 시간 (시간 단위, 예: 2.5 = 2시간 30분)';

-- 참가자 성명 컬럼 추가 (사번과 함께 사용)
-- 통계에서 성명 표시를 위해 필요
ALTER TABLE volunteer_registrations 
ADD COLUMN IF NOT EXISTS employee_name VARCHAR(100);

COMMENT ON COLUMN volunteer_registrations.employee_name IS '참가자 성명';

-- updated_at 컬럼 추가 (수정 이력 관리)
ALTER TABLE volunteer_registrations 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- updated_at 자동 업데이트 트리거
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_volunteer_registrations_updated_at ON volunteer_registrations;
CREATE TRIGGER update_volunteer_registrations_updated_at
    BEFORE UPDATE ON volunteer_registrations
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();


-- ============================================
-- 2. volunteer_activities 테이블 컬럼 추가
-- ============================================

-- 인정 시간 기본값 (활동별 기본 인정 시간)
ALTER TABLE volunteer_activities 
ADD COLUMN IF NOT EXISTS default_hours DECIMAL(5,2) DEFAULT 0;

COMMENT ON COLUMN volunteer_activities.default_hours IS '해당 봉사활동의 기본 인정 시간';


-- ============================================
-- 3. 통계용 인덱스 추가 (조회 성능 최적화)
-- ============================================

-- 월별 통계 조회를 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_volunteer_registrations_created_at 
ON volunteer_registrations(created_at);

-- 사번별 조회를 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_volunteer_registrations_employee_id 
ON volunteer_registrations(employee_id);

-- 활동별 참가자 조회를 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_volunteer_registrations_activity_id 
ON volunteer_registrations(activity_id);

-- 상태별 조회를 위한 인덱스
CREATE INDEX IF NOT EXISTS idx_volunteer_registrations_status 
ON volunteer_registrations(status);


-- ============================================
-- 4. 유용한 뷰 생성 (선택사항)
-- ============================================

-- 사용자별 봉사 통계 뷰
CREATE OR REPLACE VIEW v_volunteer_user_stats AS
SELECT 
    vr.employee_id,
    vr.employee_name,
    COUNT(*) as total_participations,
    SUM(vr.recognized_hours) as total_hours,
    STRING_AGG(DISTINCT va.title, ', ' ORDER BY va.title) as activity_list
FROM volunteer_registrations vr
LEFT JOIN volunteer_activities va ON vr.activity_id = va.id
WHERE vr.status = 'confirmed'
GROUP BY vr.employee_id, vr.employee_name
ORDER BY total_hours DESC;

-- 봉사활동별 통계 뷰
CREATE OR REPLACE VIEW v_volunteer_activity_stats AS
SELECT 
    va.id,
    va.title,
    va.date,
    va.max_participants,
    COUNT(vr.id) as participant_count,
    CASE 
        WHEN va.max_participants > 0 
        THEN ROUND((COUNT(vr.id)::DECIMAL / va.max_participants * 100), 1)
        ELSE 0 
    END as fill_rate
FROM volunteer_activities va
LEFT JOIN volunteer_registrations vr ON va.id = vr.activity_id AND vr.status = 'confirmed'
GROUP BY va.id, va.title, va.date, va.max_participants
ORDER BY participant_count DESC;

-- 월별 참여 통계 뷰
CREATE OR REPLACE VIEW v_volunteer_monthly_stats AS
SELECT 
    DATE_TRUNC('month', vr.created_at) as month,
    COUNT(*) as participant_count,
    COUNT(DISTINCT vr.employee_id) as unique_participants,
    SUM(vr.recognized_hours) as total_hours
FROM volunteer_registrations vr
WHERE vr.status = 'confirmed'
GROUP BY DATE_TRUNC('month', vr.created_at)
ORDER BY month DESC;
