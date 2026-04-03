import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { formatDuration, formatDistance } from '@/lib/utils/geo'

type Props = { params: Promise<{ id: string }> }

const WEATHER_ICON: Record<string, string> = {
  sunny: '☀️', cloudy: '☁️', rainy: '🌧️',
  snowy: '🌨️', foggy: '🌫️', windy: '💨',
}

const WEATHER_LABEL: Record<string, string> = {
  sunny: '晴れ', cloudy: '曇り', rainy: '雨',
  snowy: '雪', foggy: '霧', windy: '風',
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

  const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString()
  const { data: newBadges } = await supabase
    .from('user_badges')
    .select('badge_id, earned_at, badges(slug, name, description)')
    .eq('user_id', record.user_id)
    .gte('earned_at', twoMinutesAgo)

  return (
    <main
      className="min-h-screen flex flex-col max-w-sm mx-auto"
      style={{ padding: '0 16px calc(32px + env(safe-area-inset-bottom))' }}
    >
      {/* ヘッダー */}
      <div style={{ padding: '20px 4px 16px', textAlign: 'center' }}>
        <div style={{ fontSize: 52, marginBottom: 8 }}>🎉</div>
        <h1 style={{
          fontFamily: "'Kaisei Decol', serif",
          fontSize: 24, fontWeight: 700, color: 'var(--ink)',
        }}>
          さんぽ完了！
        </h1>
      </div>

      {/* AI称え */}
      {praise && (
        <div style={{
          background: 'var(--green)', border: '2.5px solid var(--ink)',
          borderRadius: 20, boxShadow: '4px 4px 0 var(--ink)',
          padding: '18px 16px', marginBottom: 14,
        }}>
          <p style={{ fontSize: 11, fontWeight: 900, color: '#166534', letterSpacing: '0.08em', marginBottom: 8 }}>
            ✨ 今日の称え
          </p>
          <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--ink)', lineHeight: 1.6 }}>
            {praise.praise_text}
          </p>
          {praise.rank && praise.total_count && (
            <p style={{ fontSize: 11, fontWeight: 700, color: '#166534', marginTop: 8, textAlign: 'right' }}>
              {praise.rank}位 / {praise.total_count}人中
            </p>
          )}
        </div>
      )}

      {/* 新バッジ */}
      {newBadges && newBadges.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {newBadges.map(ub => {
            const badge = Array.isArray(ub.badges) ? ub.badges[0] : ub.badges
            if (!badge) return null
            return (
              <div key={ub.badge_id} style={{
                background: 'var(--yellow)', border: '2.5px solid var(--ink)',
                borderRadius: 18, boxShadow: '3px 3px 0 var(--ink)',
                padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <span style={{ fontSize: 32 }}>🏅</span>
                <div>
                  <p style={{ fontSize: 10, fontWeight: 900, color: 'var(--ink-soft)', marginBottom: 2 }}>バッジ獲得！</p>
                  <p style={{ fontSize: 15, fontWeight: 900, color: 'var(--ink)' }}>{badge.name}</p>
                  <p style={{ fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)' }}>{badge.description}</p>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* 今回の記録 */}
      <div style={{
        background: 'var(--surface)', border: '2.5px solid var(--ink)',
        borderRadius: 20, boxShadow: '4px 4px 0 var(--ink)',
        padding: '18px 16px', marginBottom: 14,
      }}>
        <p style={{ fontSize: 11, fontWeight: 900, color: 'var(--ink-soft)', letterSpacing: '0.08em', marginBottom: 14 }}>
          今回のさんぽ
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, textAlign: 'center' }}>
          {[
            { label: '距離', value: formatDistance(record.distance_meters) },
            { label: '時間', value: formatDuration(record.duration_seconds) },
          ].map(item => (
            <div key={item.label} style={{
              background: 'var(--bg)', border: '2px solid #F0E8DC', borderRadius: 14, padding: 12,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--ink)' }}>{item.value}</div>
            </div>
          ))}
        </div>
        {record.weather && (
          <div style={{ marginTop: 12, textAlign: 'center' }}>
            <span style={{ fontSize: 28 }}>{WEATHER_ICON[record.weather]}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink-soft)', marginLeft: 6 }}>
              {WEATHER_LABEL[record.weather]}
            </span>
          </div>
        )}
      </div>

      {/* 累計 */}
      {stats && (
        <div style={{
          background: 'var(--yellow)', border: '2.5px solid var(--ink)',
          borderRadius: 20, boxShadow: '4px 4px 0 var(--ink)',
          padding: '18px 16px', marginBottom: 20,
        }}>
          <p style={{ fontSize: 11, fontWeight: 900, color: 'var(--ink-soft)', letterSpacing: '0.08em', marginBottom: 14 }}>
            累計きろく
          </p>
          <div style={{ display: 'flex', textAlign: 'center' }}>
            {[
              { label: '合計距離',  value: `${(stats.total_distance_meters / 1000).toFixed(1)}km` },
              { label: '散歩回数',  value: `${stats.total_walks}回` },
              { label: '連続日数',  value: `${stats.current_streak_days}🔥` },
            ].map((item, i) => (
              <div key={item.label} style={{
                flex: 1,
                borderRight: i < 2 ? '2px solid rgba(26,26,46,0.2)' : 'none',
              }}>
                <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--ink)' }}>{item.value}</div>
                <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--ink-soft)', marginTop: 2 }}>{item.label}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* アクション */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <Link href={`/courses/new?walk_record_id=${id}`} style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '16px', background: 'var(--green)',
          border: '2.5px solid var(--ink)', borderRadius: 16,
          fontSize: 15, fontWeight: 900, boxShadow: '4px 4px 0 var(--ink)',
          textDecoration: 'none', color: 'var(--ink)',
        }}>
          🗺️ このコースをシェアする
        </Link>
        <Link href="/walk" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          padding: '14px', background: 'var(--coral)',
          border: '2.5px solid var(--ink)', borderRadius: 16,
          fontSize: 14, fontWeight: 900, boxShadow: '3px 3px 0 var(--ink)',
          textDecoration: 'none', color: 'white',
        }}>
          もう一度歩く 🚶
        </Link>
        <Link href="/" style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '12px', background: 'var(--surface)',
          border: '2.5px solid var(--ink)', borderRadius: 16,
          fontSize: 13, fontWeight: 800, boxShadow: '2px 2px 0 var(--ink)',
          textDecoration: 'none', color: 'var(--ink)',
        }}>
          ホームへ戻る
        </Link>
      </div>
    </main>
  )
}
