import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { revalidatePath } from 'next/cache'

// 全通知を既読にするサーバーアクション
async function markAllRead() {
  'use server'
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: profile } = await supabase
    .from('users').select('id').eq('auth_id', user.id).maybeSingle()
  if (!profile) return

  await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('user_id', profile.id)
    .eq('is_read', false)

  revalidatePath('/notifications')
}

const TYPE_ICON: Record<string, string> = {
  praise_daily:  '🌅',
  personal_best: '🏆',
  badge_earned:  '🏅',
  nice_sanpo:    '💛',
  comment:       '💬',
  new_favorite:  '⭐',
}

function relatedLink(type: string, relatedId: string | null, relatedType: string | null) {
  if (!relatedId) return null
  if (relatedType === 'course_post') return `/courses/${relatedId}`
  if (relatedType === 'badge')       return `/profile`
  return null
}

export default async function NotificationsPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('users').select('id').eq('auth_id', user.id).maybeSingle()
  if (!profile) redirect('/auth/setup')

  const { data: notifications } = await supabase
    .from('notifications')
    .select('*')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const unreadCount = (notifications ?? []).filter(n => !n.is_read).length

  return (
    <main className="min-h-screen flex flex-col p-4 gap-4 max-w-sm mx-auto pb-10">
      <div className="flex items-center justify-between pt-4">
        <Link href="/" className="text-sm font-bold">← ホーム</Link>
        <h1 className="text-xl font-black">
          通知
          {unreadCount > 0 && (
            <span className="ml-2 text-sm font-bold text-white bg-red-500 rounded-full px-2 py-0.5">
              {unreadCount}
            </span>
          )}
        </h1>
        {unreadCount > 0 ? (
          <form action={markAllRead}>
            <button type="submit" className="text-xs font-bold text-gray-500 underline">
              全既読
            </button>
          </form>
        ) : (
          <div className="w-12" />
        )}
      </div>

      {(!notifications || notifications.length === 0) ? (
        <div className="nb-card p-8 text-center mt-8">
          <p className="text-3xl mb-3">🔔</p>
          <p className="font-black">通知はまだありません</p>
          <p className="text-sm text-gray-500 mt-1">散歩を記録すると通知が届きます</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {notifications.map(n => {
            const link = relatedLink(n.type, n.related_id, n.related_type)
            const icon = TYPE_ICON[n.type] ?? '🔔'

            const inner = (
              <div
                className={`nb-card p-4 flex items-start gap-3 ${!n.is_read ? 'border-l-4' : ''}`}
                style={{
                  background:  n.is_read ? 'var(--bg)' : 'white',
                  borderLeftColor: n.is_read ? undefined : 'var(--coral)',
                }}
              >
                <span className="text-2xl shrink-0 mt-0.5">{icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-black text-sm leading-snug">{n.title}</p>
                  {n.body && (
                    <p className="text-xs text-gray-600 mt-0.5 leading-snug">{n.body}</p>
                  )}
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(n.created_at).toLocaleString('ja-JP', {
                      month: 'numeric', day: 'numeric',
                      hour: '2-digit', minute: '2-digit',
                    })}
                  </p>
                </div>
                {!n.is_read && (
                  <div className="w-2 h-2 rounded-full bg-red-500 shrink-0 mt-1" />
                )}
              </div>
            )

            return link
              ? <Link key={n.id} href={link}>{inner}</Link>
              : <div key={n.id}>{inner}</div>
          })}
        </div>
      )}
    </main>
  )
}
