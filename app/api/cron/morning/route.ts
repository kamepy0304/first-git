export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { supabase, getTodayJST } from '@/lib/supabase'
import { pushMessage, buildReminderMessage } from '@/lib/line'

/**
 * GET /api/cron/morning
 * 毎朝8:40 JST（= 23:40 UTC）に Vercel Cron から呼び出される
 * 当日のアクションをLINEでリマインドする
 */
export async function GET(req: NextRequest) {
  // Cron シークレット認証
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
    console.log(`[cron/morning] ${today} のメモなし。スキップ。`)
    return NextResponse.json({ skipped: true, date: today })
  }

  await pushMessage(buildReminderMessage(memo.action))

  console.log(`[cron/morning] ${today} のリマインダーを送信しました。`)
  return NextResponse.json({ success: true, date: today })
}
