import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// PATCH /api/cockpit/bucket/[id] — アイテム更新（checked トグル等）
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const body = await request.json()
  const id = Number(params.id)

  // フロントエンド側のキー名 (dateAdded) をDB側 (date_added) に変換
  const dbFields: Record<string, unknown> = {}
  if ('checked'   in body) dbFields.checked    = body.checked
  if ('dateAdded' in body) dbFields.date_added = body.dateAdded
  if ('text'      in body) dbFields.text       = body.text
  if ('tag'       in body) dbFields.tag        = body.tag
  if ('note'      in body) dbFields.note       = body.note

  const { data, error } = await supabase
    .from('cockpit_bucket_items')
    .update(dbFields)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ item: data })
}

// DELETE /api/cockpit/bucket/[id] — アイテム削除
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const id = Number(params.id)

  const { error } = await supabase
    .from('cockpit_bucket_items')
    .delete()
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
