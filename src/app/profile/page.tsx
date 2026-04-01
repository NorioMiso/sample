import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDistance } from '@/lib/utils/geo'
import type { BadgeCategory } from '@/types/supabase'

const CATEGORY_LABEL: Record<BadgeCategory, string> = {
  streak:      '連続記録',
  distance:    '距離',
  weather:     '天気',
  time_of_day: '時間帯',
  community:   'コミュニティ',
  course:      'コース',
  special:     'スペシャル',
}

const CATEGORY_EMOJI: Record<BadgeCategory, string> = {
  streak:      '🔥',
  distance:    '📏',
  weather:     '⛅',
  time_of_day: '🕐',
  community:   '👥',
  course:      '🗺️',
  special:     '⭐',
}

export default async function ProfilePage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('users')
    .select('id, nickname, icon_url, bio, created_at')
    .eq('auth_id', user.id)
    .maybeSingle()
  if (!profile) redirect('/auth/setup')

  const { data: stats } = await supabase
    .from('walk_stats')
    .select('*')
    .eq('user_id', profile.id)
    .maybeSingle()

  // 全バッジ定義 + 獲得バッジ
  const [allBadgesRes, earnedRes] = await Promise.all([
    supabase.from('badges').select('*').order('category').order('condition_value'),
    supabase.from('user_badges').select('badge_id, earned_at').eq('user_id', profile.id),
  ])

  const allBadges = allBadgesRes.data ?? []
  const earnedMap = new Map(
    (earnedRes.data ?? []).map(r => [r.badge_id, r.earned_at]),
  )
  const earnedCount = earnedMap.size

  // カテゴリ別にグループ化
  const byCategory = allBadges.reduce((acc, badge) => {
    if (!acc[badge.category]) acc[badge.category] = []
    acc[badge.category].push(badge)
    return acc
  }, {} as Record<string, typeof allBadges>)

  const categories = Object.keys(byCategory) as BadgeCategory[]

  return (
    <main className="min-h-screen flex flex-col p-4 gap-5 max-w-sm mx-auto pb-10">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 pt-4">
        <Link href="/" className="text-sm font-bold">← ホーム</Link>
        <h1 className="text-xl font-black">プロフィール</h1>
      </div>

      {/* ユーザーカード */}
      <div className="nb-card p-5 flex items-center gap-4">
        <div
          className="w-16 h-16 rounded-full flex items-center justify-center text-2xl shrink-0"
          style={{ background: 'var(--yellow)', border: '2px solid black' }}
        >
          {profile.icon_url
            ? <img src={profile.icon_url} alt="" className="w-full h-full rounded-full object-cover" />
            : '🚶'}
        </div>
        <div className="flex-1">
          <p className="font-black text-lg">{profile.nickname}</p>
          {profile.bio && <p className="text-xs text-gray-500 mt-0.5">{profile.bio}</p>}
          <p className="text-xs text-gray-400 mt-1">
            {new Date(profile.created_at).toLocaleDateString('ja-JP')} から歩いています
          </p>
        </div>
      </div>

      {/* 統計 */}
      {stats && (
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: '累計距離',   value: formatDistance(stats.total_distance_meters) },
            { label: '散歩回数',   value: `${stats.total_walks} 回` },
            { label: '最長連続',   value: `${stats.longest_streak_days} 日` },
            { label: '現在連続',   value: `${stats.current_streak_days} 日` },
          ].map(item => (
            <div key={item.label} className="nb-card p-3 text-center"
                 style={{ background: 'var(--bg)' }}>
              <p className="text-xs font-bold text-gray-500 mb-1">{item.label}</p>
              <p className="font-black">{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* バッジコレクション */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-black">バッジ</h2>
          <span className="text-sm font-bold text-gray-500">
            {earnedCount} / {allBadges.length} 獲得
          </span>
        </div>

        <div className="flex flex-col gap-4">
          {categories.map(cat => {
            const badges = byCategory[cat]
            const catEarned = badges.filter(b => earnedMap.has(b.id)).length
            return (
              <div key={cat}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">{CATEGORY_EMOJI[cat]}</span>
                  <span className="font-black text-sm">{CATEGORY_LABEL[cat]}</span>
                  <span className="text-xs text-gray-400 font-semibold">
                    {catEarned}/{badges.length}
                  </span>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {badges.map(badge => {
                    const earnedAt = earnedMap.get(badge.id)
                    const isEarned = !!earnedAt
                    const isSecret = badge.is_secret && !isEarned

                    return (
                      <div
                        key={badge.id}
                        className="nb-card p-3 flex items-center gap-3"
                        style={{
                          background: isEarned ? 'var(--yellow)' : 'var(--bg)',
                          opacity:    isEarned ? 1 : 0.5,
                        }}
                      >
                        <span className="text-2xl shrink-0">{isEarned ? '🏅' : '🔒'}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-black text-sm">
                            {isSecret ? '????' : badge.name}
                          </p>
                          <p className="text-xs text-gray-600 leading-snug">
                            {isSecret ? 'まだ未解除のシークレットバッジです' : badge.description}
                          </p>
                        </div>
                        {isEarned && earnedAt && (
                          <span className="text-xs text-gray-500 shrink-0">
                            {new Date(earnedAt).toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' })}
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </main>
  )
}
