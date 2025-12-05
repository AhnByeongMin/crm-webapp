-- 푸시 알림 구독 정보 테이블
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id SERIAL PRIMARY KEY,
    username VARCHAR(100) NOT NULL,
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
);

-- 인덱스 생성 (사용자별 구독 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_username ON push_subscriptions(username);

-- 구독 업데이트 시 updated_at 자동 갱신 트리거
CREATE OR REPLACE FUNCTION update_push_subscription_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_push_subscription_timestamp
BEFORE UPDATE ON push_subscriptions
FOR EACH ROW
EXECUTE FUNCTION update_push_subscription_timestamp();

COMMENT ON TABLE push_subscriptions IS '웹 푸시 알림 구독 정보 저장 테이블';
COMMENT ON COLUMN push_subscriptions.username IS '구독한 사용자 이름';
COMMENT ON COLUMN push_subscriptions.endpoint IS '푸시 서비스 엔드포인트 URL (고유값)';
COMMENT ON COLUMN push_subscriptions.p256dh IS '클라이언트 공개키 (암호화용)';
COMMENT ON COLUMN push_subscriptions.auth IS '인증 시크릿';
