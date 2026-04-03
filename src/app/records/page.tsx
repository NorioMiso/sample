import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDuration, formatDistance } from '@/lib/utils/geo'
import BottomNav from '@/app/components/BottomNav'

const WEATHER_ICON: Record<string, string> = {
  sunny: '☀️', cloudy: '☁️', rainy: '🌧️',
  snowy: '🌨️', foggy: '🌫️', windy: '💨',
}

const TIME_TAG: Record<string, { label: string; bg: string; color: string }> = {
  morning:   { label: '🌅 朝',   bg: '#FEF9C3', color: '#854d0e' },
  afternoon: { label: '☀️ 昼',   bg: '#DCFCE7', color: '#166534' },
  evening:   { label: '🌇 夕方', bg: '#FFE4E1', color: '#9a3412' },
  night:     { label: '🌙 夜',   bg: '#EDE9FE', color: '#5b21b6' },
  midnight:  { label: '🌙 深夜', bg: '#EDE9FE', color: '#5b21b6' },
}

const MONTH_JP = ['', '1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']

// 距離で日付バッジ背景色を決める
function dateBadgeBg(distM: number): string {
  if (distM >= 5000) return '#DCFCE7' // 5km以上 → 緑
  if (distM >= 3000) return '#FEF9C3' // 3〜5km → 黄
  return '#FFF8F0'                     // 〜3km → ベージュ
}

type Props = { searchParams: Promise<{ year?: string; month?: string }> }

export default async function RecordsPage({ searchParams }: Props) {
  const sp    = await searchParams
  const now   = new Date()
  const year  = sp.year  ? parseInt(sp.year)  : now.getFullYear()
  const month = sp.month ? parseInt(sp.month) : now.getMonth() + 1

  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('users').select('id').eq('auth_id', user.id).maybeSingle()
  if (!profile) redirect('/auth/setup')

  // 該当月の散歩記録
  const { data: records } = await supabase
    .from('walk_records')
    .select('id, started_at, duration_seconds, distance_meters, time_of_day, weather')
    .eq('user_id', profile.id)
    .eq('year', year)
    .eq('month', month)
    .order('started_at', { ascending: false })

  const allRecords = records ?? []

  // 称え一括取得
  const recIds = allRecords.map(r => r.id)
  const { data: praisesData } = recIds.length
    ? await supabase.from('praises').select('walk_record_id, praise_text')
        .in('walk_record_id', recIds)
    : { data: [] }
  const praiseMap = new Map((praisesData ?? []).map(p => [p.walk_record_id, p.praise_text]))

  // 月サマリー計算
  const totalWalks    = allRecords.length
  const totalDistM    = allRecords.reduce((s, r) => s + r.distance_meters, 0)
  const avgDistM      = totalWalks > 0 ? totalDistM / totalWalks : 0

  // 連続日数（最長ラン）
  const walkedDays = new Set(allRecords.map(r => r.started_at.slice(0, 10)))
  let maxStreak = 0, streak = 0
  const daysInMonth = new Date(year, month, 0).getDate()
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    if (walkedDays.has(key)) { streak++; maxStreak = Math.max(maxStreak, streak) }
    else streak = 0
  }

  // 月移動用URL
  const prevMonth = month === 1  ? { y: year - 1, m: 12 } : { y: year, m: month - 1 }
  const nextMonth = month === 12 ? { y: year + 1, m: 1  } : { y: year, m: month + 1 }
  const nextDisabled = year > now.getFullYear() || (year === now.getFullYear() && month >= now.getMonth() + 1)

  return (
    <main
      className="min-h-screen flex flex-col max-w-sm mx-auto"
      style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}
    >
      {/* ヘッダー */}
      <div style={{ padding: '16px 20px 10px' }}>
        <h1 style={{
          fontFamily: "'Kaisei Decol', serif",
          fontSize: 22, fontWeight: 700, color: 'var(--ink)',
        }}>
          📍 きろく
        </h1>
      </div>

      {/* 月切り替え */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        gap: 16, padding: '0 22px 14px',
      }}>
        <Link href={`/records?year=${prevMonth.y}&month=${prevMonth.m}`} style={{ textDecoration: 'none' }}>
          <div style={{
            width: 32, height: 32, background: 'var(--surface)',
            border: '2.5px solid var(--ink)', borderRadius: 10,
            boxShadow: '2px 2px 0 var(--ink)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 900, cursor: 'pointer',
          }}>←</div>
        </Link>
        <span style={{ fontSize: 18, fontWeight: 900, letterSpacing: '0.05em', minWidth: 100, textAlign: 'center' }}>
          {year}年{MONTH_JP[month]}
        </span>
        <Link
          href={nextDisabled ? '#' : `/records?year=${nextMonth.y}&month=${nextMonth.m}`}
          style={{ textDecoration: 'none', pointerEvents: nextDisabled ? 'none' : 'auto' }}
        >
          <div style={{
            width: 32, height: 32, background: 'var(--surface)',
            border: '2.5px solid var(--ink)', borderRadius: 10,
            boxShadow: nextDisabled ? 'none' : '2px 2px 0 var(--ink)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, fontWeight: 900, cursor: nextDisabled ? 'default' : 'pointer',
            opacity: nextDisabled ? 0.4 : 1,
          }}>→</div>
        </Link>
      </div>

      {/* 月サマリーチップ */}
      <div style={{ display: 'flex', gap: 8, margin: '0 16px 14px' }}>
        {[
          { value: `${totalWalks}回`,                             label: '散歩した日', hi: true },
          { value: formatDistance(Math.round(totalDistM)),        label: '合計距離',   hi: false },
          { value: formatDistance(Math.round(avgDistM)),          label: '平均距離',   hi: false },
          { value: `${maxStreak}🔥`,                              label: '最長連続',   hi: false },
        ].map(chip => (
          <div key={chip.label} style={{
            flex: 1, background: chip.hi ? 'var(--yellow)' : 'var(--surface)',
            border: '2.5px solid var(--ink)', borderRadius: 14,
            boxShadow: '2px 2px 0 var(--ink)', padding: '10px 8px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 16, fontWeight: 900, lineHeight: 1 }}>{chip.value}</div>
            <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--ink-soft)', marginTop: 3, letterSpacing: '0.05em' }}>
              {chip.label}
            </div>
          </div>
        ))}
      </div>

      {/* リスト */}
      {allRecords.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 32 }}>
          <span style={{ fontSize: 48 }}>👟</span>
          <p style={{ fontSize: 16, fontWeight: 900 }}>この月の記録はありません</p>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)' }}>さんぽを記録してみましょう！</p>
          <Link href="/walk" style={{
            marginTop: 8, padding: '12px 24px',
            background: 'var(--green)', border: '2.5px solid var(--ink)',
            borderRadius: 14, fontSize: 14, fontWeight: 900,
            boxShadow: '3px 3px 0 var(--ink)', textDecoration: 'none', color: 'var(--ink)',
          }}>
            🚶 散歩をはじめる
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 16px' }}>
          {allRecords.map(record => {
            const dt      = new Date(record.started_at)
            const dayNum  = dt.getDate()
            const monthAb = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][dt.getMonth()]
            const praise  = praiseMap.get(record.id)
            const timeTag = TIME_TAG[record.time_of_day]
            const bgColor = dateBadgeBg(record.distance_meters)

            return (
              <div key={record.id} style={{
                background: 'var(--surface)', border: '2.5px solid var(--ink)',
                borderRadius: 20, boxShadow: '3px 3px 0 var(--ink)',
                overflow: 'hidden',
              }}>
                {/* カードヘッダー */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 14px 12px' }}>
                  {/* 日付バッジ */}
                  <div style={{
                    width: 48, height: 52, background: bgColor,
                    border: '2px solid var(--ink)', borderRadius: 12,
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    <div style={{ fontSize: 8, fontWeight: 900, letterSpacing: '0.1em', color: 'var(--ink-soft)' }}>
                      {monthAb}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1, color: 'var(--ink)' }}>
                      {dayNum}
                    </div>
                  </div>

                  {/* テキスト */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontSize: 20, fontWeight: 900, color: 'var(--ink)' }}>
                        {formatDistance(record.distance_meters)}
                      </span>
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                        {record.weather && (
                          <span style={{
                            fontSize: 9, fontWeight: 800, padding: '2px 7px',
                            borderRadius: 8, border: '1.5px solid var(--ink)',
                            background: '#F0F8FF',
                          }}>
                            {WEATHER_ICON[record.weather]} {record.weather === 'rainy' ? '雨' : record.weather === 'sunny' ? '晴れ' : record.weather === 'cloudy' ? '曇り' : record.weather === 'snowy' ? '雪' : record.weather === 'foggy' ? '霧' : '風'}
                          </span>
                        )}
                        {timeTag && (
                          <span style={{
                            fontSize: 9, fontWeight: 800, padding: '2px 7px',
                            borderRadius: 8, border: '1.5px solid var(--ink)',
                            background: timeTag.bg, color: timeTag.color,
                          }}>
                            {timeTag.label}
                          </span>
                        )}
                      </div>
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)' }}>
                      {dt.getHours()}:{String(dt.getMinutes()).padStart(2, '0')}スタート　{formatDuration(record.duration_seconds)}
                    </div>
                  </div>
                </div>

                {/* 称えバナー */}
                {praise && (
                  <div style={{
                    margin: '0 12px 12px',
                    background: 'var(--yellow)', border: '2px solid var(--ink)',
                    borderRadius: 12, padding: '10px 12px',
                    display: 'flex', alignItems: 'flex-start', gap: 8,
                  }}>
                    <span style={{ fontSize: 16, flexShrink: 0 }}>⭐</span>
                    <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--ink)', lineHeight: 1.5 }}>
                      {praise}
                    </p>
                  </div>
                )}

                {/* ルートリンク */}
                <Link href={`/walk/result/${record.id}`} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  margin: '0 12px 12px',
                  background: 'linear-gradient(135deg, #E8F5EB, #C8DFC0)',
                  border: '2px solid var(--ink)', borderRadius: 12,
                  padding: '10px', fontSize: 12, fontWeight: 800,
                  color: 'var(--green-dark)', textDecoration: 'none',
                }}>
                  🗺️ 詳細を見る
                </Link>
              </div>
            )
          })}
        </div>
      )}

      <BottomNav />
    </main>
  )
}
