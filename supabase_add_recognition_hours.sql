-- 봉사활동 테이블에 인정 시간 컬럼 추가
ALTER TABLE volunteer_activities 
ADD COLUMN recognition_hours NUMERIC DEFAULT 0;

COMMENT ON COLUMN volunteer_activities.recognition_hours IS '봉사활동 인정 시간';
