import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDistance } from '@/lib/utils/geo'

export default async function CoursesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: { user: _u } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', _u!.id)
    .maybeSingle()

  // 公開コース（最新20件）+ 投稿者情報
  const { data: posts } = await supabase
    .from('course_posts')
    .select('id, title, comment, nice_count, comment_count, walked_count, created_at, walk_record_id, user_id')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(20)

  // 投稿者のニックネームを一括取得
  const userIds = [...new Set((posts ?? []).map(p => p.user_id))]
  const { data: users } = userIds.length
    ? await supabase.from('users').select('id, nickname, icon_url').in('id', userIds)
    : { data: [] }
  const userMap = new Map((users ?? []).map(u => [u.id, u]))

  // 散歩記録の距離を一括取得
  const recordIds = (posts ?? []).map(p => p.walk_record_id).filter(Boolean) as string[]
  const { data: walkData } = recordIds.length
    ? await supabase.from('walk_records').select('id, distance_meters').in('id', recordIds)
    : { data: [] }
  const walkMap = new Map((walkData ?? []).map(w => [w.id, w]))

  // 自分がナイスした投稿ID一覧
  const { data: myNices } = profile
    ? await supabase.from('nice_sanpos').select('course_post_id').eq('user_id', profile.id)
    : { data: [] }
  const nicedSet = new Set((myNices ?? []).map(n => n.course_post_id))

  return (
    <main className="min-h-screen flex flex-col p-4 gap-4 max-w-sm mx-auto">
      <div className="flex items-center justify-between pt-4">
        <Link href="/" className="text-sm font-bold">← ホーム</Link>
        <h1 className="text-xl font-black">みんなのコース</h1>
        <div className="w-16" />
      </div>

      {(!posts || posts.length === 0) ? (
        <div className="nb-card p-6 text-center mt-8">
          <p className="text-3xl mb-3">🗺️</p>
          <p className="font-black text-base mb-1">まだコースがありません</p>
          <p className="text-sm text-gray-500">散歩後にコースをシェアしてみましょう！</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {posts.map(post => {
            const poster = userMap.get(post.user_id)
            const walk   = post.walk_record_id ? walkMap.get(post.walk_record_id) : null
            const liked  = nicedSet.has(post.id)

            return (
              <Link key={post.id} href={`/courses/${post.id}`}>
                <div className="nb-card p-4 hover:translate-y-[-2px] transition-transform">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <p className="font-black text-base leading-tight flex-1">{post.title}</p>
                    {walk && (
                      <span className="text-xs font-bold text-gray-500 shrink-0">
                        {formatDistance(walk.distance_meters)}
                      </span>
                    )}
                  </div>

                  {post.comment && (
                    <p className="text-sm text-gray-600 mb-3 line-clamp-2">{post.comment}</p>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0"
                        style={{ background: 'var(--yellow)', border: '1.5px solid black' }}
                      >
                        {poster?.icon_url
                          ? <img src={poster.icon_url} alt="" className="w-full h-full rounded-full object-cover" />
                          : '🚶'}
                      </div>
                      <span className="text-xs font-semibold text-gray-600">
                        {poster?.nickname ?? '名無し'}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-bold text-gray-500">
                      <span>{liked ? '💛' : '🤍'} {post.nice_count}</span>
                      <span>💬 {post.comment_count}</span>
                    </div>
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </main>
  )
}
