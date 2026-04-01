// バッジの条件チェック・付与ロジック
// saveWalk の後に呼び出し、新たに獲得したバッジを返す

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'

type BadgeRow = Database['public']['Tables']['badges']['Row']

export type EarnedBadge = Pick<BadgeRow, 'id' | 'slug' | 'name' | 'description' | 'category'>

// ── 条件別チェック関数 ───────────────────────────────────────────

function checkCondition(
  type: string,
  conditionValue: number | null,
  ctx: BadgeContext,
): boolean {
  const v = conditionValue ?? 0
  switch (type) {
    case 'streak_days':
      return ctx.currentStreak >= v
    case 'total_distance':
      return ctx.totalDistanceMeters >= v
    case 'walk_in_rain':
      return ctx.rainyWalks >= v
    case 'walk_in_snow':
      return ctx.snowyWalks >= v
    case 'walk_at_midnight':
      return ctx.midnightWalks >= v
    case 'walk_in_morning':
      return ctx.morningWalks >= v
    case 'walk_at_night':
      return ctx.nightWalks >= v
    case 'course_post_count':
      return ctx.coursePostCount >= v
    case 'nice_received':
      return ctx.totalNiceReceived >= v
    case 'favorite_received':
      return ctx.favoriteReceivedCount >= v
    case 'unique_courses_walked':
      return ctx.uniqueCoursesWalked >= v
    case 'all_weather_types':
      return ctx.distinctWeatherCount >= 6
    case 'all_time_categories':
      return ctx.distinctTimeCount >= 5
    default:
      return false
  }
}

// ── コンテキストを一括取得 ─────────────────────────────────────

type BadgeContext = {
  currentStreak: number
  totalDistanceMeters: number
  rainyWalks: number
  snowyWalks: number
  midnightWalks: number
  morningWalks: number
  nightWalks: number
  distinctWeatherCount: number
  distinctTimeCount: number
  coursePostCount: number
  totalNiceReceived: number
  favoriteReceivedCount: number
  uniqueCoursesWalked: number
}

async function buildContext(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<BadgeContext> {
  // 並列でデータ取得
  const [
    statsRes,
    walkWeatherRes,
    walkTimeRes,
    coursePostRes,
    niceSumRes,
    favRes,
    courseWalkRes,
  ] = await Promise.all([
    supabase
      .from('walk_stats')
      .select('current_streak_days, total_distance_meters')
      .eq('user_id', userId)
      .maybeSingle(),

    supabase
      .from('walk_records')
      .select('weather')
      .eq('user_id', userId)
      .not('weather', 'is', null),

    supabase
      .from('walk_records')
      .select('time_of_day')
      .eq('user_id', userId),

    supabase
      .from('course_posts')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),

    supabase
      .from('course_posts')
      .select('nice_count')
      .eq('user_id', userId),

    supabase
      .from('favorite_sanposters')
      .select('id', { count: 'exact', head: true })
      .eq('target_user_id', userId),

    supabase
      .from('course_walks')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId),
  ])

  const stats            = statsRes.data
  const weatherWalks     = walkWeatherRes.data ?? []
  const timeWalks        = walkTimeRes.data ?? []
  const niceRows         = niceSumRes.data ?? []

  const weatherCounts    = countBy(weatherWalks, w => w.weather as string)
  const timeCounts       = countBy(timeWalks, w => w.time_of_day as string)

  return {
    currentStreak:        stats?.current_streak_days  ?? 0,
    totalDistanceMeters:  stats?.total_distance_meters ?? 0,
    rainyWalks:           weatherCounts['rainy']      ?? 0,
    snowyWalks:           weatherCounts['snowy']      ?? 0,
    midnightWalks:        timeCounts['midnight']       ?? 0,
    morningWalks:         timeCounts['morning']        ?? 0,
    nightWalks:           timeCounts['night']          ?? 0,
    distinctWeatherCount: Object.keys(weatherCounts).length,
    distinctTimeCount:    Object.keys(timeCounts).length,
    coursePostCount:      coursePostRes.count           ?? 0,
    totalNiceReceived:    niceRows.reduce((s, r) => s + (r.nice_count ?? 0), 0),
    favoriteReceivedCount: favRes.count                ?? 0,
    uniqueCoursesWalked:  courseWalkRes.count           ?? 0,
  }
}

function countBy<T>(arr: T[], keyFn: (item: T) => string): Record<string, number> {
  return arr.reduce((acc, item) => {
    const k = keyFn(item)
    if (k) acc[k] = (acc[k] ?? 0) + 1
    return acc
  }, {} as Record<string, number>)
}

// ── 公開 API ──────────────────────────────────────────────────

export async function checkAndAwardBadges(
  supabase: SupabaseClient<Database>,
  userId: string,
): Promise<EarnedBadge[]> {
  // 全バッジ定義 + 既取得バッジIDを並列取得
  const [allBadgesRes, earnedRes] = await Promise.all([
    supabase.from('badges').select('*'),
    supabase.from('user_badges').select('badge_id').eq('user_id', userId),
  ])

  const allBadges   = allBadgesRes.data ?? []
  const earnedIds   = new Set((earnedRes.data ?? []).map(r => r.badge_id))
  const unearned    = allBadges.filter(b => !earnedIds.has(b.id))

  if (unearned.length === 0) return []

  // コンテキスト取得
  const ctx = await buildContext(supabase, userId)

  // 条件を満たすバッジを収集
  const newBadges = unearned.filter(b =>
    checkCondition(b.condition_type, b.condition_value, ctx),
  )

  if (newBadges.length === 0) return []

  // user_badges へ INSERT（重複は無視）
  await supabase.from('user_badges').insert(
    newBadges.map(b => ({ user_id: userId, badge_id: b.id })),
  )

  return newBadges.map(({ id, slug, name, description, category }) => ({
    id, slug, name, description, category,
  }))
}
