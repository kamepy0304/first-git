import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// GET /api/cockpit/calendar — カレンダー割当を全件取得
export async function GET() {
  const { data, error } = await supabase
    .from('cockpit_calendar_slots')
    .select('*')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ assignments: data ?? [] })
}

// POST /api/cockpit/calendar — アサインを保存（Upsert）
export async function POST(request: Request) {
  const body = await request.json()
  const { slotId, plannedActivity, activeState } = body

  if (!slotId || !activeState) {
    return NextResponse.json({ error: 'slotId and activeState are required' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('cockpit_calendar_slots')
    .upsert(
      { slot_id: slotId, planned_activity: plannedActivity ?? null, active_state: activeState },
      { onConflict: 'slot_id' }
    )
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ assignment: data })
}
