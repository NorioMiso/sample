import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import SetupForm from './SetupForm'

export default async function SetupPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/auth/login')

  // すでにプロフィール登録済みならホームへ
  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .maybeSingle()

  if (profile) redirect('/')

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black tracking-tight">sanpostar</h1>
          <p className="text-sm font-semibold mt-1 text-gray-500">
            さあ、はじめましょう
          </p>
        </div>

        <div className="nb-card p-6">
          <h2 className="text-xl font-black mb-1">プロフィール設定</h2>
          <p className="text-xs font-semibold text-gray-500 mb-5">
            ニックネームとアイコンを設定してください
          </p>
          <SetupForm userId={user.id} />
        </div>
      </div>
    </main>
  )
}
