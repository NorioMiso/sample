'use client'

import { useRef, useState, useTransition } from 'react'
import { addComment, deleteComment } from '@/app/actions/course'

type Comment = {
  id: string
  user_id: string
  body: string
  created_at: string
  poster: { nickname: string; icon_url: string | null } | null
}

type Props = {
  coursePostId: string
  comments: Comment[]
  myUserId: string | null
}

export default function CommentSection({ coursePostId, comments, myUserId }: Props) {
  const formRef = useRef<HTMLFormElement>(null)
  const [pending, startTransition] = useTransition()
  const [deleting, setDeleting] = useState<string | null>(null)

  function handleSubmit(formData: FormData) {
    startTransition(async () => {
      await addComment(formData)
      formRef.current?.reset()
    })
  }

  function handleDelete(commentId: string) {
    setDeleting(commentId)
    startTransition(async () => {
      await deleteComment(commentId, coursePostId)
      setDeleting(null)
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <h3 className="font-black text-sm">コメント ({comments.length})</h3>

      {comments.length === 0 && (
        <p className="text-sm text-gray-400 font-semibold text-center py-3">
          まだコメントがありません
        </p>
      )}

      <div className="flex flex-col gap-3">
        {comments.map(c => (
          <div key={c.id} className="nb-card p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-2 mb-1">
                <div
                  className="w-6 h-6 rounded-full flex items-center justify-center text-xs shrink-0"
                  style={{ background: 'var(--yellow)', border: '1.5px solid black' }}
                >
                  {c.poster?.icon_url
                    ? <img src={c.poster.icon_url} alt="" className="w-full h-full rounded-full object-cover" />
                    : '🚶'}
                </div>
                <span className="text-xs font-bold">{c.poster?.nickname ?? '名無し'}</span>
              </div>
              {myUserId === c.user_id && (
                <button
                  onClick={() => handleDelete(c.id)}
                  disabled={deleting === c.id}
                  className="text-xs text-gray-400 hover:text-red-500 shrink-0"
                >
                  削除
                </button>
              )}
            </div>
            <p className="text-sm leading-relaxed">{c.body}</p>
          </div>
        ))}
      </div>

      {myUserId && (
        <form ref={formRef} action={handleSubmit} className="flex flex-col gap-2">
          <input type="hidden" name="course_post_id" value={coursePostId} />
          <textarea
            name="body"
            required
            placeholder="コメントを書く…"
            className="nb-input text-sm"
            rows={2}
            maxLength={300}
            style={{ resize: 'none' }}
          />
          <button
            type="submit"
            disabled={pending}
            className="nb-btn nb-btn-black w-full justify-center text-sm"
            style={{ opacity: pending ? 0.7 : 1 }}
          >
            {pending ? '送信中…' : '送信'}
          </button>
        </form>
      )}
    </div>
  )
}
