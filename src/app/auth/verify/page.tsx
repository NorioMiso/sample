import Link from 'next/link'

export default function VerifyPage() {
  return (
    <main className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center">
        <div className="nb-card p-8">
          <div className="text-5xl mb-4">📬</div>
          <h2 className="text-2xl font-black mb-3">メールを確認してください</h2>
          <p className="text-sm font-semibold text-gray-600 leading-relaxed">
            確認メールを送信しました。<br />
            メール内のリンクをクリックして<br />
            登録を完了してください。
          </p>
        </div>
        <p className="text-sm font-semibold mt-4">
          <Link href="/auth/login" className="font-black underline">
            ログインページへ戻る
          </Link>
        </p>
      </div>
    </main>
  )
}
