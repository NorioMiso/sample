import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import WalkRecorder from './WalkRecorder'

export default async function WalkPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  return <WalkRecorder />
}
