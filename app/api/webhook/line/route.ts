import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { supabase, getTodayJST, getDifficultyLevel, setDifficultyLevel } from '@/lib/supabase'
import {
  replyMessage,
  buildSuccessMessage,
  buildFailureMessage,
} from '@/lib/line'

/**
 * POST /api/webhook/line
 * LINE Messaging API の Webhook エンドポイント
 * 「はい」「いいえ」のボタン返答を受け取って処理する
 */
export async function POST(req: NextRequest) {
  const rawBody = await req.text()

  // LINE 署名検証（なりすまし防止）
  const signature = req.headers.get('x-line-signature') ?? ''
  const expectedSignature = crypto
    .createHmac('SHA256', process.env.LINE_CHANNEL_SECRET!)
    .update(rawBody)
    .digest('base64')

  if (signature !== expectedSignature) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
  }

  const payload = JSON.parse(rawBody)
  const events: LineEvent[] = payload.events ?? []

  for (const event of events) {
    if (event.type !== 'message' || event.message.type !== 'text') continue

    const text = event.message.text.trim()
    if (text === 'はい' || text === 'いいえ') {
      await handleExecutionReply(text, event.replyToken)
    }
  }

  // LINE Webhook は必ず 200 を返す必要がある
  return NextResponse.json({ success: true })
}

async function handleExecutionReply(answer: string, replyToken: string): Promise<void> {
  const today = getTodayJST()

  await supabase
    .from('memos')
    .update({ executed: answer === 'はい' })
    .eq('date', today)

  if (answer === 'はい') {
    await replyMessage(replyToken, buildSuccessMessage())
  } else {
    const currentLevel = await getDifficultyLevel()
    const newLevel = Math.min(currentLevel + 1, 5) // 最大5で頭打ち
    await setDifficultyLevel(newLevel)
    await replyMessage(replyToken, buildFailureMessage(newLevel))
  }
}

type LineEvent = {
  type: string
  replyToken: string
  message: {
    type: string
    text: string
  }
}
