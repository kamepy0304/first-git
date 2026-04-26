import OpenAI from 'openai'

let _openai: OpenAI | null = null

function getOpenAI(): OpenAI {
  if (!_openai) {
    _openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  }
  return _openai
}

export type AISummary = {
  summary: string
  insight: string
  action: string
}

/**
 * 朝メモをAIで要約・本質抽出・アクション生成する
 * difficulty_level が高いほどアクションを小さく・簡単にする
 */
export async function generateMemoSummary(
  memoText: string,
  difficultyLevel: number
): Promise<AISummary> {
  const prompt = buildPrompt(memoText, difficultyLevel)

  const response = await getOpenAI().chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.7,
    max_tokens: 600,
  })

  const content = response.choices[0].message.content ?? ''
  return parseAIResponse(content)
}

function buildPrompt(memoText: string, difficultyLevel: number): string {
  const difficultyInstruction = getDifficultyInstruction(difficultyLevel)

  return `あなたは個人の朝メモを整理するアシスタントです。
書き手が今日の行動に確実につながるよう、具体的でシンプルな出力をしてください。

---
朝メモ：
${memoText}
---

アクション難易度レベル：${difficultyLevel}
${difficultyInstruction}

以下の形式で出力してください（【】の見出しを必ず含める）：

【要約】
（100字以内で、メモの内容を簡潔にまとめる）

【本質】
（メモの核心を1文で表現する）

【今日のアクション】
（難易度レベルに合わせた、今日中に必ずできる具体的な行動を1つだけ）

出力上の制約：
- アクションは必ず1つだけ
- 今日中に実行可能な具体的行動（抽象的にしない）
- 「考える」ではなく「書く」「連絡する」「確認する」など動作動詞を使う
- 難易度レベルが高いほど所要時間を短く・行動を小さくする`
}

function getDifficultyInstruction(level: number): string {
  switch (level) {
    case 0:
      return 'アクションは通常難易度で設定してください（例：上司に相談する、資料を作成する）。'
    case 1:
      return 'アクションは少し小さく具体的にしてください（例：相談内容を3点書き出す、資料の目次だけ書く）。'
    case 2:
      return 'アクションはとても小さくしてください（例：相談したいことを1行書く、タイトルだけ決める）。'
    default:
      return `アクションは1分以内でできる最小の行動にしてください（例：メモ帳に1文だけ書く、スマホで1件確認する）。`
  }
}

function parseAIResponse(content: string): AISummary {
  const summaryMatch = content.match(/【要約】\s*([\s\S]*?)(?=【本質】|$)/)
  const insightMatch = content.match(/【本質】\s*([\s\S]*?)(?=【今日のアクション】|$)/)
  const actionMatch = content.match(/【今日のアクション】\s*([\s\S]*)$/)

  return {
    summary: summaryMatch?.[1]?.trim() ?? '（要約の生成に失敗しました）',
    insight: insightMatch?.[1]?.trim() ?? '（本質の生成に失敗しました）',
    action: actionMatch?.[1]?.trim() ?? '（アクションの生成に失敗しました）',
  }
}
