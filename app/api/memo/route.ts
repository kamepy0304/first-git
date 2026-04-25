import { NextRequest, NextResponse } from 'next/server'
import { supabase, getTodayJST, getDifficultyLevel } from '@/lib/supabase'
import { generateMemoSummary } from '@/lib/openai'
import { pushMessage, buildMemoMessage } from '@/lib/line'

/**
 * POST /api/memo
 * iOS ショートカット or 共有シートからメモを受け取り、AI整理してLINEに送信する
 *
 * Body: { "text": "朝メモの内容..." }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const memoText: string = body.text?.trim() ?? ''

    if (!memoText) {
      return NextResponse.json({ error: 'text は必須です' }, { status: 400 })
    }

    const today = getTodayJST()
    const difficultyLevel = await getDifficultyLevel()

    // メモをDBに保存（同日に複数回送信された場合は上書き）
    const { data: memo, error: insertError } = await supabase
      .from('memos')
      .upsert(
        { date: today, memo_text: memoText, difficulty_level: difficultyLevel },
        { onConflict: 'date' }
      )
      .select()
      .single()

    if (insertError) throw insertError

    // AI で要約・本質・アクションを生成
    const { summary, insight, action } = await generateMemoSummary(memoText, difficultyLevel)

    // AI結果をDBに保存
    const { error: updateError } = await supabase
      .from('memos')
      .update({ summary, insight, action })
      .eq('id', memo.id)

    if (updateError) throw updateError

    // LINE に即時送信
    await pushMessage(buildMemoMessage(summary, insight, action))

    return NextResponse.json({ success: true, summary, insight, action })
  } catch (err) {
    console.error('[/api/memo] error:', err)
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 })
  }
}
