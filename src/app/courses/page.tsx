import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { formatDistance } from '@/lib/utils/geo'
import BottomNav from '@/app/components/BottomNav'

// サムネイル背景色をインデックスで循環
const THUMB_BG = ['#E8F5EB', '#FEF9C3', '#DBEAFE', '#FFE4E1', '#EDE9FE', '#DCFCE7']
const THUMB_EMOJI = ['🌸', '🌙', '🌳', '🐱', '🌊', '🏮', '🌅', '🏡', '⛩️', '🌿']

function thumbBg(i: number)    { return THUMB_BG[i % THUMB_BG.length] }
function thumbEmoji(i: number) { return THUMB_EMOJI[i % THUMB_EMOJI.length] }

export default async function CoursesPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .maybeSingle()

  // 全公開コース（最新30件）
  const { data: posts } = await supabase
    .from('course_posts')
    .select('id, title, comment, nice_count, comment_count, walked_count, created_at, walk_record_id, user_id')
    .eq('is_public', true)
    .order('created_at', { ascending: false })
    .limit(30)

  const allPosts = posts ?? []

  // 投稿者情報
  const userIds = [...new Set(allPosts.map(p => p.user_id))]
  const { data: users } = userIds.length
    ? await supabase.from('users').select('id, nickname, icon_url').in('id', userIds)
    : { data: [] }
  const userMap = new Map((users ?? []).map(u => [u.id, u]))

  // 距離情報
  const recordIds = allPosts.map(p => p.walk_record_id).filter(Boolean) as string[]
  const { data: walkData } = recordIds.length
    ? await supabase.from('walk_records').select('id, distance_meters').in('id', recordIds)
    : { data: [] }
  const walkMap = new Map((walkData ?? []).map(w => [w.id, w]))

  // 自分がナイスした投稿ID
  const { data: myNices } = profile
    ? await supabase.from('nice_sanpos').select('course_post_id').eq('user_id', profile.id)
    : { data: [] }
  const nicedSet = new Set((myNices ?? []).map(n => n.course_post_id))

  // 注目（nice_count 上位3件）
  const featured = [...allPosts].sort((a, b) => b.nice_count - a.nice_count).slice(0, 3)
  // 新着（最新順、注目以外）
  const featuredIds = new Set(featured.map(p => p.id))
  const recent = allPosts.filter(p => !featuredIds.has(p.id))

  return (
    <main
      className="min-h-screen flex flex-col max-w-sm mx-auto"
      style={{ paddingBottom: 'calc(80px + env(safe-area-inset-bottom))' }}
    >
      {/* ヘッダー */}
      <div style={{ padding: '16px 20px 12px' }}>
        <h1 style={{
          fontFamily: "'Kaisei Decol', serif",
          fontSize: 22, fontWeight: 700,
          color: 'var(--ink)', marginBottom: 12,
        }}>
          🗺️ さんぽを探す
        </h1>
        {/* 検索バー（見た目のみ） */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          background: 'var(--surface)', border: '2.5px solid var(--ink)',
          borderRadius: 16, boxShadow: '3px 3px 0 var(--ink)',
          padding: '10px 14px',
        }}>
          <span style={{ fontSize: 16 }}>🔍</span>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--ink-soft)' }}>
            コース名・エリアで探す
          </span>
        </div>
      </div>

      {/* フィルタータグ（横スクロール） */}
      <div style={{
        display: 'flex', gap: 8,
        padding: '0 16px 14px',
        overflowX: 'auto',
        scrollbarWidth: 'none',
      }}>
        {['すべて', '📍 近くの', '🌙 夜さんぽ', '🌅 朝さんぽ', '🌳 公園', '🐱 猫スポット', '👟 5km以上'].map((tag, i) => (
          <span key={tag} style={{
            flexShrink: 0,
            background: i === 0 ? 'var(--yellow)' : 'var(--surface)',
            border: '2.5px solid var(--ink)',
            borderRadius: 20, padding: '6px 14px',
            fontSize: 12, fontWeight: 900, color: 'var(--ink)',
            boxShadow: '2px 2px 0 var(--ink)',
            whiteSpace: 'nowrap',
          }}>
            {tag}
          </span>
        ))}
      </div>

      {allPosts.length === 0 ? (
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🗺️</div>
          <p style={{ fontSize: 16, fontWeight: 900, marginBottom: 6 }}>まだコースがありません</p>
          <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--ink-soft)' }}>
            散歩後にコースをシェアしてみましょう！
          </p>
        </div>
      ) : (
        <>
          {/* 注目のさんぽ */}
          {featured.length > 0 && (
            <>
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                margin: '0 16px 10px',
              }}>
                <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: '0.05em' }}>⭐ 注目のさんぽ</span>
              </div>

              <div style={{
                display: 'flex', gap: 12,
                overflowX: 'auto', scrollbarWidth: 'none',
                padding: '0 16px 4px',
                marginBottom: 20,
              }}>
                {featured.map((post, i) => {
                  const poster = userMap.get(post.user_id)
                  const walk   = post.walk_record_id ? walkMap.get(post.walk_record_id) : null

                  return (
                    <Link key={post.id} href={`/courses/${post.id}`} style={{ textDecoration: 'none', flexShrink: 0 }}>
                      <div style={{
                        width: 240, background: 'var(--surface)',
                        border: '2.5px solid var(--ink)', borderRadius: 20,
                        boxShadow: '3px 3px 0 var(--ink)', overflow: 'hidden',
                        cursor: 'pointer',
                      }}>
                        {/* サムネイル */}
                        <div style={{
                          height: 110, background: thumbBg(i),
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 40, position: 'relative',
                        }}>
                          {thumbEmoji(i)}
                          <div style={{
                            position: 'absolute', top: 8, left: 8,
                            background: 'var(--yellow)', border: '2px solid var(--ink)',
                            borderRadius: 10, padding: '3px 8px',
                            fontSize: 10, fontWeight: 900,
                          }}>
                            {i === 0 ? '👟 人気No.1' : i === 1 ? '✨ 注目' : '🌟 おすすめ'}
                          </div>
                        </div>
                        {/* ボディ */}
                        <div style={{ padding: '12px 14px' }}>
                          <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 4, color: 'var(--ink)' }}>
                            {post.title}
                          </div>
                          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 8 }}>
                            {walk ? formatDistance(walk.distance_meters) : '—'}
                            {post.comment ? `　${post.comment.slice(0, 20)}…` : ''}
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 800, color: 'var(--ink-soft)' }}>
                              <div style={{
                                width: 20, height: 20, borderRadius: '50%',
                                border: '1.5px solid var(--ink)', background: 'var(--yellow)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 11,
                              }}>
                                {poster?.icon_url
                                  ? <img src={poster.icon_url} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                  : '🚶'}
                              </div>
                              {poster?.nickname ?? '名無し'}
                            </div>
                            <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--ink-soft)' }}>
                              {nicedSet.has(post.id) ? '💛' : '👟'} {post.nice_count}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </>
          )}

          {/* 新着さんぽ */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            margin: '0 16px 10px',
          }}>
            <span style={{ fontSize: 13, fontWeight: 900, letterSpacing: '0.05em' }}>🆕 新着さんぽ</span>
            <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--green-dark)' }}>全{allPosts.length}件</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: '0 16px' }}>
            {(recent.length > 0 ? recent : allPosts).map((post, i) => {
              const poster = userMap.get(post.user_id)
              const walk   = post.walk_record_id ? walkMap.get(post.walk_record_id) : null
              const liked  = nicedSet.has(post.id)

              return (
                <Link key={post.id} href={`/courses/${post.id}`} style={{ textDecoration: 'none' }}>
                  <div style={{
                    background: 'var(--surface)', border: '2.5px solid var(--ink)',
                    borderRadius: 18, boxShadow: '3px 3px 0 var(--ink)',
                    padding: '14px 16px',
                    display: 'flex', alignItems: 'center', gap: 12,
                    cursor: 'pointer',
                  }}>
                    {/* サムネイル */}
                    <div style={{
                      width: 56, height: 56,
                      borderRadius: 14, border: '2px solid var(--ink)',
                      background: thumbBg(i + 3),
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 26, flexShrink: 0,
                    }}>
                      {thumbEmoji(i + 3)}
                    </div>

                    {/* テキスト */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--ink)', marginBottom: 3 }}>
                        {post.title}
                      </div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ink-soft)', marginBottom: 5 }}>
                        {walk ? formatDistance(walk.distance_meters) : '距離不明'}
                        {poster ? `　by ${poster.nickname ?? '名無し'}` : ''}
                      </div>
                      {post.comment && (
                        <div style={{
                          fontSize: 11, fontWeight: 600, color: 'var(--ink-soft)',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>
                          {post.comment}
                        </div>
                      )}
                    </div>

                    {/* 右側 */}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, flexShrink: 0 }}>
                      <span style={{ fontSize: 12, fontWeight: 900, color: 'var(--ink-soft)' }}>
                        {liked ? '💛' : '👟'} {post.nice_count}
                      </span>
                      {post.walked_count > 0 && (
                        <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--green-dark)' }}>
                          🚶 {post.walked_count}人
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </>
      )}

      <BottomNav />
    </main>
  )
}
