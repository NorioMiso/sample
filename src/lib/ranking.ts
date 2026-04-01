/**
 * ランキング計算ユーティリティ
 * walk_records をフィルタ→ユーザー別集計→順位を計算する
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseClient = any

export type RankingResult = {
  conditions:           Record<string, unknown>
  conditionDescription: string
  rank:                 number
  totalCount:           number
}

const WEATHER_LABELS: Record<string, string> = {
  sunny:  '晴れ',
  cloudy: '曇り',
  rainy:  '雨',
  snowy:  '雪',
  foggy:  '霧',
  windy:  '強風',
}

const TIME_LABELS: Record<string, string> = {
  morning:  '早朝',
  daytime:  '昼間',
  evening:  '夕方',
  night:    '夜',
  midnight: '深夜',
}

const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土']

type Filters = {
  weather?:     string
  time_of_day?: string
  day_of_week?: number
  year?:        number
  month?:       number
}

/** 距離の合計で順位を計算する */
async function distanceRank(
  supabase: SupabaseClient,
  userId: string,
  filters: Filters,
): Promise<{ rank: number; totalCount: number } | null> {
  let query = supabase
    .from('walk_records')
    .select('user_id, distance_meters')
    .or(`is_public.eq.true,user_id.eq.${userId}`)

  if (filters.weather)                query = query.eq('weather',     filters.weather)
  if (filters.time_of_day)            query = query.eq('time_of_day', filters.time_of_day)
  if (filters.day_of_week !== undefined) query = query.eq('day_of_week', filters.day_of_week)
  if (filters.year)                   query = query.eq('year',        filters.year)
  if (filters.month)                  query = query.eq('month',       filters.month)

  const { data, error } = await query
  if (error || !data || data.length === 0) return null

  const totals = new Map<string, number>()
  for (const r of data) {
    totals.set(r.user_id, (totals.get(r.user_id) ?? 0) + r.distance_meters)
  }

  const myDist     = totals.get(userId) ?? 0
  const sorted     = Array.from(totals.values()).sort((a, b) => b - a)
  const rank       = sorted.findIndex(d => d <= myDist) + 1
  const totalCount = sorted.length

  return totalCount === 0 ? null : { rank, totalCount }
}

/** 散歩回数で順位を計算する */
async function countRank(
  supabase: SupabaseClient,
  userId: string,
  filters: Filters,
): Promise<{ rank: number; totalCount: number } | null> {
  let query = supabase
    .from('walk_records')
    .select('user_id')
    .or(`is_public.eq.true,user_id.eq.${userId}`)

  if (filters.weather)                query = query.eq('weather',     filters.weather)
  if (filters.time_of_day)            query = query.eq('time_of_day', filters.time_of_day)
  if (filters.day_of_week !== undefined) query = query.eq('day_of_week', filters.day_of_week)
  if (filters.year)                   query = query.eq('year',        filters.year)
  if (filters.month)                  query = query.eq('month',       filters.month)

  const { data, error } = await query
  if (error || !data || data.length === 0) return null

  const counts = new Map<string, number>()
  for (const r of data) {
    counts.set(r.user_id, (counts.get(r.user_id) ?? 0) + 1)
  }

  const myCount    = counts.get(userId) ?? 0
  const sorted     = Array.from(counts.values()).sort((a, b) => b - a)
  const rank       = sorted.findIndex(c => c <= myCount) + 1
  const totalCount = sorted.length

  return totalCount === 0 ? null : { rank, totalCount }
}

/**
 * 散歩記録に対して複数条件のランキングを計算して返す。
 * Claude に渡すための候補リスト（最大5件）。
 */
export async function computeRankings(
  supabase: SupabaseClient,
  userId: string,
  walk: {
    weather:     string | null
    time_of_day: string
    day_of_week: number
    year:        number
    month:       number
  },
): Promise<RankingResult[]> {
  const results: RankingResult[] = []

  // 1. 天気 × 時間帯 × 今月の距離（最も条件が細かい）
  if (walk.weather) {
    const r = await distanceRank(supabase, userId, {
      weather: walk.weather, time_of_day: walk.time_of_day,
      year: walk.year, month: walk.month,
    })
    if (r) results.push({
      conditions: { weather: walk.weather, time_of_day: walk.time_of_day, year: walk.year, month: walk.month },
      conditionDescription: `${WEATHER_LABELS[walk.weather]}の${TIME_LABELS[walk.time_of_day]}に歩いた今月の距離`,
      ...r,
    })
  }

  // 2. 曜日 × 時間帯 × 今月の距離
  {
    const r = await distanceRank(supabase, userId, {
      day_of_week: walk.day_of_week, time_of_day: walk.time_of_day,
      year: walk.year, month: walk.month,
    })
    if (r) results.push({
      conditions: { day_of_week: walk.day_of_week, time_of_day: walk.time_of_day, year: walk.year, month: walk.month },
      conditionDescription: `${DAY_LABELS[walk.day_of_week]}曜日の${TIME_LABELS[walk.time_of_day]}に歩いた今月の距離`,
      ...r,
    })
  }

  // 3. 天気 × 累計距離（全期間）
  if (walk.weather) {
    const r = await distanceRank(supabase, userId, { weather: walk.weather })
    if (r) results.push({
      conditions: { weather: walk.weather },
      conditionDescription: `${WEATHER_LABELS[walk.weather]}の日に歩いた累計距離`,
      ...r,
    })
  }

  // 4. 今月の散歩回数
  {
    const r = await countRank(supabase, userId, { year: walk.year, month: walk.month })
    if (r) results.push({
      conditions: { year: walk.year, month: walk.month },
      conditionDescription: `${walk.year}年${walk.month}月の散歩回数`,
      ...r,
    })
  }

  // 5. 時間帯 × 累計距離（全期間）
  {
    const r = await distanceRank(supabase, userId, { time_of_day: walk.time_of_day })
    if (r) results.push({
      conditions: { time_of_day: walk.time_of_day },
      conditionDescription: `${TIME_LABELS[walk.time_of_day]}に歩いた累計距離`,
      ...r,
    })
  }

  // 条件が細かいもの（totalCount が少ない）を優先
  return results
    .filter(r => r.totalCount > 0)
    .sort((a, b) => a.totalCount - b.totalCount)
    .slice(0, 5)
}
