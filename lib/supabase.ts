import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export type Memo = {
  id: string
  date: string
  memo_text: string
  summary: string | null
  insight: string | null
  action: string | null
  difficulty_level: number
  executed: boolean | null
  created_at: string
}

/** JST での今日の日付を YYYY-MM-DD 形式で返す */
export function getTodayJST(): string {
  const now = new Date()
  const jst = new Date(now.getTime() + 9 * 60 * 60 * 1000)
  return jst.toISOString().split('T')[0]
}

/** settings テーブルから difficulty_level を取得 */
export async function getDifficultyLevel(): Promise<number> {
  const { data } = await supabase
    .from('settings')
    .select('value')
    .eq('key', 'difficulty_level')
    .single()
  return parseInt(data?.value ?? '0', 10)
}

/** difficulty_level を更新 */
export async function setDifficultyLevel(level: number): Promise<void> {
  await supabase
    .from('settings')
    .update({ value: String(level), updated_at: new Date().toISOString() })
    .eq('key', 'difficulty_level')
}
