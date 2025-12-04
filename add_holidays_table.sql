-- 공휴일 테이블 생성
CREATE TABLE IF NOT EXISTS holidays (
    id SERIAL PRIMARY KEY,
    holiday_date DATE NOT NULL UNIQUE,
    holiday_name TEXT NOT NULL,
    year INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 인덱스 생성
CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(holiday_date);
CREATE INDEX IF NOT EXISTS idx_holidays_year ON holidays(year);

-- 2025년 공휴일 데이터 삽입
INSERT INTO holidays (holiday_date, holiday_name, year) VALUES
('2025-01-01', '새해', 2025),
('2025-01-28', '설날연휴', 2025),
('2025-01-29', '설날', 2025),
('2025-01-30', '설날연휴', 2025),
('2025-03-01', '3·1절', 2025),
('2025-03-03', '대체공휴일', 2025),
('2025-05-05', '어린이날', 2025),
('2025-05-06', '대체공휴일', 2025),
('2025-06-06', '현충일', 2025),
('2025-08-15', '광복절', 2025),
('2025-10-03', '개천절', 2025),
('2025-10-05', '추석연휴', 2025),
('2025-10-06', '추석', 2025),
('2025-10-07', '추석연휴', 2025),
('2025-10-08', '대체공휴일', 2025),
('2025-10-09', '한글날', 2025),
('2025-12-25', '크리스마스', 2025)
ON CONFLICT (holiday_date) DO NOTHING;

-- 2026년 공휴일 데이터 삽입 (예상)
INSERT INTO holidays (holiday_date, holiday_name, year) VALUES
('2026-01-01', '새해', 2026),
('2026-02-16', '설날연휴', 2026),
('2026-02-17', '설날', 2026),
('2026-02-18', '설날연휴', 2026),
('2026-03-01', '3·1절', 2026),
('2026-05-05', '어린이날', 2026),
('2026-05-25', '부처님오신날', 2026),
('2026-06-06', '현충일', 2026),
('2026-08-15', '광복절', 2026),
('2026-09-24', '추석연휴', 2026),
('2026-09-25', '추석', 2026),
('2026-09-26', '추석연휴', 2026),
('2026-10-03', '개천절', 2026),
('2026-10-09', '한글날', 2026),
('2026-12-25', '크리스마스', 2026)
ON CONFLICT (holiday_date) DO NOTHING;
