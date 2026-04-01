'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { WeatherCondition, TimeOfDayCategory } from '@/types/supabase'
import { generateAndSavePraise } from '@/app/actions/praise'

export type SaveWalkInput = {
  startedAt:        string   // ISO string
  endedAt:          string
  distanceMeters:   number
  timeOfDay:        TimeOfDayCategory
  weather:          WeatherCondition | null
  isPublic:         boolean
  routeCoordinates: [number, number][]  // [lng, lat]
}

export async function saveWalk(input: SaveWalkInput) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .maybeSingle()
  if (!profile) redirect('/auth/setup')

  // walk_records を INSERT
  const { data: record, error: recErr } = await supabase
    .from('walk_records')
    .insert({
      user_id:         profile.id,
      started_at:      input.startedAt,
      ended_at:        input.endedAt,
      distance_meters: input.distanceMeters,
      time_of_day:     input.timeOfDay,
      weather:         input.weather ?? undefined,
      is_public:       input.isPublic,
    })
    .select('id')
    .single()

  if (recErr) throw new Error(recErr.message)

  // walk_routes を INSERT
  if (input.routeCoordinates.length >= 2) {
    await supabase.from('walk_routes').insert({
      walk_record_id: record.id,
      route_geojson: {
        type: 'LineString',
        coordinates: input.routeCoordinates,
      },
    })
  }

  // walk_stats を upsert
  await updateWalkStats(supabase, profile.id, input)

  // 称えを非同期生成（失敗しても散歩保存はブロックしない）
  await generateAndSavePraise(record.id, profile.id)

  redirect(`/walk/result/${record.id}`)
}

async function updateWalkStats(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  input: SaveWalkInput,
) {
  const todayJST = new Date(
    new Date(input.endedAt).getTime() + 9 * 60 * 60 * 1000,
  ).toISOString().slice(0, 10)

  const yesterdayJST = new Date(
    new Date(input.endedAt).getTime() + 9 * 60 * 60 * 1000 - 86400000,
  ).toISOString().slice(0, 10)

  const { data: stats } = await supabase
    .from('walk_stats')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()

  const isToday     = stats?.last_walked_date === todayJST
  const isYesterday = stats?.last_walked_date === yesterdayJST

  const durationSec =
    (new Date(input.endedAt).getTime() - new Date(input.startedAt).getTime()) / 1000

  const newStreak = isToday
    ? (stats.current_streak_days ?? 1)
    : isYesterday
    ? (stats.current_streak_days ?? 0) + 1
    : 1

  const newStats = {
    user_id:                    userId,
    total_distance_meters:      (stats?.total_distance_meters  ?? 0) + input.distanceMeters,
    total_walks:                (stats?.total_walks            ?? 0) + 1,
    total_duration_seconds:     (stats?.total_duration_seconds ?? 0) + durationSec,
    this_month_distance_meters: (stats?.this_month_distance_meters ?? 0) + input.distanceMeters,
    this_month_walks:           (stats?.this_month_walks           ?? 0) + 1,
    today_distance_meters:      isToday
      ? (stats.today_distance_meters ?? 0) + input.distanceMeters
      : input.distanceMeters,
    today_walks:                isToday ? (stats.today_walks ?? 0) + 1 : 1,
    current_streak_days:        newStreak,
    longest_streak_days:        Math.max(stats?.longest_streak_days ?? 0, newStreak),
    last_walked_date:           todayJST,
    updated_at:                 new Date().toISOString(),
  }

  await supabase.from('walk_stats').upsert(newStats)
}
