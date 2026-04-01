'use client'

import { useRef, useState } from 'react'
import { createCoursePost } from '@/app/actions/course'

type Props = {
  walkRecordId: string | null
}

export default function NewCourseForm({ walkRecordId }: Props) {
  const [isPublic, setIsPublic] = useState(true)
  const [loading, setLoading]   = useState(false)
  const formRef = useRef<HTMLFormElement>(null)

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    await createCoursePost(formData)
    // redirect happens server-side, so loading stays true until navigation
  }

  return (
    <form ref={formRef} action={handleSubmit} className="flex flex-col gap-4">
      {walkRecordId && (
        <input type="hidden" name="walk_record_id" value={walkRecordId} />
      )}
      <input type="hidden" name="is_public" value={String(isPublic)} />

      {/* タイトル */}
      <div>
        <label className="nb-label">コース名 *</label>
        <input
          name="title"
          type="text"
          required
          placeholder="例：川沿い朝散歩コース"
          className="nb-input"
          maxLength={100}
        />
      </div>

      {/* コメント */}
      <div>
        <label className="nb-label">ひとことコメント</label>
        <textarea
          name="comment"
          placeholder="このコースの見どころや感想を書いてみましょう"
          className="nb-input"
          rows={3}
          maxLength={500}
          style={{ resize: 'none' }}
        />
      </div>

      {/* 公開設定 */}
      <div className="nb-card p-4 flex items-center justify-between">
        <div>
          <p className="font-black text-sm">公開設定</p>
          <p className="text-xs text-gray-500 mt-0.5">
            {isPublic ? 'みんなに公開されます' : '自分だけ見られます'}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setIsPublic(v => !v)}
          className={`nb-btn text-sm py-1 px-4 ${isPublic ? 'nb-btn-green' : 'nb-btn-white'}`}
        >
          {isPublic ? '公開' : '非公開'}
        </button>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="nb-btn nb-btn-coral w-full justify-center"
        style={{ opacity: loading ? 0.7 : 1 }}
      >
        {loading ? '保存中…' : '🗺️ コースをシェアする'}
      </button>
    </form>
  )
}
