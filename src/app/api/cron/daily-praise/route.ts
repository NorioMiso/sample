// 毎日 8:00 JST (23:00 UTC) に Vercel Cron から呼び出される
// ストリークが途切れそうなユーザーに励ましの通知を送る
//
// 呼び出し方:
//   Authorization: Bearer {CRON_SECRET}
//   または ?secret={CRON_SECRET}

import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function GET(req: NextRequest) {
  // ── 認証チェック ─────────────────────────────────────────────
  const cronSecret = process.env.CRON_SECRET
  const authHeader = req.headers.get('authorization')
  const querySecret = req.nextUrl.searchParams.get('secret')

  const provided = authHeader?.replace('Bearer ', '') ?? querySecret
  if (cronSecret && provided !== cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const admin = createAdminClient()

  // ── 今日・昨日の JST 日付を計算 ──────────────────────────────
  const nowUtc   = new Date()
  const nowJST   = new Date(nowUtc.getTime() + 9 * 60 * 60 * 1000)
  const todayJST = nowJST.toISOString().slice(0, 10)
  const yd       = new Date(nowJST.getTime() - 86400000)
  const yestJST  = yd.toISOString().slice(0, 10)

  // ── ストリーク継続中ユーザー（昨日歩いた・今日まだ歩いていない）を取得 ──
  const { data: statsRows, error: statsErr } = await admin
    .from('walk_stats')
    .select('user_id, current_streak_days, last_walked_date')
    .eq('last_walked_date', yestJST)
    .gt('current_streak_days', 0)

  if (statsErr) {
    console.error('[cron/daily-praise] walk_stats error:', statsErr.message)
    return NextResponse.json({ error: statsErr.message }, { status: 500 })
  }

  if (!statsRows || statsRows.length === 0) {
    return NextResponse.json({ sent: 0 })
  }

  // ── 今日すでに通知を送ったユーザーを除外 ──────────────────────
  const userIds = statsRows.map(r => r.user_id)
  const todayStart = `${todayJST}T00:00:00+09:00`

  const { data: alreadySent } = await admin
    .from('notifications')
    .select('user_id')
    .in('user_id', userIds)
    .eq('type', 'praise_daily')
    .gte('created_at', todayStart)

  const sentSet = new Set((alreadySent ?? []).map(r => r.user_id))
  const targets = statsRows.filter(r => !sentSet.has(r.user_id))

  if (targets.length === 0) {
    return NextResponse.json({ sent: 0, skipped: statsRows.length })
  }

  // ── 通知を生成 ──────────────────────────────────────────────
  const notifications = targets.map(r => {
    const streak = r.current_streak_days
    const title = streak >= 30
      ? `🔥 ${streak}日連続！伝説のサンポスターへ！`
      : streak >= 10
      ? `🔥 ${streak}日連続！調子がいいね！`
      : streak >= 3
      ? `🔥 ${streak}日連続中！今日も歩こう！`
      : `今日も散歩して記録を伸ばそう！`

    const body = `今日歩くと${streak + 1}日連続になります。さあ出発！`

    return {
      user_id:      r.user_id,
      type:         'praise_daily' as const,
      title,
      body,
    }
  })

  const { error: insertErr } = await admin.from('notifications').insert(notifications)

  if (insertErr) {
    console.error('[cron/daily-praise] insert error:', insertErr.message)
    return NextResponse.json({ error: insertErr.message }, { status: 500 })
  }

  return NextResponse.json({
    sent:    notifications.length,
    skipped: statsRows.length - targets.length,
    date:    todayJST,
  })
}
