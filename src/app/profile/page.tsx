import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDistance } from '@/lib/utils/geo'
import type { BadgeCategory } from '@/types/supabase'
import BottomNav from '@/app/components/BottomNav'

const CATEGORY_EMOJI: Record<BadgeCategory, string> = {
  streak:      '🔥',
  distance:    '📏',
  weather:     '⛅',
  time_of_day: '🕐',
  community:   '👥',
  course:      '🗺️',
  special:     '⭐',
}

const THUMB_BG = ['#E8F5EB', '#FEF9C3', '#DBEAFE', '#FFE4E1', '#EDE9FE']
const THUMB_EMOJI = ['🌸', '🌙', '🌳', '🐱', '🌊']

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

  // 並列取得
  const [statsRes, allBadgesRes, earnedRes, praisesRes, myPostsRes] = await Promise.all([
    supabase.from('walk_stats').select('*').eq('user_id', profile.id).maybeSingle(),
    supabase.from('badges').select('*').order('category').order('condition_value'),
    supabase.from('user_badges').select('badge_id, earned_at').eq('user_id', profile.id),
    supabase.from('praises').select('id, praise_text, created_at, is_pinned')
      .eq('user_id', profile.id)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(3),
    supabase.from('course_posts').select('id, title, nice_count, walk_record_id')
      .eq('user_id', profile.id)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(3),
  ])

  const stats      = statsRes.data
  const allBadges  = allBadgesRes.data ?? []
  const earnedMap  = new Map((earnedRes.data ?? []).map(r => [r.badge_id, r.earned_at]))
  const earnedCount = earnedMap.size
  const praises    = praisesRes.data ?? []
  const myPosts    = myPostsRes.data ?? []

  // 距離情報
  const recordIds = myPosts.map(p => p.walk_record_id).filter(Boolean) as string[]
  const { data: walkData } = recordIds.length
    ? await supabase.from('walk_records').select('id, distance_meters').in('id', recordIds)
    : { data: [] }
  const walkMap = new Map((walkData ?? []).map(w => [w.id, w]))

  const since = new Date(profile.created_at)
  const sinceStr = `${since.getFullYear()}年${since.getMonth() + 1}月から`

  return (
    <main
      className="min-h-screen flex flex-col max-w-sm mx-auto"
      style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}
    >
      {/* ヘッダー */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 20px 12px',
      }}>
        <h1 style={{
          fontFamily: "'Kaisei Decol', serif",
          fontSize: 22, fontWeight: 700, color: 'var(--ink)',
        }}>
          👤 マイページ
        </h1>
        <button style={{
          width: 38, height: 38,
          background: 'var(--surface)', border: '2.5px solid var(--ink)',
          borderRadius: 12, boxShadow: '2px 2px 0 var(--ink)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, cursor: 'pointer',
        }}>⚙️</button>
      </div>

      {/* プロフィールカード */}
      <div style={{ margin: '0 16px 20px' }}>
        <div style={{
          background: 'var(--surface)', border: '2.5px solid var(--ink)',
          borderRadius: 24, boxShadow: '4px 4px 0 var(--ink)',
          padding: '20px 16px 0',
        }}>
          {/* 上部: アバター + 名前 */}
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, marginBottom: 16 }}>
            {/* アバター */}
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{
                width: 68, height: 68, borderRadius: '50%',
                border: '3px solid var(--ink)', background: 'var(--yellow)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 32, overflow: 'hidden',
              }}>
                {profile.icon_url
                  ? <img src={profile.icon_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : '🚶'}
              </div>
              <div style={{
                position: 'absolute', bottom: -2, right: -2,
                width: 22, height: 22, background: 'var(--green)',
                border: '2px solid var(--ink)', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10,
              }}>✏️</div>
            </div>

            {/* テキスト */}
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--ink)', marginBottom: 4 }}>
                {profile.nickname}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 6 }}>
                🚶 {sinceStr}
              </div>
              {profile.bio && (
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ink-soft)', lineHeight: 1.4 }}>
                  {profile.bio}
                </div>
              )}
            </div>
          </div>

          {/* 3統計 */}
          {stats && (
            <div style={{
              display: 'flex',
              borderTop: '2px solid #F0E8DC',
              paddingTop: 14, paddingBottom: 16,
            }}>
              {[
                { value: formatDistance(stats.total_distance_meters), label: '累計距離' },
                { value: `${stats.total_walks}回`,                    label: '散歩した日' },
                { value: `${earnedCount}個`,                          label: 'バッジ' },
              ].map((item, i) => (
                <div key={item.label} style={{
                  flex: 1, textAlign: 'center',
                  borderRight: i < 2 ? '2px solid #F0E8DC' : 'none',
                }}>
                  <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--ink)' }}>{item.value}</div>
                  <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--ink-soft)', marginTop: 2 }}>{item.label}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 殿堂入り称え */}
      {praises.length > 0 && (
        <div style={{ margin: '0 16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: '0.05em' }}>🏆 殿堂入り称え</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {praises.map(praise => (
              <div key={praise.id} style={{
                background: 'var(--yellow)', border: '2.5px solid var(--ink)',
                borderRadius: 18, boxShadow: '3px 3px 0 var(--ink)',
                padding: '14px 16px',
                display: 'flex', alignItems: 'flex-start', gap: 10,
              }}>
                <span style={{ fontSize: 20, flexShrink: 0 }}>⭐</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.5 }}>
                    {praise.praise_text}
                  </div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-soft)', marginTop: 4 }}>
                    {new Date(praise.created_at).toLocaleDateString('ja-JP')}
                  </div>
                </div>
                <span style={{ fontSize: 14, flexShrink: 0, opacity: praise.is_pinned ? 1 : 0.4 }}>📌</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* バッジ */}
      <div style={{ margin: '0 16px 20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: '0.05em' }}>🏅 バッジ</span>
          <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--ink-soft)' }}>
            {earnedCount} / {allBadges.length}
          </span>
        </div>

        {/* カテゴリ別グリッド */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {(Object.keys(CATEGORY_EMOJI) as BadgeCategory[]).map(cat => {
            const badges = allBadges.filter(b => b.category === cat)
            if (badges.length === 0) return null
            const catEarned = badges.filter(b => earnedMap.has(b.id)).length

            return (
              <div key={cat}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                  <span style={{ fontSize: 14 }}>{CATEGORY_EMOJI[cat]}</span>
                  <span style={{ fontSize: 12, fontWeight: 900 }}>
                    {cat === 'streak' ? '連続記録' : cat === 'distance' ? '距離' : cat === 'weather' ? '天気' :
                     cat === 'time_of_day' ? '時間帯' : cat === 'community' ? 'コミュニティ' :
                     cat === 'course' ? 'コース' : 'スペシャル'}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)' }}>
                    {catEarned}/{badges.length}
                  </span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {badges.map(badge => {
                    const isEarned = earnedMap.has(badge.id)
                    const isSecret = badge.is_secret && !isEarned
                    return (
                      <div key={badge.id} style={{
                        background: isEarned ? 'var(--surface)' : '#F0EDE8',
                        border: isEarned ? '2.5px solid var(--ink)' : '2px solid #CCC',
                        borderRadius: 14,
                        boxShadow: isEarned ? '2px 2px 0 var(--ink)' : 'none',
                        padding: '10px 6px', textAlign: 'center',
                        opacity: isEarned ? 1 : 0.5,
                      }}>
                        <span style={{ fontSize: 22, display: 'block', marginBottom: 4 }}>
                          {isEarned ? (badge.icon_url || '🏅') : isSecret ? '🔒' : '🔒'}
                        </span>
                        <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.3 }}>
                          {isSecret ? '???' : badge.name}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* 投稿したコース */}
      {myPosts.length > 0 && (
        <div style={{ margin: '0 16px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: '0.05em' }}>🗺️ 投稿したコース</span>
            <Link href="/courses" style={{ fontSize: 11, fontWeight: 800, color: 'var(--green-dark)', textDecoration: 'none' }}>
              すべて見る
            </Link>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {myPosts.map((post, i) => {
              const walk = post.walk_record_id ? walkMap.get(post.walk_record_id) : null
              return (
                <Link key={post.id} href={`/courses/${post.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    background: 'var(--surface)', border: '2.5px solid var(--ink)',
                    borderRadius: 18, boxShadow: '3px 3px 0 var(--ink)',
                    padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12,
                  }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 12,
                      border: '2px solid var(--ink)',
                      background: THUMB_BG[i % THUMB_BG.length],
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 22, flexShrink: 0,
                    }}>
                      {THUMB_EMOJI[i % THUMB_EMOJI.length]}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--ink)', marginBottom: 3 }}>
                        {post.title}
                      </div>
                      {walk && (
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)' }}>
                          {formatDistance(walk.distance_meters)}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--ink-soft)', flexShrink: 0 }}>
                      👟 {post.nice_count}
                    </span>
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      <BottomNav />
    </main>
  )
}
