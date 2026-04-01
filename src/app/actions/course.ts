'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'

// ── コース投稿を作成する ─────────────────────────────────────────
export async function createCoursePost(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .maybeSingle()
  if (!profile) redirect('/auth/setup')

  const walkRecordId = formData.get('walk_record_id') as string | null
  const title        = (formData.get('title') as string).trim()
  const comment      = (formData.get('comment') as string | null)?.trim() || null
  const isPublic     = formData.get('is_public') === 'true'

  if (!title) return

  // walk_routes から route_geojson をコピー
  let routeGeojson = null
  if (walkRecordId) {
    const { data: route } = await supabase
      .from('walk_routes')
      .select('route_geojson')
      .eq('walk_record_id', walkRecordId)
      .maybeSingle()
    routeGeojson = route?.route_geojson ?? null
  }

  const { data: post, error } = await supabase
    .from('course_posts')
    .insert({
      user_id:        profile.id,
      walk_record_id: walkRecordId || null,
      title,
      comment,
      route_geojson:  routeGeojson,
      is_public:      isPublic,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  redirect(`/courses/${post.id}`)
}

// ── コメントを追加する ──────────────────────────────────────────
export async function addComment(formData: FormData) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .maybeSingle()
  if (!profile) redirect('/auth/setup')

  const coursePostId = formData.get('course_post_id') as string
  const body         = (formData.get('body') as string).trim()

  if (!body) return

  await supabase.from('course_comments').insert({
    user_id:       profile.id,
    course_post_id: coursePostId,
    body,
  })

  // コース投稿主にコメント通知（自分のコースへのコメントのみ）
  const { data: post } = await supabase
    .from('course_posts')
    .select('user_id, title')
    .eq('id', coursePostId)
    .maybeSingle()

  if (post && post.user_id !== profile.id) {
    const { data: commenter } = await supabase
      .from('users')
      .select('nickname')
      .eq('id', profile.id)
      .maybeSingle()

    const admin = createAdminClient()
    await admin.from('notifications').insert({
      user_id:      post.user_id,
      type:         'comment',
      title:        `💬 ${commenter?.nickname ?? '誰か'}がコメントしました`,
      body:         `「${post.title}」に: ${body.slice(0, 50)}${body.length > 50 ? '…' : ''}`,
      related_id:   coursePostId,
      related_type: 'course_post',
    })
  }

  revalidatePath(`/courses/${coursePostId}`)
}

// ── コメントを削除する ──────────────────────────────────────────
export async function deleteComment(commentId: string, coursePostId: string) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .maybeSingle()
  if (!profile) return

  await supabase
    .from('course_comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', profile.id)

  revalidatePath(`/courses/${coursePostId}`)
}

// ── ナイス散歩をトグルする ──────────────────────────────────────
export async function toggleNiceSanpo(coursePostId: string): Promise<{ liked: boolean }> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { liked: false }

  const { data: profile } = await supabase
    .from('users')
    .select('id')
    .eq('auth_id', user.id)
    .maybeSingle()
  if (!profile) return { liked: false }

  const { data: existing } = await supabase
    .from('nice_sanpos')
    .select('id')
    .eq('user_id', profile.id)
    .eq('course_post_id', coursePostId)
    .maybeSingle()

  if (existing) {
    await supabase.from('nice_sanpos').delete().eq('id', existing.id)
    revalidatePath(`/courses/${coursePostId}`)
    return { liked: false }
  } else {
    await supabase.from('nice_sanpos').insert({ user_id: profile.id, course_post_id: coursePostId })

    // コース投稿主にナイス通知（自分のコースへのナイスのみ）
    const { data: post } = await supabase
      .from('course_posts')
      .select('user_id, title')
      .eq('id', coursePostId)
      .maybeSingle()

    if (post && post.user_id !== profile.id) {
      const { data: liker } = await supabase
        .from('users')
        .select('nickname')
        .eq('id', profile.id)
        .maybeSingle()

      const admin = createAdminClient()
      await admin.from('notifications').insert({
        user_id:      post.user_id,
        type:         'nice_sanpo',
        title:        `💛 ${liker?.nickname ?? '誰か'}がナイス散歩！しました`,
        body:         `「${post.title}」がナイスされました`,
        related_id:   coursePostId,
        related_type: 'course_post',
      })
    }

    revalidatePath(`/courses/${coursePostId}`)
    return { liked: true }
  }
}
