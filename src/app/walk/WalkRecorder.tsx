'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { haversineDistance, getTimeOfDay, formatDuration, formatDistance } from '@/lib/utils/geo'
import { saveWalk, type SaveWalkInput } from '@/app/actions/walk'
import type { WeatherCondition } from '@/types/supabase'

type Status = 'idle' | 'recording' | 'completed'
type Position = { lat: number; lng: number }

const WEATHER_OPTIONS: { value: WeatherCondition; label: string; icon: string }[] = [
  { value: 'sunny',  label: '晴れ', icon: '☀️' },
  { value: 'cloudy', label: '曇り', icon: '☁️' },
  { value: 'rainy',  label: '雨',   icon: '🌧️' },
  { value: 'snowy',  label: '雪',   icon: '🌨️' },
  { value: 'foggy',  label: '霧',   icon: '🌫️' },
  { value: 'windy',  label: '風',   icon: '💨' },
]

// pace → emoji
function paceEmoji(distM: number, sec: number): string {
  if (distM < 10 || sec < 10) return '🐢'
  const minPer1km = sec / 60 / (distM / 1000)
  if (minPer1km < 8)  return '🐆'
  if (minPer1km < 12) return '🐈'
  if (minPer1km < 18) return '🐕'
  return '🐢'
}
function paceLabel(distM: number, sec: number): string {
  if (distM < 10 || sec < 10) return 'ゆっくり'
  const minPer1km = sec / 60 / (distM / 1000)
  if (minPer1km < 8)  return 'はやい！'
  if (minPer1km < 12) return 'はやい'
  if (minPer1km < 18) return 'ふつう'
  return 'ゆっくり'
}

export default function WalkRecorder() {
  const router = useRouter()

  const [status,    setStatus]    = useState<Status>('idle')
  const [elapsed,   setElapsed]   = useState(0)
  const [distance,  setDistance]  = useState(0)
  const [positions, setPositions] = useState<Position[]>([])
  const [gpsError,  setGpsError]  = useState<string | null>(null)
  const [saving,    setSaving]    = useState(false)
  const [weather,   setWeather]   = useState<WeatherCondition | null>(null)
  const [isPublic,  setIsPublic]  = useState(false)

  const startTimeRef = useRef<Date | null>(null)
  const watchIdRef   = useRef<number | null>(null)
  const timerRef     = useRef<ReturnType<typeof setInterval> | null>(null)
  const wakeLockRef  = useRef<WakeLockSentinel | null>(null)

  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null) navigator.geolocation.clearWatch(watchIdRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
      wakeLockRef.current?.release()
    }
  }, [])

  const startRecording = useCallback(async () => {
    if (!navigator.geolocation) { setGpsError('このブラウザはGPSに対応していません'); return }
    setGpsError(null)
    startTimeRef.current = new Date()
    setStatus('recording'); setElapsed(0); setDistance(0); setPositions([])
    try { if ('wakeLock' in navigator) wakeLockRef.current = await navigator.wakeLock.request('screen') } catch { /* ignore */ }
    timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000)
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setPositions(prev => {
          if (prev.length === 0) return [newPos]
          const last = prev[prev.length - 1]
          const d = haversineDistance(last.lat, last.lng, newPos.lat, newPos.lng)
          if (d < 5) return prev
          setDistance(total => total + d)
          return [...prev, newPos]
        })
      },
      (err) => setGpsError(`GPS: ${err.message}`),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 },
    )
  }, [])

  const stopRecording = useCallback(() => {
    if (watchIdRef.current !== null) { navigator.geolocation.clearWatch(watchIdRef.current); watchIdRef.current = null }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
    wakeLockRef.current?.release()
    setStatus('completed')
  }, [])

  const handleSave = async () => {
    if (!startTimeRef.current) return
    setSaving(true)
    const input: SaveWalkInput = {
      startedAt:        startTimeRef.current.toISOString(),
      endedAt:          new Date().toISOString(),
      distanceMeters:   Math.round(distance),
      timeOfDay:        getTimeOfDay(startTimeRef.current),
      weather, isPublic,
      routeCoordinates: positions.map(p => [p.lng, p.lat]),
    }
    try { await saveWalk(input) }
    catch (e) { setSaving(false); alert(e instanceof Error ? e.message : '保存に失敗しました') }
  }

  const handleDiscard = () => {
    setStatus('idle'); setElapsed(0); setDistance(0); setPositions([]); startTimeRef.current = null
  }

  const isHttps    = typeof window !== 'undefined' && window.location.protocol === 'https:'
  const isLocalhost = typeof window !== 'undefined' && window.location.hostname === 'localhost'
  const httpsRequired = !isHttps && !isLocalhost
  const gpsAvailable  = typeof navigator !== 'undefined' && !!navigator.geolocation

  // ───── IDLE ─────
  if (status === 'idle') {
    return (
      <main
        className="min-h-screen flex flex-col max-w-sm mx-auto"
        style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      >
        {/* ヘッダー */}
        <div className="flex items-center gap-3 px-5 pt-5 pb-3">
          <button onClick={() => router.push('/')}
            style={{ fontSize: 13, fontWeight: 800, color: 'var(--ink-soft)' }}>
            ← ホーム
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center gap-6 px-6">
          <div className="text-center">
            <div style={{ fontSize: 64, marginBottom: 12 }}>🚶</div>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: 'var(--ink)' }}>散歩をはじめる</h1>
            <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)', marginTop: 6 }}>
              GPSで距離・ルートを自動記録します
            </p>
          </div>

          {httpsRequired && (
            <div style={{
              background: 'var(--coral)', border: '2.5px solid var(--ink)',
              borderRadius: 16, padding: '14px 16px',
              boxShadow: '3px 3px 0 var(--ink)', width: '100%',
            }}>
              <p style={{ fontWeight: 900, fontSize: 13, marginBottom: 4 }}>⚠️ スマホのGPSはHTTPS必須</p>
              <p style={{ fontSize: 12, fontWeight: 600 }}>
                HTTPではGPSが使えません。<br />
                <strong>https://sample-8v6z.vercel.app</strong> からアクセスしてください。
              </p>
            </div>
          )}

          {!gpsAvailable && !httpsRequired && (
            <div style={{
              background: 'var(--coral)', border: '2.5px solid var(--ink)',
              borderRadius: 16, padding: '14px 16px',
              boxShadow: '3px 3px 0 var(--ink)', width: '100%',
            }}>
              <p style={{ fontWeight: 900, fontSize: 13 }}>⚠️ このブラウザはGPSに対応していません</p>
            </div>
          )}

          {gpsError && (
            <div style={{
              background: 'var(--coral)', border: '2.5px solid var(--ink)',
              borderRadius: 16, padding: '12px 16px', width: '100%',
            }}>
              <p style={{ fontWeight: 800, fontSize: 13 }}>⚠️ {gpsError}</p>
            </div>
          )}

          <button
            onClick={startRecording}
            disabled={httpsRequired || !gpsAvailable}
            style={{
              width: '100%', padding: '18px',
              background: 'var(--green)', color: 'var(--ink)',
              border: '3px solid var(--ink)', borderRadius: 20,
              fontSize: 17, fontWeight: 900,
              boxShadow: '4px 4px 0 var(--ink)',
              cursor: httpsRequired || !gpsAvailable ? 'not-allowed' : 'pointer',
              opacity: httpsRequired || !gpsAvailable ? 0.5 : 1,
              letterSpacing: '0.05em',
              transition: 'transform 0.1s, box-shadow 0.1s',
            }}
          >
            🚶 スタート
          </button>
        </div>
      </main>
    )
  }

  // ───── RECORDING ─────
  if (status === 'recording') {
    const emoji = paceEmoji(distance, elapsed)
    const label = paceLabel(distance, elapsed)

    return (
      <main
        className="min-h-screen flex flex-col max-w-sm mx-auto"
        style={{ background: 'var(--bg)' }}
      >
        {/* 上部バー */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--coral)', border: '2.5px solid var(--ink)',
            borderRadius: 20, padding: '5px 12px',
            boxShadow: '2px 2px 0 var(--ink)',
          }}>
            <span style={{
              width: 8, height: 8, borderRadius: '50%', background: 'white',
              animation: 'recBlink 1.2s ease-in-out infinite',
              display: 'inline-block',
            }} />
            <span style={{ fontSize: 12, fontWeight: 900, color: 'white', letterSpacing: '0.08em' }}>REC</span>
          </div>
          <div style={{ fontSize: 22, fontWeight: 900, fontVariantNumeric: 'tabular-nums', color: 'var(--ink)' }}>
            {formatDuration(elapsed)}
          </div>
        </div>

        {/* 3統計 */}
        <div className="grid grid-cols-3 gap-2 px-4 mb-3">
          <div style={{
            background: 'var(--yellow)', border: '2.5px solid var(--ink)',
            borderRadius: 16, boxShadow: '3px 3px 0 var(--ink)',
            padding: '12px 8px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 20, fontWeight: 900, lineHeight: 1 }}>
              {(distance / 1000).toFixed(2)}
            </div>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--ink-soft)', marginTop: 2 }}>km</div>
          </div>
          <div style={{
            background: 'var(--surface)', border: '2.5px solid var(--ink)',
            borderRadius: 16, boxShadow: '3px 3px 0 var(--ink)',
            padding: '12px 8px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 22, lineHeight: 1 }}>{emoji}</div>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--ink-soft)', marginTop: 2 }}>{label}</div>
          </div>
          <div style={{
            background: 'var(--surface)', border: '2.5px solid var(--ink)',
            borderRadius: 16, boxShadow: '3px 3px 0 var(--ink)',
            padding: '12px 8px', textAlign: 'center',
          }}>
            <div style={{ fontSize: 20, fontWeight: 900, lineHeight: 1 }}>{positions.length}</div>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--ink-soft)', marginTop: 2 }}>ポイント</div>
          </div>
        </div>

        {/* 地図エリア（プレースホルダー） */}
        <div style={{
          flex: 1, margin: '0 16px', borderRadius: 24,
          border: '3px solid var(--ink)', boxShadow: '4px 4px 0 var(--ink)',
          overflow: 'hidden', position: 'relative', minHeight: 280,
          background: 'linear-gradient(135deg, #E8F5EB 0%, #C8DFC0 100%)',
        }}>
          {/* GPS座標をSVGでざっくり描画 */}
          {positions.length >= 2 && (
            <svg
              viewBox="0 0 300 300"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
              preserveAspectRatio="xMidYMid meet"
            >
              {(() => {
                const lats = positions.map(p => p.lat)
                const lngs = positions.map(p => p.lng)
                const minLat = Math.min(...lats), maxLat = Math.max(...lats)
                const minLng = Math.min(...lngs), maxLng = Math.max(...lngs)
                const pad = 20
                const scaleX = (300 - pad * 2) / (maxLng - minLng || 0.0001)
                const scaleY = (300 - pad * 2) / (maxLat - minLat || 0.0001)
                const scale = Math.min(scaleX, scaleY)
                const pts = positions.map(p => ({
                  x: pad + (p.lng - minLng) * scale,
                  y: 300 - pad - (p.lat - minLat) * scale,
                }))
                const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ')
                const last = pts[pts.length - 1]
                return <>
                  <path d={d} fill="none" stroke="#FF6B6B" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" opacity="0.9" />
                  <circle cx={pts[0].x} cy={pts[0].y} r="6" fill="#6BCB77" stroke="#1A1A2E" strokeWidth="2" />
                  <circle cx={last.x} cy={last.y} r="7" fill="#FFD93D" stroke="#1A1A2E" strokeWidth="2.5" />
                </>
              })()}
            </svg>
          )}

          {positions.length < 2 && (
            <div style={{
              position: 'absolute', inset: 0, display: 'flex',
              flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
              <span style={{ fontSize: 36 }}>📍</span>
              <p style={{ fontSize: 13, fontWeight: 800, color: '#3D7A35' }}>GPS取得中…</p>
            </div>
          )}

          {/* 現在地マーカー（アニメーション） */}
          {positions.length >= 1 && (
            <div style={{
              position: 'absolute', bottom: '30%', right: '30%',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              animation: 'float 2s ease-in-out infinite',
            }}>
              <div style={{
                width: 34, height: 34, background: 'var(--yellow)',
                border: '3px solid var(--ink)', borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 17, boxShadow: '2px 2px 0 var(--ink)',
              }}>🚶</div>
            </div>
          )}
        </div>

        {/* 下部コントロール */}
        <div className="flex items-center gap-3 px-4 py-4">
          <button
            style={{
              flex: 1, height: 52,
              background: 'var(--surface)', border: '2.5px solid var(--ink)',
              borderRadius: 16, boxShadow: '3px 3px 0 var(--ink)',
              fontSize: 14, fontWeight: 900, color: 'var(--ink)',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
            onClick={() => { /* pause 未実装 */ }}
          >
            ⏸ 一時停止
          </button>
          <button
            onClick={stopRecording}
            style={{
              width: 52, height: 52,
              background: 'var(--coral)', border: '2.5px solid var(--ink)',
              borderRadius: 16, boxShadow: '3px 3px 0 var(--ink)',
              fontSize: 20, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
            title="終了"
          >⏹</button>
        </div>

        {gpsError && (
          <p style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, color: 'var(--coral)', paddingBottom: 8 }}>
            {gpsError}
          </p>
        )}

        <style>{`
          @keyframes recBlink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.2; }
          }
          @keyframes float {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-4px); }
          }
        `}</style>
      </main>
    )
  }

  // ───── COMPLETED ─────
  return (
    <main
      className="min-h-screen flex flex-col items-center justify-end max-w-sm mx-auto"
      style={{
        background: 'rgba(26,26,46,0.7)',
        paddingBottom: 'calc(24px + env(safe-area-inset-bottom))',
      }}
    >
      <div style={{
        background: 'var(--surface)', border: '3px solid var(--ink)',
        borderRadius: 28, padding: '24px 20px',
        width: 'calc(100% - 32px)',
        boxShadow: '5px 5px 0 var(--ink)',
        animation: 'resultPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both',
      }}>
        <div style={{ textAlign: 'center', fontSize: 26, marginBottom: 6, letterSpacing: 4 }}>⭐⭐⭐</div>
        <p style={{ textAlign: 'center', fontSize: 13, fontWeight: 900, letterSpacing: '0.1em', color: 'var(--ink-soft)', marginBottom: 14 }}>
          さんぽ終了！
        </p>

        {/* 記録サマリー */}
        <div className="grid grid-cols-2 gap-2 mb-4">
          {[
            { value: formatDistance(Math.round(distance)), label: '距離' },
            { value: formatDuration(elapsed),              label: '時間' },
          ].map(item => (
            <div key={item.label} style={{
              background: 'var(--bg)', border: '2px solid #F0E8DC',
              borderRadius: 12, padding: 10, textAlign: 'center',
            }}>
              <div style={{ fontSize: 18, fontWeight: 900 }}>{item.value}</div>
              <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--ink-soft)', marginTop: 2 }}>{item.label}</div>
            </div>
          ))}
        </div>

        {/* 天気 */}
        <div className="mb-3">
          <p className="nb-label" style={{ fontSize: 12 }}>天気</p>
          <div className="grid grid-cols-6 gap-1">
            {WEATHER_OPTIONS.map(opt => (
              <button key={opt.value} onClick={() => setWeather(opt.value)} style={{
                padding: '6px 4px',
                background: weather === opt.value ? 'var(--yellow)' : 'var(--bg)',
                border: `2px solid ${weather === opt.value ? 'var(--ink)' : '#E0D8CC'}`,
                borderRadius: 10, cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                fontSize: 18,
              }}>
                {opt.icon}
                <span style={{ fontSize: 8, fontWeight: 800, color: 'var(--ink-soft)' }}>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 保存ボタン */}
        <div className="flex gap-2">
          <button onClick={handleDiscard} style={{
            flex: 1, height: 46,
            background: 'var(--surface)', border: '2.5px solid var(--ink)',
            borderRadius: 14, fontSize: 13, fontWeight: 900,
            cursor: 'pointer', boxShadow: '2px 2px 0 var(--ink)',
          }}>
            やり直す
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              flex: 1.5, height: 46,
              background: 'var(--green)', border: '2.5px solid var(--ink)',
              borderRadius: 14, fontSize: 13, fontWeight: 900,
              cursor: saving ? 'not-allowed' : 'pointer',
              boxShadow: '2px 2px 0 var(--ink)',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? '保存中…' : `${isPublic ? '公開して' : ''}保存する ✨`}
          </button>
        </div>

        {/* 公開トグル */}
        <div className="flex items-center justify-between mt-3 px-1">
          <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--ink-soft)' }}>
            {isPublic ? '🌍 公開' : '🔒 非公開'}
          </span>
          <button
            onClick={() => setIsPublic(v => !v)}
            style={{
              background: isPublic ? 'var(--green)' : 'var(--bg)',
              border: '2px solid var(--ink)', borderRadius: 20,
              padding: '4px 12px', fontSize: 11, fontWeight: 900,
              cursor: 'pointer',
            }}
          >
            切り替え
          </button>
        </div>
      </div>

      <style>{`
        @keyframes resultPop {
          from { transform: translateY(40px); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
      `}</style>
    </main>
  )
}
