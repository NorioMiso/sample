import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { formatDuration, formatDistance } from '@/lib/utils/geo'

type Props = { params: Promise<{ id: string }> }

const WEATHER_ICON: Record<string, string> = {
  sunny: '☀️', cloudy: '☁️', rainy: '🌧️',
  snowy: '🌨️', foggy: '🌫️', windy: '💨',
}

export default async function WalkResultPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: record } = await supabase
    .from('walk_records')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!record) notFound()

  const { data: stats } = await supabase
    .from('walk_stats')
    .select('total_distance_meters, total_walks, current_streak_days')
    .eq('user_id', record.user_id)
    .maybeSingle()

  const { data: praise } = await supabase
    .from('praises')
    .select('praise_text, rank, total_count')
    .eq('walk_record_id', id)
    .maybeSingle()

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 gap-6">
      <div className="text-center">
        <div className="text-5xl mb-3">🎉</div>
        <h2 className="text-2xl font-black">記録しました！</h2>
      </div>

      {/* AI称え */}
      {praise && (
        <div
          className="nb-card p-5 w-full max-w-sm"
          style={{ background: 'var(--green)' }}
        >
          <p className="text-xs font-black text-gray-700 mb-2">✨ 今日の称え</p>
          <p className="font-black text-base leading-relaxed">{praise.praise_text}</p>
          {praise.rank && praise.total_count && (
            <p className="text-xs font-semibold text-gray-600 mt-2 text-right">
              {praise.rank}位 / {praise.total_count}人中
            </p>
          )}
        </div>
      )}

      {/* 今回の記録 */}
      <div className="nb-card p-5 w-full max-w-sm">
        <h3 className="font-black text-sm text-gray-500 mb-3">今回の散歩</h3>
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-xs font-bold text-gray-400 mb-1">距離</p>
            <p className="text-2xl font-black">
              {formatDistance(record.distance_meters)}
            </p>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 mb-1">時間</p>
            <p className="text-2xl font-black">
              {formatDuration(record.duration_seconds)}
            </p>
          </div>
          {record.weather && (
            <div className="col-span-2">
              <p className="text-xs font-bold text-gray-400 mb-1">天気</p>
              <p className="text-2xl">{WEATHER_ICON[record.weather] ?? '—'}</p>
            </div>
          )}
        </div>
      </div>

      {/* 累計 */}
      {stats && (
        <div className="nb-card p-5 w-full max-w-sm"
             style={{ background: 'var(--yellow)' }}>
          <h3 className="font-black text-sm mb-3">累計記録</h3>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <p className="text-xs font-bold text-gray-600 mb-1">合計距離</p>
              <p className="text-lg font-black">
                {(stats.total_distance_meters / 1000).toFixed(1)}<span className="text-xs">km</span>
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-600 mb-1">散歩回数</p>
              <p className="text-lg font-black">
                {stats.total_walks}<span className="text-xs">回</span>
              </p>
            </div>
            <div>
              <p className="text-xs font-bold text-gray-600 mb-1">連続日数</p>
              <p className="text-lg font-black">
                {stats.current_streak_days}<span className="text-xs">日</span>
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 w-full max-w-sm">
        <Link
          href={`/courses/new?walk_record_id=${id}`}
          className="nb-btn nb-btn-green w-full justify-center"
        >
          🗺️ このコースをシェアする
        </Link>
        <Link href="/walk" className="nb-btn nb-btn-coral w-full justify-center">
          もう一度歩く 🚶
        </Link>
        <Link href="/" className="nb-btn nb-btn-white w-full justify-center text-sm">
          ホームへ戻る
        </Link>
      </div>
    </main>
  )
}
