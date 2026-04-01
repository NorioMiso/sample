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

export default function WalkRecorder() {
  const router = useRouter()

  const [status,    setStatus]    = useState<Status>('idle')
  const [elapsed,   setElapsed]   = useState(0)       // seconds
  const [distance,  setDistance]  = useState(0)       // meters
  const [positions, setPositions] = useState<Position[]>([])
  const [gpsError,  setGpsError]  = useState<string | null>(null)
  const [saving,    setSaving]    = useState(false)

  // completion form state
  const [weather,   setWeather]  = useState<WeatherCondition | null>(null)
  const [isPublic,  setIsPublic] = useState(false)

  const startTimeRef   = useRef<Date | null>(null)
  const watchIdRef     = useRef<number | null>(null)
  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null)
  const wakeLockRef    = useRef<WakeLockSentinel | null>(null)

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (watchIdRef.current !== null)
        navigator.geolocation.clearWatch(watchIdRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
      wakeLockRef.current?.release()
    }
  }, [])

  const startRecording = useCallback(async () => {
    if (!navigator.geolocation) {
      setGpsError('このブラウザはGPSに対応していません')
      return
    }

    setGpsError(null)
    startTimeRef.current = new Date()
    setStatus('recording')
    setElapsed(0)
    setDistance(0)
    setPositions([])

    // 画面スリープを防ぐ
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen')
      }
    } catch { /* ignore */ }

    // タイマー
    timerRef.current = setInterval(() => {
      setElapsed(s => s + 1)
    }, 1000)

    // GPS監視
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const newPos = { lat: pos.coords.latitude, lng: pos.coords.longitude }
        setPositions(prev => {
          if (prev.length === 0) return [newPos]
          const last = prev[prev.length - 1]
          const d = haversineDistance(last.lat, last.lng, newPos.lat, newPos.lng)
          // 5m未満の微小移動はノイズとして無視
          if (d < 5) return prev
          setDistance(total => total + d)
          return [...prev, newPos]
        })
      },
      (err) => setGpsError(`GPS取得エラー: ${err.message}`),
      { enableHighAccuracy: true, maximumAge: 3000, timeout: 10000 },
    )
  }, [])

  const stopRecording = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    wakeLockRef.current?.release()
    setStatus('completed')
  }, [])

  const handleSave = async () => {
    if (!startTimeRef.current) return
    setSaving(true)
    const endedAt = new Date()

    const input: SaveWalkInput = {
      startedAt:        startTimeRef.current.toISOString(),
      endedAt:          endedAt.toISOString(),
      distanceMeters:   Math.round(distance),
      timeOfDay:        getTimeOfDay(startTimeRef.current),
      weather,
      isPublic,
      routeCoordinates: positions.map(p => [p.lng, p.lat]),
    }

    try {
      await saveWalk(input)
    } catch (e) {
      setSaving(false)
      alert(e instanceof Error ? e.message : '保存に失敗しました')
    }
  }

  const handleDiscard = () => {
    setStatus('idle')
    setElapsed(0)
    setDistance(0)
    setPositions([])
    startTimeRef.current = null
  }

  // ---- IDLE ----
  if (status === 'idle') {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 gap-8">
        <div className="text-center">
          <h1 className="text-3xl font-black">散歩をはじめる</h1>
          <p className="text-sm font-semibold text-gray-500 mt-1">
            GPSで自動記録します
          </p>
        </div>

        {gpsError && <p className="nb-error text-center">{gpsError}</p>}

        <button
          onClick={startRecording}
          className="nb-btn nb-btn-coral"
          style={{ fontSize: '1.1rem', padding: '1rem 2.5rem' }}
        >
          🚶 スタート
        </button>

        <button
          onClick={() => router.push('/')}
          className="nb-btn nb-btn-white text-sm"
        >
          ← ホームへ戻る
        </button>
      </main>
    )
  }

  // ---- RECORDING ----
  if (status === 'recording') {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6 gap-8">
        <div className="text-center">
          <div
            className="inline-block px-3 py-1 rounded-full text-xs font-black mb-4"
            style={{ background: 'var(--coral)', border: '2px solid black' }}
          >
            ● REC
          </div>
          <div className="text-6xl font-black tabular-nums">
            {formatDuration(elapsed)}
          </div>
          <div className="text-3xl font-black mt-3">
            {formatDistance(Math.round(distance))}
          </div>
          <div className="text-sm font-semibold text-gray-500 mt-2">
            記録ポイント: {positions.length}
          </div>
        </div>

        {gpsError && <p className="nb-error text-center">{gpsError}</p>}

        <button
          onClick={stopRecording}
          className="nb-btn nb-btn-black"
          style={{ fontSize: '1.1rem', padding: '1rem 2.5rem' }}
        >
          ■ ストップ
        </button>
      </main>
    )
  }

  // ---- COMPLETED ----
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 gap-6">
      <div className="text-center">
        <h2 className="text-2xl font-black">散歩おつかれさまです 🌿</h2>
      </div>

      {/* 記録サマリー */}
      <div className="nb-card p-5 w-full max-w-sm">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="text-xs font-bold text-gray-500 mb-1">時間</p>
            <p className="text-2xl font-black tabular-nums">{formatDuration(elapsed)}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-500 mb-1">距離</p>
            <p className="text-2xl font-black">{formatDistance(Math.round(distance))}</p>
          </div>
        </div>
      </div>

      {/* 保存フォーム */}
      <div className="nb-card p-5 w-full max-w-sm flex flex-col gap-4">

        {/* 天気選択 */}
        <div>
          <p className="nb-label">天気</p>
          <div className="grid grid-cols-3 gap-2">
            {WEATHER_OPTIONS.map(opt => (
              <button
                key={opt.value}
                onClick={() => setWeather(opt.value)}
                className="nb-btn text-sm"
                style={{
                  background: weather === opt.value ? 'var(--yellow)' : 'var(--white)',
                  flexDirection: 'column',
                  padding: '0.5rem',
                  gap: '0.1rem',
                }}
              >
                <span>{opt.icon}</span>
                <span style={{ fontSize: '0.7rem' }}>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* 公開設定 */}
        <div>
          <p className="nb-label">公開設定</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: false, label: '🔒 非公開' },
              { value: true,  label: '🌍 公開' },
            ].map(opt => (
              <button
                key={String(opt.value)}
                onClick={() => setIsPublic(opt.value)}
                className="nb-btn text-sm"
                style={{
                  background: isPublic === opt.value ? 'var(--green)' : 'var(--white)',
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 w-full max-w-sm">
        <button
          onClick={handleSave}
          disabled={saving}
          className="nb-btn nb-btn-yellow w-full"
          style={{ fontSize: '1rem', padding: '0.8rem' }}
        >
          {saving ? '保存中...' : '保存する ✨'}
        </button>
        <button
          onClick={handleDiscard}
          className="nb-btn nb-btn-white w-full text-sm"
        >
          やり直す
        </button>
      </div>
    </main>
  )
}
