export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabase, getTodayJST } from '@/lib/supabase'
import { pushMessage, buildEveningMessage } from '@/lib/line'

/**
 * GET /api/cron/evening
 * 毎夜20:30 JST（= 11:30 UTC）に Vercel Cron から呼び出される
 * 「はい/いいえ」ボタン付きで実行確認を送る
 */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const today = getTodayJST()

  const { data: memo } = await supabase
    .from('memos')
    .select('action')
    .eq('date', today)
    .single()

  if (!memo?.action) {
    console.log(`[cron/evening] ${today} のメモなし。スキップ。`)
    return NextResponse.json({ skipped: true, date: today })
  }

  await pushMessage(buildEveningMessage(memo.action))

  console.log(`[cron/evening] ${today} の夜確認を送信しました。`)
  return NextResponse.json({ success: true, date: today })
}
