import type { TimeOfDayCategory } from '@/types/supabase'

/** ハバーサイン式で2点間の距離（メートル）を返す */
export function haversineDistance(
  lat1: number, lon1: number,
  lat2: number, lon2: number,
): number {
  const R = 6371000
  const φ1 = (lat1 * Math.PI) / 180
  const φ2 = (lat2 * Math.PI) / 180
  const Δφ = ((lat2 - lat1) * Math.PI) / 180
  const Δλ = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** 時刻から時間帯カテゴリを返す */
export function getTimeOfDay(date: Date): TimeOfDayCategory {
  const h = date.getHours()
  if (h >= 5  && h < 10) return 'morning'
  if (h >= 10 && h < 16) return 'daytime'
  if (h >= 16 && h < 20) return 'evening'
  if (h >= 20)           return 'night'
  return 'midnight' // 0–4
}

/** 秒数を HH:MM:SS 形式に変換 */
export function formatDuration(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

/** メートルを km 表示に変換 */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters} m`
  return `${(meters / 1000).toFixed(2)} km`
}
