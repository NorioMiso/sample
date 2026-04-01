import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { signOut } from '@/app/actions/auth'

export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('users')
    .select('nickname, icon_url')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (!profile) redirect('/auth/setup')

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-6 gap-6">
      <div className="text-center">
        <h1 className="text-4xl font-black tracking-tight">sanpostar</h1>
        <p className="text-sm font-semibold text-gray-500 mt-1">
          歩くだけで、必ずあなたが一位になれる瞬間がある
        </p>
      </div>

      <div className="nb-card p-6 w-full max-w-sm text-center">
        <div className="text-4xl mb-3">🚶</div>
        <p className="font-black text-lg">
          ようこそ、{profile.nickname}さん！
        </p>
        <p className="text-sm font-semibold text-gray-500 mt-1">
          散歩機能は順次実装中です。
        </p>
      </div>

      <form action={signOut}>
        <button type="submit" className="nb-btn nb-btn-white text-sm">
          ログアウト
        </button>
      </form>
    </main>
  )
}
