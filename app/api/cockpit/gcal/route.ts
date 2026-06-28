import { NextResponse } from 'next/server'

// iCal の日付文字列を Date に変換
function parseICalDate(val: string): Date | null {
  // 全日イベント: 20240621
  if (/^\d{8}$/.test(val)) {
    return new Date(`${val.slice(0, 4)}-${val.slice(4, 6)}-${val.slice(6, 8)}`)
  }
  // UTC: 20240621T150000Z
  if (/^\d{8}T\d{6}Z$/.test(val)) {
    return new Date(
      `${val.slice(0, 4)}-${val.slice(4, 6)}-${val.slice(6, 8)}T${val.slice(9, 11)}:${val.slice(11, 13)}:${val.slice(13, 15)}Z`
    )
  }
  // ローカル: 20240621T150000
  if (/^\d{8}T\d{6}$/.test(val)) {
    return new Date(
      `${val.slice(0, 4)}-${val.slice(4, 6)}-${val.slice(6, 8)}T${val.slice(9, 11)}:${val.slice(11, 13)}:${val.slice(13, 15)}`
    )
  }
  return null
}

// iCal テキストをパースしてイベント配列を返す
function parseICal(text: string) {
  const events: { summary: string; start: Date; end: Date }[] = []

  // 行継続（スペース/タブ始まりの行を前の行に連結）
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    .split('\n')
    .reduce<string[]>((acc, line) => {
      if ((line.startsWith(' ') || line.startsWith('\t')) && acc.length > 0) {
        acc[acc.length - 1] += line.slice(1)
      } else {
        acc.push(line)
      }
      return acc
    }, [])

  let inEvent = false
  let summary = ''
  let start: Date | null = null
  let end: Date | null = null

  for (const line of lines) {
    if (line === 'BEGIN:VEVENT') {
      inEvent = true; summary = ''; start = null; end = null
      continue
    }
    if (line === 'END:VEVENT') {
      if (inEvent && start && end) {
        events.push({ summary, start, end })
      }
      inEvent = false
      continue
    }
    if (!inEvent) continue

    // プロパティ名とパラメータを分離（DTSTART;TZID=Asia/Tokyo:20240621T... など）
    const colonIdx = line.indexOf(':')
    if (colonIdx < 0) continue
    const key = line.slice(0, colonIdx).split(';')[0].toUpperCase()
    const value = line.slice(colonIdx + 1).trim()

    if (key === 'SUMMARY') summary = value
    if (key === 'DTSTART') start = parseICalDate(value)
    if (key === 'DTEND')   end   = parseICalDate(value)
  }

  return events
}

// GET /api/cockpit/gcal?icalUrl=...
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const icalUrl = searchParams.get('icalUrl')

  if (!icalUrl) {
    return NextResponse.json({ error: 'icalUrl パラメータが必要です' }, { status: 400 })
  }

  // iCalフィードを取得
  let icalText: string
  try {
    const res = await fetch(icalUrl, {
      headers: { 'User-Agent': 'CockpitApp/1.0' },
      next: { revalidate: 300 }, // 5分キャッシュ
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    icalText = await res.text()
  } catch (e: any) {
    return NextResponse.json(
      { error: `iCalフィードの取得に失敗しました: ${e.message}` },
      { status: 502 }
    )
  }

  if (!icalText.includes('BEGIN:VCALENDAR')) {
    return NextResponse.json({ error: '有効なiCalデータではありません' }, { status: 422 })
  }

  const allEvents = parseICal(icalText)

  // 直近2ヶ月のイベントを返す（1日前から取得してタイムゾーンズレを吸収）
  const now = new Date()
  const from = new Date(now)
  from.setDate(from.getDate() - 1)
  const twoMonthsLater = new Date(now)
  twoMonthsLater.setMonth(twoMonthsLater.getMonth() + 2)

  const weekendEvents = allEvents
    .filter(e => e.start >= from && e.start <= twoMonthsLater)
    .map(e => ({
      summary: e.summary,
      date: e.start.toISOString().split('T')[0],
      dayOfWeek: e.start.getDay(), // 0=日, 6=土
    }))

  return NextResponse.json({ events: weekendEvents, total: allEvents.length })
}
