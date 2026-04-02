import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { signOut } from '@/app/actions/auth'
import { formatDistance } from '@/lib/utils/geo'
import BottomNav from '@/app/components/BottomNav'

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

  // 未読通知数
  const { count: unreadCount } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', profile.id)
    .eq('is_read', false)

  // 最新の称え
  const { data: latestPraise } = await supabase
    .from('praises')
    .select('praise_text, rank, total_count')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  // 最近取得したバッジ（最新4件）
  const { data: recentBadges } = await supabase
    .from('user_badges')
    .select('badge_id, earned_at, badges(name, category)')
    .eq('user_id', profile.id)
    .order('earned_at', { ascending: false })
    .limit(4)

  // 今月の統計
  const now = new Date()
  const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`

  const BADGE_EMOJI: Record<string, string> = {
    streak: '🔥', distance: '👣', weather: '⛅',
    time_of_day: '🕐', community: '👥', course: '🗺️', special: '⭐',
  }

  const todayKm = stats
    ? (stats.today_distance_meters / 1000).toFixed(1)
    : '0.0'
  const monthKm = stats
    ? (stats.this_month_distance_meters / 1000).toFixed(1)
    : '0.0'
  const totalKm = stats
    ? (stats.total_distance_meters / 1000).toFixed(0)
    : '0'

  return (
    <main className="min-h-screen has-bottom-nav max-w-sm mx-auto">

      {/* ヘッダー */}
      <div className="flex items-center justify-between px-5 pt-5 pb-3">
        <div className="flex items-center gap-2">
          <div
            style={{
              width: 28, height: 28,
              background: 'var(--yellow)',
              border: '2px solid var(--ink)',
              borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 14,
              animation: 'spin 4s linear infinite',
              boxShadow: '2px 2px 0 var(--ink)',
            }}
          >⭐</div>
          <h1
            className="font-display"
            style={{ fontSize: 24, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em' }}
          >
            サンポスター
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/notifications" className="relative p-1">
            <span style={{ fontSize: 20 }}>🔔</span>
            {!!unreadCount && unreadCount > 0 && (
              <span
                className="absolute top-0 right-0 text-white font-black rounded-full flex items-center justify-center"
                style={{
                  background: 'var(--coral)',
                  minWidth: '1rem', height: '1rem',
                  fontSize: '0.55rem',
                  border: '1.5px solid var(--ink)',
                }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </Link>
          <Link href="/profile">
            <div
              style={{
                width: 38, height: 38,
                borderRadius: '50%',
                background: profile.icon_url ? 'transparent' : 'var(--yellow)',
                border: '2.5px solid var(--ink)',
                boxShadow: '2px 2px 0 var(--ink)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, overflow: 'hidden',
              }}
            >
              {profile.icon_url
                ? <img src={profile.icon_url} alt="" className="w-full h-full object-cover" />
                : '🚶'}
            </div>
          </Link>
        </div>
      </div>

      <div className="flex flex-col gap-3 px-4 pb-4">

        {/* 最新の称え */}
        {latestPraise ? (
          <div
            style={{
              background: 'var(--yellow)',
              border: '3px solid var(--ink)',
              borderRadius: 24,
              padding: '18px 20px',
              boxShadow: '5px 5px 0 var(--ink)',
            }}
          >
            <div className="flex gap-1 mb-2">
              {['⭐','⭐','⭐'].map((s, i) => (
                <span key={i} style={{ fontSize: 13, display: 'inline-block', animation: `twinkle 1.5s ${i * 0.3}s ease-in-out infinite` }}>{s}</span>
              ))}
            </div>
            <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.15em', color: 'var(--ink)', opacity: 0.6, marginBottom: 8 }}>
              今日のあなた
            </p>
            <p style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.5, color: 'var(--ink)' }}>
              {latestPraise.praise_text}
            </p>
            {latestPraise.rank && latestPraise.total_count && (
              <div className="flex gap-2 mt-3 flex-wrap">
                <span
                  style={{
                    background: 'white', border: '2px solid var(--ink)',
                    borderRadius: 20, padding: '3px 10px',
                    fontSize: 11, fontWeight: 800,
                  }}
                >
                  {latestPraise.rank}位 / {latestPraise.total_count}人中
                </span>
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              background: 'var(--yellow)',
              border: '3px solid var(--ink)',
              borderRadius: 24,
              padding: '18px 20px',
              boxShadow: '5px 5px 0 var(--ink)',
            }}
          >
            <p style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.15em', opacity: 0.6, marginBottom: 8 }}>
              今日のあなた
            </p>
            <p style={{ fontSize: 15, fontWeight: 800, lineHeight: 1.5 }}>
              さあ、今日も歩き出しましょう！<br />
              <span style={{ fontSize: 13, fontWeight: 700, opacity: 0.7 }}>散歩を記録すると称えが届きます ⭐</span>
            </p>
          </div>
        )}

        {/* 今日・連続・累計 */}
        <div className="grid grid-cols-3 gap-2">
          <div
            style={{
              background: 'var(--surface)', border: '2.5px solid var(--ink)',
              borderRadius: 18, boxShadow: '3px 3px 0 var(--ink)',
              padding: '12px 8px', textAlign: 'center',
            }}
          >
            <span style={{ fontSize: 18, display: 'block', marginBottom: 4 }}>🚶</span>
            <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1 }}>{todayKm}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-soft)', marginTop: 2 }}>今日 km</div>
          </div>
          <div
            style={{
              background: 'var(--coral)', border: '2.5px solid var(--ink)',
              borderRadius: 18, boxShadow: '3px 3px 0 var(--ink)',
              padding: '12px 8px', textAlign: 'center',
            }}
          >
            <span style={{ fontSize: 18, display: 'block', marginBottom: 4 }}>🔥</span>
            <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1, color: 'white' }}>
              {stats?.current_streak_days ?? 0}
            </div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>日連続</div>
          </div>
          <div
            style={{
              background: 'var(--blue)', border: '2.5px solid var(--ink)',
              borderRadius: 18, boxShadow: '3px 3px 0 var(--ink)',
              padding: '12px 8px', textAlign: 'center',
            }}
          >
            <span style={{ fontSize: 18, display: 'block', marginBottom: 4 }}>👣</span>
            <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1, color: 'white' }}>{totalKm}</div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>累計 km</div>
          </div>
        </div>

        {/* 今月の歩き */}
        {stats && (
          <div
            style={{
              background: 'var(--surface)', border: '2.5px solid var(--ink)',
              borderRadius: 20, boxShadow: '3px 3px 0 var(--ink)',
              padding: '16px 18px',
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <p style={{ fontSize: 13, fontWeight: 900 }}>今月の歩き</p>
              <span
                style={{
                  background: 'var(--green)', border: '2px solid var(--ink)',
                  borderRadius: 20, padding: '2px 10px',
                  fontSize: 11, fontWeight: 800,
                }}
              >
                {now.getMonth() + 1}月
              </span>
            </div>
            <div
              style={{
                background: '#F0E8DC', borderRadius: 8,
                height: 10, marginBottom: 12,
                overflow: 'hidden', border: '2px solid var(--ink)',
              }}
            >
              <div
                style={{
                  height: '100%',
                  background: 'linear-gradient(90deg, var(--green) 0%, #9EE86F 100%)',
                  borderRadius: 6,
                  width: `${Math.min(100, (stats.this_month_distance_meters / 50000) * 100)}%`,
                  minWidth: stats.this_month_distance_meters > 0 ? '4px' : '0',
                }}
              />
            </div>
            <div className="flex justify-around">
              {[
                { value: `${monthKm}km`, label: '合計' },
                { value: `${stats.this_month_walks}回`, label: '散歩した日' },
                {
                  value: stats.this_month_walks > 0
                    ? `${(stats.this_month_distance_meters / stats.this_month_walks / 1000).toFixed(1)}km`
                    : '—',
                  label: '平均',
                },
              ].map(item => (
                <div key={item.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 15, fontWeight: 900 }}>{item.value}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ink-soft)' }}>{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 散歩をはじめる */}
        <Link
          href="/walk"
          className="nb-btn nb-btn-green w-full justify-center"
          style={{ fontSize: '1.05rem', padding: '1rem', borderRadius: 20 }}
        >
          🚶 散歩をはじめる
        </Link>

        {/* 最近のバッジ */}
        {recentBadges && recentBadges.length > 0 && (
          <div>
            <div className="section-header">
              <span className="section-title">🏅 最近のバッジ</span>
              <Link href="/profile" className="section-link">すべて →</Link>
            </div>
            <div className="grid grid-cols-4 gap-2">
              {recentBadges.map((ub, i) => {
                const badge = Array.isArray(ub.badges) ? ub.badges[0] : ub.badges
                const isNew = i === 0 &&
                  new Date(ub.earned_at).getTime() > Date.now() - 24 * 60 * 60 * 1000
                return (
                  <div
                    key={ub.badge_id}
                    style={{
                      background: isNew ? 'var(--yellow)' : 'var(--surface)',
                      border: '2.5px solid var(--ink)',
                      borderRadius: 14,
                      boxShadow: '2px 2px 0 var(--ink)',
                      padding: '10px 6px',
                      textAlign: 'center',
                    }}
                  >
                    <span style={{ fontSize: 22, display: 'block', marginBottom: 5 }}>
                      {badge ? BADGE_EMOJI[badge.category] ?? '🏅' : '🏅'}
                    </span>
                    <div style={{ fontSize: 9, fontWeight: 800, lineHeight: 1.3 }}>
                      {badge?.name ?? ''}
                    </div>
                    {isNew && (
                      <span
                        style={{
                          display: 'inline-block',
                          background: 'var(--coral)', color: 'white',
                          fontSize: 8, fontWeight: 900,
                          padding: '1px 5px', borderRadius: 4, marginTop: 3,
                          border: '1.5px solid var(--ink)',
                        }}
                      >
                        NEW
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

      </div>

      {/* ログアウト（小さく） */}
      <div className="px-4 pb-2 flex justify-end">
        <form action={signOut}>
          <button type="submit" className="nb-btn nb-btn-white text-xs py-1 px-3" style={{ fontSize: 11 }}>
            ログアウト
          </button>
        </form>
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes twinkle {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.3) rotate(10deg); }
        }
      `}</style>

      <BottomNav />
    </main>
  )
}
