import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import NewCourseForm from './NewCourseForm'
import { formatDistance, formatDuration } from '@/lib/utils/geo'

type Props = { searchParams: Promise<{ walk_record_id?: string }> }

const WEATHER_ICON: Record<string, string> = {
  sunny: '☀️', cloudy: '☁️', rainy: '🌧️',
  snowy: '🌨️', foggy: '🌫️', windy: '💨',
}

export default async function NewCoursePage({ searchParams }: Props) {
  const { walk_record_id } = await searchParams
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .maybeSingle()
  if (!profile) redirect('/auth/setup')

  // 指定された散歩記録を取得（所有者チェック含む）
  let walk = null
  if (walk_record_id) {
    const { data } = await supabase
      .from('walk_records')
      .select('id, distance_meters, duration_seconds, weather, walked_date')
      .eq('id', walk_record_id)
      .eq('user_id', profile.id)
      .maybeSingle()
    if (!data) notFound()
    walk = data
  }

  return (
    <main className="min-h-screen flex flex-col p-4 gap-5 max-w-sm mx-auto">
      <div className="flex items-center gap-3 pt-4">
        <Link href={walk_record_id ? `/walk/result/${walk_record_id}` : '/'}
              className="text-sm font-bold">
          ←
        </Link>
        <h1 className="text-xl font-black">コースをシェア</h1>
      </div>

      {/* 散歩サマリー */}
      {walk && (
        <div className="nb-card p-4 flex items-center gap-4"
             style={{ background: 'var(--green)' }}>
          <span className="text-2xl">
            {walk.weather ? WEATHER_ICON[walk.weather] ?? '🚶' : '🚶'}
          </span>
          <div>
            <p className="text-xs font-bold text-gray-600">{walk.walked_date}</p>
            <p className="font-black">
              {formatDistance(walk.distance_meters)} ·{' '}
              {formatDuration(walk.duration_seconds)}
            </p>
          </div>
        </div>
      )}

      <NewCourseForm walkRecordId={walk_record_id ?? null} />
    </main>
  )
}
