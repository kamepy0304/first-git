-- ==========================================
-- 体験創造コックピット DB スキーマ
-- Supabase SQL Editor に貼り付けて実行する
-- ==========================================

-- バケットリストアイテム
CREATE TABLE IF NOT EXISTS cockpit_bucket_items (
  id         BIGSERIAL    PRIMARY KEY,
  text       TEXT         NOT NULL,
  tag        TEXT         NOT NULL DEFAULT 'インドア',
  date_added DATE         NOT NULL DEFAULT CURRENT_DATE,
  checked    BOOLEAN      NOT NULL DEFAULT FALSE,
  note       TEXT         NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ  DEFAULT NOW(),
  updated_at TIMESTAMPTZ  DEFAULT NOW()
);

-- カレンダー空き枠のアサイン状態
CREATE TABLE IF NOT EXISTS cockpit_calendar_slots (
  slot_id          TEXT        PRIMARY KEY,  -- 'slot-6-6' など固定ID
  planned_activity TEXT,                     -- NULL = アサインなし
  active_state     TEXT        NOT NULL,
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

-- updated_at 自動更新トリガー
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER cockpit_bucket_updated_at
  BEFORE UPDATE ON cockpit_bucket_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE OR REPLACE TRIGGER cockpit_calendar_updated_at
  BEFORE UPDATE ON cockpit_calendar_slots
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- インデックス（作成日時降順で高速フェッチ）
CREATE INDEX IF NOT EXISTS idx_cockpit_bucket_created ON cockpit_bucket_items (created_at DESC);
