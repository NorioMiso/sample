import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { signOut } from '@/app/actions/auth'
import { formatDistance, formatDuration } from '@/lib/utils/geo'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('users')
    .select('id, nickname, icon_url')
    .eq('auth_id', user.id)
    .maybeSingle()
  if (!profile) redirect('/auth/setup')

  const { data: stats } = await supabase
    .from('walk_stats')
    .select('*')
    .eq('user_id', profile.id)
    .maybeSingle()

  const { data: recentWalks } = await supabase
    .from('walk_records')
    .select('id, walked_date, distance_meters, duration_seconds, weather, time_of_day')
    .eq('user_id', profile.id)
    .order('started_at', { ascending: false })
    .limit(5)

  const WEATHER_ICON: Record<string, string> = {
    sunny: '☀️', cloudy: '☁️', rainy: '🌧️',
    snowy: '🌨️', foggy: '🌫️', windy: '💨',
  }

  return (
    <main className="min-h-screen flex flex-col p-4 gap-5 max-w-sm mx-auto">

      {/* ヘッダー */}
      <div className="flex items-center justify-between pt-4">
        <h1 className="text-2xl font-black">sanpostar</h1>
        <form action={signOut}>
          <button type="submit" className="nb-btn nb-btn-white text-xs py-1 px-3">
            ログアウト
          </button>
        </form>
      </div>

      {/* プロフィール */}
      <div className="nb-card p-4 flex items-center gap-3">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-xl shrink-0"
          style={{
            background: profile.icon_url ? 'transparent' : 'var(--yellow)',
            border: '2px solid black',
          }}
        >
          {profile.icon_url
            ? <img src={profile.icon_url} alt="" className="w-full h-full rounded-full object-cover" />
            : '🚶'}
        </div>
        <div>
          <p className="font-black">{profile.nickname}</p>
          <p className="text-xs font-semibold text-gray-500">sanpostar</p>
        </div>
      </div>

      {/* 統計 */}
      {stats ? (
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: '累計距離', value: `${(stats.total_distance_meters / 1000).toFixed(1)} km` },
            { label: '散歩回数', value: `${stats.total_walks} 回` },
            { label: '連続日数', value: `${stats.current_streak_days} 日` },
          ].map(item => (
            <div key={item.label} className="nb-card p-3 text-center"
                 style={{ background: 'var(--yellow)' }}>
              <p className="text-xs font-bold text-gray-600 mb-1">{item.label}</p>
              <p className="text-base font-black">{item.value}</p>
            </div>
          ))}
        </div>
      ) : (
        <div className="nb-card p-4 text-center"
             style={{ background: 'var(--bg)' }}>
          <p className="text-sm font-semibold text-gray-500">
            まだ散歩の記録がありません。さあ歩きましょう！
          </p>
        </div>
      )}

      {/* 散歩開始ボタン */}
      <Link
        href="/walk"
        className="nb-btn nb-btn-coral w-full justify-center"
        style={{ fontSize: '1.1rem', padding: '0.9rem' }}
      >
        🚶 散歩をはじめる
      </Link>

      {/* コース一覧 */}
      <Link
        href="/courses"
        className="nb-btn nb-btn-green w-full justify-center"
        style={{ fontSize: '1rem', padding: '0.75rem' }}
      >
        🗺️ みんなのコースを見る
      </Link>

      {/* 最近の散歩 */}
      {recentWalks && recentWalks.length > 0 && (
        <div>
          <h2 className="font-black text-sm mb-2">最近の散歩</h2>
          <div className="flex flex-col gap-2">
            {recentWalks.map(walk => (
              <div key={walk.id} className="nb-card p-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xl">
                    {walk.weather ? WEATHER_ICON[walk.weather] ?? '🚶' : '🚶'}
                  </span>
                  <div>
                    <p className="text-xs font-bold text-gray-500">{walk.walked_date}</p>
                    <p className="font-black text-sm">
                      {formatDistance(walk.distance_meters)}
                    </p>
                  </div>
                </div>
                <p className="text-sm font-bold text-gray-500">
                  {formatDuration(walk.duration_seconds)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </main>
  )
}
