import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

const DEFAULT_ITEMS = [
  { text: '手作りの陶芸教室で一輪挿しを作る',               tag: 'アウトドア', date_added: '2026-05-15', checked: false, note: '粘土の感触とじっくり向き合い、デジタルデトックスをする。Notion側最終更新: 2026-05-15' },
  { text: '暗闇レストラン（ダイアログ・イン・ザ・ダーク）に行く', tag: '極上体験',  date_added: '2026-05-20', checked: false, note: '視覚を遮断され、味覚と触覚が研ぎ澄まされる感覚を楽しむ。Notion側最終更新: 2026-05-20' },
  { text: '未体験のパラグライダーで空を飛ぶ',                 tag: 'アウトドア', date_added: '2026-05-25', checked: false, note: '大空を滑空するスリルと圧倒的視野の獲得。Notion側最終更新: 2026-05-25' },
  { text: 'お寺の早朝座禅会に参加してマインドフルネスを体得', tag: 'インドア',  date_added: '2026-05-10', checked: true,  note: '早朝の冷たく凛とした本堂で、自己の呼吸に全集中する。Notion側最終更新: 2026-05-12' },
]

// GET /api/cockpit/bucket — バケットリスト一覧取得（空なら初期データを投入）
export async function GET() {
  const { data, error } = await supabase
    .from('cockpit_bucket_items')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  if (!data || data.length === 0) {
    const { data: seeded, error: seedError } = await supabase
      .from('cockpit_bucket_items')
      .insert(DEFAULT_ITEMS)
      .select()
      .order('created_at', { ascending: false })

    if (seedError) return NextResponse.json({ error: seedError.message }, { status: 500 })
    return NextResponse.json({ items: seeded ?? [] })
  }

  return NextResponse.json({ items: data })
}

// POST /api/cockpit/bucket — 新規アイテム追加
export async function POST(request: Request) {
  const body = await request.json()

  const { data, error } = await supabase
    .from('cockpit_bucket_items')
    .insert({
      text:       body.text,
      tag:        body.tag        ?? 'インドア',
      date_added: body.dateAdded  ?? new Date().toISOString().split('T')[0],
      checked:    body.checked    ?? false,
      note:       body.note       ?? '',
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data })
}

// PATCH /api/cockpit/bucket — Notion同期（全アイテムの date_added を一括更新）
export async function PATCH(request: Request) {
  const body = await request.json()

  if (body.action === 'sync_dates' && body.date) {
    const { error } = await supabase
      .from('cockpit_bucket_items')
      .update({ date_added: body.date })
      .gte('id', 0) // 全件

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true })
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 })
}
