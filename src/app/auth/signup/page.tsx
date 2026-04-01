import Link from 'next/link'
import { signUp } from '@/app/actions/auth'

type Props = {
  searchParams: Promise<{ error?: string }>
}

export default async function SignupPage({ searchParams }: Props) {
  const { error } = await searchParams

  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* ロゴ */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black tracking-tight">sanpostar</h1>
          <p className="text-sm font-semibold mt-1 text-gray-500">
            歩くだけで、必ずあなたが一位になれる瞬間がある
          </p>
        </div>

        <div className="nb-card p-6">
          <h2 className="text-xl font-black mb-5">アカウント作成</h2>

          <form action={signUp} className="flex flex-col gap-4">
            <div>
              <label className="nb-label" htmlFor="email">メールアドレス</label>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="nb-input"
              />
            </div>

            <div>
              <label className="nb-label" htmlFor="password">パスワード</label>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="new-password"
                placeholder="8文字以上"
                minLength={8}
                className="nb-input"
              />
            </div>

            {error && (
              <p className="nb-error">{decodeURIComponent(error)}</p>
            )}

            <button type="submit" className="nb-btn nb-btn-yellow w-full mt-1">
              登録する
            </button>
          </form>
        </div>

        <p className="text-center text-sm font-semibold mt-4">
          すでにアカウントをお持ちの方は{' '}
          <Link href="/auth/login" className="font-black underline">
            ログイン
          </Link>
        </p>
      </div>
    </main>
  )
}
