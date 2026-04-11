import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createAdminClient } from '@/lib/supabase/admin'
import { computeRankings } from '@/lib/ranking'
import { formatDistance, formatDuration } from '@/lib/utils/geo'
import type { Database, Json } from '@/types/supabase'

const SYSTEM_PROMPT = `あなたはsanpostarの「称え師」です。
散歩記録のランキングデータをもとに、ユーザーを静かに称える一文を生成してください。

ルール：
- NBAスタッツ風の、落ち着いた丁寧なトーン（煽らない、静かに称える）
- 1位でなくてもよい。5位でも10位でも必ず称える
- 複数のランキングが提供された場合は、最も印象的・ユニークなものを選ぶ
- 1〜2文で完結させること（短くても良い）
- 日本語で出力
- 称えのみを出力すること（前置きや説明は不要）

出力例：
「雨の深夜に歩いた距離、全ユーザー中5位です。」
「火曜日の夜に歩いた回数、今月あなたが最多です。」
「曇りの夕方に歩いた累計距離、全体の3位に位置しています。」`

/** APIキー不要のフォールバック称え文 */
function buildFallbackPraise(ranking: { conditionDescription: string; rank: number; totalCount: number }): string {
  const { conditionDescription, rank, totalCount } = ranking
  if (rank === 1)  return `${conditionDescription}、あなたがトップです。`
  if (rank <= 3)   return `${conditionDescription}、${totalCount}人中${rank}位です。`
  return `${conditionDescription}、${totalCount}人中${rank}位に入っています。`
}

/**
 * 称えを生成してDBに保存する。
 * saveWalk で認証済みの supabase クライアントをそのまま受け取ることで
 * Next.js の async context 問題を回避する。
 */
export async function generateAndSavePraise(
  supabase: SupabaseClient<Database>,
  walkRecordId: string,
  userId: string,
): Promise<void> {
  try {
    // 散歩記録を取得
    const { data: walk } = await supabase
      .from('walk_records')
      .select('distance_meters, duration_seconds, time_of_day, weather, day_of_week, year, month')
      .eq('id', walkRecordId)
      .maybeSingle()

    if (!walk) return

    // ランキングを計算
    const rankings = await computeRankings(supabase, userId, walk)
    if (rankings.length === 0) return

    let praiseText: string

    if (process.env.ANTHROPIC_API_KEY) {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

      const userMessage = `以下の散歩データのランキングから、称えを1〜2文で生成してください。

【今回の散歩】
- 距離: ${formatDistance(walk.distance_meters)}
- 時間: ${formatDuration(walk.duration_seconds ?? 0)}
- 時間帯: ${walk.time_of_day}
- 天気: ${walk.weather ?? '不明'}

【ランキングデータ（最も印象的なものを選んでください）】
${rankings.map((r, i) => `${i + 1}. ${r.conditionDescription}：${r.rank}位 / ${r.totalCount}人中`).join('\n')}`

      const response = await client.messages.create({
        model:      'claude-haiku-4-5-20251001',
        max_tokens: 256,
        system:     SYSTEM_PROMPT,
        messages:   [{ role: 'user', content: userMessage }],
      })

      praiseText = response.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map(b => b.text)
        .join('')
        .trim()

      if (!praiseText) praiseText = buildFallbackPraise(rankings[0])
    } else {
      praiseText = buildFallbackPraise(rankings[0])
    }

    // praises テーブルに保存（RLS bypass のため admin クライアントを使用）
    const best = rankings[0]
    const admin = createAdminClient()
    const { error } = await admin.from('praises').insert({
      user_id:            userId,
      walk_record_id:     walkRecordId,
      praise_type:        'daily',
      praise_text:        praiseText,
      ranking_conditions: best.conditions as Json,
      rank:               best.rank,
      total_count:        best.totalCount,
    })
    if (error) console.error('[praise] insert failed:', error.message)
  } catch (err) {
    console.error('[praise] generation failed:', err)
  }
}
