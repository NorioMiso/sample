import { createClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { formatDistance, formatDuration } from '@/lib/utils/geo'
import NiceSanpoButton from './NiceSanpoButton'
import CommentSection from './CommentForm'

type Props = { params: Promise<{ id: string }> }

const WEATHER_ICON: Record<string, string> = {
  sunny: '☀️', cloudy: '☁️', rainy: '🌧️',
  snowy: '🌨️', foggy: '🌫️', windy: '💨',
}

const TIME_LABELS: Record<string, string> = {
  morning: '早朝', daytime: '昼間', evening: '夕方', night: '夜', midnight: '深夜',
}

export default async function CourseDetailPage({ params }: Props) {
  const { id } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .maybeSingle()

  // コース投稿を取得
  const { data: post } = await supabase
    .from('course_posts')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!post) notFound()
  if (!post.is_public && post.user_id !== profile?.id) notFound()

  // 投稿者情報
  const { data: poster } = await supabase
    .from('users')
    .select('nickname, icon_url')
    .eq('id', post.user_id)
    .maybeSingle()

  // 散歩記録（距離・時間・天気）
  let walk = null
  if (post.walk_record_id) {
    const { data } = await supabase
      .from('walk_records')
      .select('distance_meters, duration_seconds, weather, time_of_day, walked_date')
      .eq('id', post.walk_record_id)
      .maybeSingle()
    walk = data
  }

  // 自分がナイスしているか
  const { data: myNice } = profile
    ? await supabase
        .from('nice_sanpos')
        .select('id')
        .eq('user_id', profile.id)
        .eq('course_post_id', id)
        .maybeSingle()
    : { data: null }

  // コメント一覧
  const { data: rawComments } = await supabase
    .from('course_comments')
    .select('id, user_id, body, created_at')
    .eq('course_post_id', id)
    .order('created_at', { ascending: true })

  // コメント投稿者情報を一括取得
  const commentUserIds = [...new Set((rawComments ?? []).map(c => c.user_id))]
  const { data: commentUsers } = commentUserIds.length
    ? await supabase.from('users').select('id, nickname, icon_url').in('id', commentUserIds)
    : { data: [] }
  const commentUserMap = new Map((commentUsers ?? []).map(u => [u.id, u]))

  const comments = (rawComments ?? []).map(c => ({
    ...c,
    poster: commentUserMap.get(c.user_id) ?? null,
  }))

  const isOwner = profile?.id === post.user_id

  return (
    <main className="min-h-screen flex flex-col p-4 gap-5 max-w-sm mx-auto pb-10">
      {/* ヘッダー */}
      <div className="flex items-center gap-3 pt-4">
        <Link href="/courses" className="text-sm font-bold">← コース一覧</Link>
      </div>

      {/* タイトル・投稿者 */}
      <div>
        <h1 className="text-2xl font-black mb-2">{post.title}</h1>
        <div className="flex items-center gap-2">
          <div
            className="w-7 h-7 rounded-full flex items-center justify-center text-sm shrink-0"
            style={{ background: 'var(--yellow)', border: '2px solid black' }}
          >
            {poster?.icon_url
              ? <img src={poster.icon_url} alt="" className="w-full h-full rounded-full object-cover" />
              : '🚶'}
          </div>
          <span className="text-sm font-bold">{poster?.nickname ?? '名無し'}</span>
          <span className="text-xs text-gray-400 font-semibold">
            {new Date(post.created_at).toLocaleDateString('ja-JP')}
          </span>
        </div>
      </div>

      {/* 散歩データ */}
      {walk && (
        <div className="nb-card p-4 grid grid-cols-3 gap-3 text-center"
             style={{ background: 'var(--green)' }}>
          <div>
            <p className="text-xs font-bold text-gray-600 mb-1">距離</p>
            <p className="font-black">{formatDistance(walk.distance_meters)}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-600 mb-1">時間</p>
            <p className="font-black">{formatDuration(walk.duration_seconds)}</p>
          </div>
          <div>
            <p className="text-xs font-bold text-gray-600 mb-1">天気/時間帯</p>
            <p className="font-black text-sm">
              {walk.weather ? WEATHER_ICON[walk.weather] : '—'}{' '}
              {TIME_LABELS[walk.time_of_day] ?? walk.time_of_day}
            </p>
          </div>
        </div>
      )}

      {/* コメント */}
      {post.comment && (
        <div className="nb-card p-4">
          <p className="text-sm leading-relaxed">{post.comment}</p>
        </div>
      )}

      {/* 統計バー */}
      <div className="flex items-center gap-4 text-sm font-bold text-gray-500">
        <span>💛 {post.nice_count}</span>
        <span>💬 {post.comment_count}</span>
        <span>🚶 {post.walked_count}人が歩いた</span>
      </div>

      {/* ナイス散歩ボタン */}
      {profile && !isOwner && (
        <NiceSanpoButton
          coursePostId={id}
          initialLiked={!!myNice}
          initialCount={post.nice_count}
        />
      )}

      {/* オーナー編集リンク */}
      {isOwner && (
        <div className="text-center">
          <span className="text-xs font-semibold text-gray-400 bg-gray-100 px-3 py-1 rounded-full border border-gray-200">
            あなたのコース
          </span>
        </div>
      )}

      {/* コメントセクション */}
      <div className="nb-card p-4">
        <CommentSection
          coursePostId={id}
          comments={comments}
          myUserId={profile?.id ?? null}
        />
      </div>

      <Link href="/courses" className="nb-btn nb-btn-white w-full justify-center text-sm">
        ← コース一覧へ戻る
      </Link>
    </main>
  )
}
