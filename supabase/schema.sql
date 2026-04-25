-- ==========================================
-- 朝メモサマライザー DB スキーマ
-- Supabase SQL Editor に貼り付けて実行する
-- ==========================================

-- メモテーブル
CREATE TABLE IF NOT EXISTS memos (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  date            DATE        NOT NULL UNIQUE,
  memo_text       TEXT        NOT NULL,
  summary         TEXT,
  insight         TEXT,
  action          TEXT,
  difficulty_level INTEGER    NOT NULL DEFAULT 0,
  executed        BOOLEAN,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 設定テーブル（difficulty_level の永続管理）
CREATE TABLE IF NOT EXISTS settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- difficulty_level の初期値
INSERT INTO settings (key, value)
VALUES ('difficulty_level', '0')
ON CONFLICT (key) DO NOTHING;

-- インデックス（日付検索を高速化）
CREATE INDEX IF NOT EXISTS idx_memos_date ON memos (date DESC);
