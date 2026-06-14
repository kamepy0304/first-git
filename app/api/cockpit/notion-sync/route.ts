import { NextResponse } from 'next/server'
import { supabase } from '@/lib/supabase'

// Notion プロパティから値を安全に取り出すヘルパー
function getTitle(prop: any): string {
  return prop?.title?.[0]?.plain_text ?? ''
}
function getSelect(prop: any): string {
  return prop?.select?.name ?? ''
}
function getRichText(prop: any): string {
  return prop?.rich_text?.[0]?.plain_text ?? ''
}

// POST /api/cockpit/notion-sync
// body: { notionToken: string, notionDatabaseId: string }
export async function POST(request: Request) {
  const body = await request.json()
  const { notionToken, notionDatabaseId } = body

  if (!notionToken || !notionDatabaseId) {
    return NextResponse.json(
      { error: 'notionToken と notionDatabaseId は必須です' },
      { status: 400 }
    )
  }

  // Notion データベースを全件取得
  const notionRes = await fetch(
    `https://api.notion.com/v1/databases/${notionDatabaseId}/query`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${notionToken}`,
        'Notion-Version': '2022-06-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ page_size: 100 }),
    }
  )

  if (!notionRes.ok) {
    const err = await notionRes.json().catch(() => ({}))
    return NextResponse.json(
      { error: err.message ?? `Notion API エラー (${notionRes.status})` },
      { status: notionRes.status }
    )
  }

  const notionData = await notionRes.json()

  // Notion ページ → cockpit_bucket_items 形式にマッピング
  const today = new Date().toISOString().split('T')[0]

  const items = (notionData.results as any[])
    .map((page) => {
      const props = page.properties

      // 「名前」プロパティ (Title)
      const text = getTitle(props['名前']) || getTitle(props['Name']) || getTitle(props['title'])
      if (!text) return null // タイトル空はスキップ

      // 「時期」プロパティ (Select or Rich Text)
      const period =
        getSelect(props['時期']) ||
        getRichText(props['時期']) ||
        getSelect(props['Period']) ||
        ''

      // 「達成状況」プロパティ (Select)
      const status =
        getSelect(props['達成状況']) ||
        getSelect(props['Status']) ||
        ''

      const checked = status === '達成'

      return {
        notion_page_id: page.id,
        text,
        tag: period || 'インドア',
        date_added: today,
        checked,
        note: [
          period  ? `時期: ${period}`     : '',
          status  ? `達成状況: ${status}` : '',
          'Notion同期',
        ]
          .filter(Boolean)
          .join(' / '),
      }
    })
    .filter(Boolean)

  if (items.length === 0) {
    return NextResponse.json({ synced: 0, items: [], message: 'Notionに同期対象のアイテムがありませんでした' })
  }

  // Supabase に Upsert（notion_page_id で重複判定）
  const { data, error } = await supabase
    .from('cockpit_bucket_items')
    .upsert(items, { onConflict: 'notion_page_id' })
    .select()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ synced: data?.length ?? 0, items: data })
}
