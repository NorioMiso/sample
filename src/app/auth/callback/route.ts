import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/auth/setup'

  if (code) {
    const supabase = await createClient()
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error && data.user) {
      // プロフィール済みならホームへ
      const { data: profile } = await supabase
        .from('users')
        .select('id')
        .eq('auth_id', data.user.id)
        .maybeSingle()

      return NextResponse.redirect(`${origin}${profile ? '/' : next}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_error`)
}
