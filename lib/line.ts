const LINE_API_BASE = 'https://api.line.me/v2/bot/message'

type TextMessage = {
  type: 'text'
  text: string
  quickReply?: QuickReply
}

type QuickReply = {
  items: QuickReplyItem[]
}

type QuickReplyItem = {
  type: 'action'
  action: {
    type: 'message'
    label: string
    text: string
  }
}

type LineMessage = TextMessage

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${process.env.LINE_CHANNEL_ACCESS_TOKEN}`,
  }
}

/** 自分の LINE に Push メッセージを送信する */
export async function pushMessage(messages: LineMessage[]): Promise<void> {
  const res = await fetch(`${LINE_API_BASE}/push`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({
      to: process.env.LINE_USER_ID,
      messages,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`LINE push failed (${res.status}): ${body}`)
  }
}

/** Webhook の replyToken を使って返信する */
export async function replyMessage(replyToken: string, messages: LineMessage[]): Promise<void> {
  const res = await fetch(`${LINE_API_BASE}/reply`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify({ replyToken, messages }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`LINE reply failed (${res.status}): ${body}`)
  }
}

/** 朝メモ受信直後のメッセージ */
export function buildMemoMessage(
  summary: string,
  insight: string,
  action: string
): LineMessage[] {
  return [
    {
      type: 'text',
      text: `📝 朝メモ整理完了！\n\n【要約】\n${summary}\n\n【本質】\n${insight}\n\n【今日のアクション】\n✅ ${action}`,
    },
  ]
}

/** 朝8:40 のリマインダーメッセージ */
export function buildReminderMessage(action: string): LineMessage[] {
  return [
    {
      type: 'text',
      text: `⏰ おはようございます！\n\n今日のアクション、忘れずに 👇\n\n✅ ${action}\n\n一つだけ、今日中に！`,
    },
  ]
}

/** 夜20:30 の実行確認メッセージ（はい/いいえ ボタン付き） */
export function buildEveningMessage(action: string): LineMessage[] {
  return [
    {
      type: 'text',
      text: `🌙 お疲れさまです！\n\n今朝のアクション：\n「${action}」\n\nできましたか？`,
      quickReply: {
        items: [
          {
            type: 'action',
            action: {
              type: 'message',
              label: 'はい ✅',
              text: 'はい',
            },
          },
          {
            type: 'action',
            action: {
              type: 'message',
              label: 'いいえ 😔',
              text: 'いいえ',
            },
          },
        ],
      },
    },
  ]
}

/** 「はい」返答時の称賛メッセージ */
export function buildSuccessMessage(): LineMessage[] {
  return [
    {
      type: 'text',
      text: '素晴らしい！✨\n今日もちゃんとできましたね。\n小さな一歩の積み重ねが、確実に前進につながります 🌱\n明日も一緒に頑張りましょう！',
    },
  ]
}

/** 「いいえ」返答時の受け止めメッセージ */
export function buildFailureMessage(nextLevel: number): LineMessage[] {
  const levelNote =
    nextLevel >= 3
      ? '明日は本当に小さなこと、1分でできることにしますね。'
      : '明日はもう少し小さなアクションにしますね。'

  return [
    {
      type: 'text',
      text: `大丈夫です 😊\nできない日もあります。それも正直に向き合えている証拠です。\n${levelNote}\n一緒に少しずつ進んでいきましょう 🐢`,
    },
  ]
}
