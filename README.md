# 朝メモサマライザー

> 朝4時台の手書きメモをAIで整理し、LINEで行動に繋げるパーソナルツール

---

## 1. 要件定義（簡潔版）

| 項目 | 内容 |
|------|------|
| 利用者 | 個人（1名） |
| 目的 | 朝メモの内容を当日の行動に確実につなげる |
| 入力 | iOSショートカット経由でテキスト送信 |
| 出力 | LINE Push メッセージ（即時・朝・夜） |
| 応答 | LINE Quick Reply（はい/いいえ）→ 難易度調整 |

---

## 2. MVPスコープ

- [x] メモ受信API（POST /api/memo）
- [x] AI要約生成（要約・本質・アクション）
- [x] LINE即時送信
- [x] 朝8:40 リマインダー（Vercel Cron）
- [x] 夜20:30 実行確認（ボタン付き）
- [x] はい/いいえ Webhook 処理
- [x] difficulty_level 管理（DB永続）

MVP後の改善例 → セクション16参照

---

## 3. 採用技術スタック

| 役割 | 技術 | 選定理由 |
|------|------|----------|
| フレームワーク | **Next.js 14 (App Router)** | API Routes でバックエンドも一体化。Vercelと相性最良 |
| DB | **Supabase (PostgreSQL)** | 無料枠あり・管理UIで中身確認しやすい・SQL直感的 |
| AI | **OpenAI gpt-4o-mini** | 品質十分・コスト低（1回約0.01円） |
| 通知 | **LINE Messaging API** | 毎日使うアプリ・ボタン返答が標準機能 |
| スケジューラ | **Vercel Cron** | デプロイ先と同一。追加料金なし（無料枠あり） |
| デプロイ | **Vercel** | git push で自動デプロイ。環境変数管理も簡単 |

---

## 4. アーキテクチャ

```
[iOS ショートカット]
    │ POST /api/memo (テキスト)
    ▼
[Vercel - Next.js API Routes]
    ├─ メモをSupabaseに保存
    ├─ OpenAI API でAI整理
    └─ LINE Push（即時）

[Vercel Cron 23:40 UTC = 8:40 JST]
    └─ GET /api/cron/morning → LINE Push（リマインダー）

[Vercel Cron 11:30 UTC = 20:30 JST]
    └─ GET /api/cron/evening → LINE Push（はい/いいえ ボタン）

[ユーザーがLINEでボタンをタップ]
    │ LINE Webhook → POST /api/webhook/line
    ▼
[Vercel - Next.js API Routes]
    ├─ 「はい」→ executed=true を保存 + 称賛メッセージ
    └─ 「いいえ」→ executed=false + difficulty_level+1 + 受け止めメッセージ
```

---

## 5. DB設計

```sql
-- supabase/schema.sql に記載。Supabase SQL Editorで実行する。

-- メモテーブル
CREATE TABLE memos (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  date            DATE        NOT NULL UNIQUE,  -- JST日付。1日1件
  memo_text       TEXT        NOT NULL,
  summary         TEXT,
  insight         TEXT,
  action          TEXT,
  difficulty_level INTEGER    NOT NULL DEFAULT 0,
  executed        BOOLEAN,                      -- null=未回答, true=はい, false=いいえ
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 設定テーブル（difficulty_level を永続管理）
CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
INSERT INTO settings VALUES ('difficulty_level', '0');
```

---

## 6. API設計

### POST /api/memo
iOSショートカットからメモを受信する。

**リクエスト**
```json
{ "text": "今日は上司との関係が気になっている..." }
```

**レスポンス**
```json
{
  "success": true,
  "summary": "上司との関係性について不安を感じており...",
  "insight": "人間関係の不安が行動を止めている。",
  "action": "上司に相談したいことを3点だけ書き出す"
}
```

### POST /api/webhook/line
LINE Webhook。署名検証あり。「はい」「いいえ」のみ処理。

### GET /api/cron/morning
Vercel Cron から呼び出し。`Authorization: Bearer {CRON_SECRET}` 必須。

### GET /api/cron/evening
Vercel Cron から呼び出し。`Authorization: Bearer {CRON_SECRET}` 必須。

---

## 7. スケジューラ設計

```json
// vercel.json
{
  "crons": [
    { "path": "/api/cron/morning", "schedule": "40 23 * * *" },
    { "path": "/api/cron/evening", "schedule": "30 11 * * *" }
  ]
}
```

| cron | UTC | JST | 役割 |
|------|-----|-----|------|
| `40 23 * * *` | 23:40 | 翌8:40 | 朝リマインダー |
| `30 11 * * *` | 11:30 | 20:30 | 夜の実行確認 |

Vercel Cron は認証ヘッダー `Authorization: Bearer {CRON_SECRET}` を自動付与しない。  
→ Vercel ダッシュボードでは `CRON_SECRET` を環境変数に設定し、各APIでヘッダー検証する。  
※ Vercel は Hobby プランでも cron は月100回まで無料。1日2回 × 30日 = 60回/月で収まる。

---

## 8. LINE連携設計

### 必要な設定
1. LINE Developers でチャネル作成（Messaging API）
2. Channel Access Token（長期）と Channel Secret を取得
3. 自分のユーザーIDを取得（LINE Official Account Manager → 設定 → チャネル基本設定）
4. Webhook URL を設定: `https://あなたのドメイン/api/webhook/line`
5. 「Webhookの利用」をON

### メッセージ種別
| タイミング | 種別 | 内容 |
|-----------|------|------|
| メモ受信直後 | Push | 要約・本質・アクション |
| 8:40 | Push | アクションのリマインド |
| 20:30 | Push + Quick Reply | 「できた？」+ はい/いいえボタン |
| はい返答 | Reply | 称賛メッセージ |
| いいえ返答 | Reply | 受け止め + 翌日難易度調整予告 |

---

## 9. AIプロンプト（完成版）

```
あなたは個人の朝メモを整理するアシスタントです。
書き手が今日の行動に確実につながるよう、具体的でシンプルな出力をしてください。

---
朝メモ：
{memoText}
---

アクション難易度レベル：{difficultyLevel}
{difficultyInstruction}

以下の形式で出力してください（【】の見出しを必ず含める）：

【要約】
（100字以内で、メモの内容を簡潔にまとめる）

【本質】
（メモの核心を1文で表現する）

【今日のアクション】
（難易度レベルに合わせた、今日中に必ずできる具体的な行動を1つだけ）

出力上の制約：
- アクションは必ず1つだけ
- 今日中に実行可能な具体的行動（抽象的にしない）
- 「考える」ではなく「書く」「連絡する」「確認する」など動作動詞を使う
- 難易度レベルが高いほど所要時間を短く・行動を小さくする
```

**difficulty_instruction の対応表**

| level | instruction |
|-------|-------------|
| 0 | アクションは通常難易度（例：上司に相談する） |
| 1 | 少し小さく（例：相談内容を3点書き出す） |
| 2 | とても小さく（例：相談したいことを1行書く） |
| 3+ | 1分以内でできる最小の行動（例：メモ帳に1文だけ） |

---

## 10. difficulty 制御ロジック

```
settings.difficulty_level（DB永続）

初期値: 0

「はい」受信 → 変更なし（リセットはしない。レベルは人の実力に合わせて固定）
「いいえ」受信 → +1（上限: 5）

翌日のメモ生成時 → 現在の difficulty_level を使ってAIプロンプトを構築
```

**設計の意図:**  
「いいえ」が続くほどアクションが小さくなり、成功体験を積みやすくなる。  
人が「はい」と言えるレベルに自然に落ち着くまで小さくなり続ける。  
手動リセットが必要な場合は Supabase のテーブルで `value = '0'` に直接更新する。

---

## 11. ディレクトリ構成

```
/
├── app/
│   ├── api/
│   │   ├── memo/
│   │   │   └── route.ts          ← メモ受信・AI生成・LINE送信
│   │   ├── webhook/
│   │   │   └── line/
│   │   │       └── route.ts      ← LINE Webhook（はい/いいえ処理）
│   │   └── cron/
│   │       ├── morning/
│   │       │   └── route.ts      ← 8:40 リマインダー
│   │       └── evening/
│   │           └── route.ts      ← 20:30 実行確認
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   ├── supabase.ts               ← DBクライアント・ユーティリティ
│   ├── openai.ts                 ← AI生成ロジック・プロンプト
│   └── line.ts                   ← LINE送信・メッセージ組み立て
├── supabase/
│   └── schema.sql                ← DBスキーマ（初回実行用）
├── .env.local                    ← 秘密情報（gitignore）
├── .env.local.example            ← 環境変数テンプレート
├── next.config.js
├── package.json
├── tsconfig.json
├── vercel.json                   ← Cron スケジュール定義
└── README.md
```

---

## 12. 実装手順（ToDo形式）

### フェーズ1: 環境準備（30分）
- [ ] Node.js 20以上をインストール（https://nodejs.org）
- [ ] Vercel アカウント作成（https://vercel.com）
- [ ] Supabase プロジェクト作成（https://supabase.com）
- [ ] OpenAI APIキー取得（https://platform.openai.com）
- [ ] LINE Developers チャネル作成（Messaging API）

### フェーズ2: DB初期化（10分）
- [ ] Supabase の SQL Editor を開く
- [ ] `supabase/schema.sql` の内容をコピーして実行
- [ ] `memos` テーブルと `settings` テーブルが作成されたことを確認

### フェーズ3: ローカル開発（15分）
- [ ] `cp .env.local.example .env.local`
- [ ] `.env.local` に各種APIキーを記入
- [ ] `npm install`
- [ ] `npm run dev` でローカル起動
- [ ] `curl -X POST http://localhost:3000/api/memo -H "Content-Type: application/json" -d '{"text":"テストメモ"}'` で動作確認

### フェーズ4: LINE連携テスト（20分）
- [ ] ngrok などでローカルを公開: `ngrok http 3000`
- [ ] LINE Webhook URL に ngrok URL + `/api/webhook/line` を設定
- [ ] LINE Developers で「Webhookの利用」をON
- [ ] LINE公式アカウントにメッセージを送って返答確認

### フェーズ5: デプロイ（15分）
- [ ] GitHub に push
- [ ] Vercel でリポジトリをインポート
- [ ] Vercel 環境変数に `.env.local` の内容を設定
- [ ] Vercel の Webhook URL に変更: `https://あなたのドメイン/api/webhook/line`
- [ ] 本番URLで `/api/memo` にcurlしてLINEに届くか確認

### フェーズ6: iOSショートカット設定（10分）
- [ ] iOSショートカットアプリで新規ショートカット作成
- [ ] 「共有シート」をトリガーに設定
- [ ] アクション: 「URLの内容を取得」→ POST、URL=本番API、Body=JSON `{"text": [共有テキスト]}`

---

## 13. 環境変数リファレンス

```bash
# Supabase（プロジェクト設定 > API で確認）
SUPABASE_URL=https://xxxxxxxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...  # service_role キー

# OpenAI（https://platform.openai.com/api-keys）
OPENAI_API_KEY=sk-proj-xxxxxxxxxx

# LINE（LINE Developers > Messaging API チャネル）
LINE_CHANNEL_ACCESS_TOKEN=xxxxxx  # 長期トークン
LINE_CHANNEL_SECRET=xxxxxx        # チャネルシークレット
LINE_USER_ID=Uxxxxxxxxxx          # 自分のユーザーID

# Cron認証（openssl rand -hex 32 で生成）
CRON_SECRET=xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

---

## 14. ローカル起動方法

```bash
# 1. 依存関係インストール
npm install

# 2. 環境変数設定
cp .env.local.example .env.local
# .env.local を編集して各種APIキーを記入

# 3. 開発サーバー起動
npm run dev
# → http://localhost:3000 で起動

# 4. メモ送信テスト
curl -X POST http://localhost:3000/api/memo \
  -H "Content-Type: application/json" \
  -d '{"text": "今日は集中力が落ちている。原因は睡眠不足かもしれない。何か対策が必要だ。"}'

# 5. Cronテスト（ローカルでは手動実行）
curl -H "Authorization: Bearer your-cron-secret" \
  http://localhost:3000/api/cron/morning

curl -H "Authorization: Bearer your-cron-secret" \
  http://localhost:3000/api/cron/evening
```

---

## 15. デプロイ方法（Vercel）

```bash
# 1. Vercel CLI インストール
npm i -g vercel

# 2. ログイン
vercel login

# 3. デプロイ（初回）
vercel

# 4. 環境変数設定（Vercel ダッシュボード推奨）
# Dashboard > プロジェクト > Settings > Environment Variables
# .env.local の全変数を追加する

# 5. 本番デプロイ
vercel --prod

# 6. Cron 動作確認
# Dashboard > プロジェクト > Settings > Cron Jobs
# スケジュールが表示されていればOK
```

**LINE Webhook URL の更新（デプロイ後）:**
1. LINE Developers を開く
2. Messaging API チャネル > Webhook settings
3. Webhook URL: `https://あなたのプロジェクト名.vercel.app/api/webhook/line`
4. 「Verify」ボタンで疎通確認

---

## 16. MVP後の改善案

| 優先度 | 改善内容 | 効果 |
|--------|----------|------|
| 高 | difficulty_level の自動リセット（例：3日連続「はい」で-1） | 成功が続いたら自然に難易度が戻る |
| 高 | メモ受信APIへの認証追加（Bearer Token） | 不正リクエスト防止 |
| 中 | 週次レポートLINE送信（実行率・傾向） | 振り返りの仕組みを追加 |
| 中 | Supabase の Row Level Security 有効化 | セキュリティ強化 |
| 低 | Web管理画面（メモ一覧・統計） | ブラウザで実績確認 |
| 低 | 複数人対応（userId管理） | 家族・パートナーと共有 |

---

## iOSショートカット 設定ガイド

1. **ショートカットアプリ** を開く
2. **+** で新規作成
3. アクション追加: 「テキスト」→ 共有シートから受け取る設定
4. アクション追加: 「URLの内容を取得」
   - URL: `https://あなたのドメイン/api/memo`
   - メソッド: POST
   - リクエスト本文: JSON
   - `text`: 上のテキスト変数
5. 「共有シートに表示」をON にしてショートカット名を「朝メモ送信」に設定

Appleメモでメモを書き終えたら: **共有ボタン** → **朝メモ送信** → 完了！
