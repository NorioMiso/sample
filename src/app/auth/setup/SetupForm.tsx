'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { createClient } from '@/lib/supabase/client'

export default function SetupForm({ userId }: { userId: string }) {
  const router = useRouter()
  const supabase = createClient()

  const [nickname, setNickname]   = useState('')
  const [avatarFile, setAvatarFile] = useState<File | null>(null)
  const [preview, setPreview]     = useState<string | null>(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setError('画像は2MB以下にしてください')
      return
    }
    setAvatarFile(file)
    setPreview(URL.createObjectURL(file))
    setError(null)
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!nickname.trim()) {
      setError('ニックネームを入力してください')
      return
    }

    setLoading(true)
    setError(null)

    try {
      let iconUrl: string | null = null

      // アバター画像をアップロード
      if (avatarFile) {
        const ext  = avatarFile.name.split('.').pop()
        const path = `${userId}/avatar.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(path, avatarFile, { upsert: true })

        if (uploadError) throw new Error(uploadError.message)

        const { data: urlData } = supabase.storage
          .from('avatars')
          .getPublicUrl(path)
        iconUrl = urlData.publicUrl
      }

      // users テーブルに登録
      const { error: insertError } = await supabase.from('users').insert({
        auth_id:  userId,
        nickname: nickname.trim(),
        icon_url: iconUrl,
      })

      if (insertError) throw new Error(insertError.message)

      router.push('/')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : '登録に失敗しました')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      {/* アバター選択 */}
      <div className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="relative w-24 h-24 rounded-full border-2 border-black overflow-hidden"
          style={{ boxShadow: '3px 3px 0 #111' }}
        >
          {preview ? (
            <Image src={preview} alt="avatar preview" fill className="object-cover" />
          ) : (
            <div
              className="w-full h-full flex flex-col items-center justify-center gap-1"
              style={{ background: 'var(--yellow)' }}
            >
              <span className="text-2xl">🚶</span>
              <span className="text-xs font-bold">写真を選ぶ</span>
            </div>
          )}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onFileChange}
        />
        <p className="text-xs font-semibold text-gray-400">
          タップして画像を選択（任意）
        </p>
      </div>

      {/* ニックネーム */}
      <div>
        <label className="nb-label" htmlFor="nickname">ニックネーム</label>
        <input
          id="nickname"
          type="text"
          required
          maxLength={30}
          placeholder="あなたのニックネーム"
          value={nickname}
          onChange={(e) => setNickname(e.target.value)}
          className="nb-input"
        />
        <p className="text-xs font-semibold text-gray-400 mt-1">
          {nickname.length}/30
        </p>
      </div>

      {error && <p className="nb-error">{error}</p>}

      <button
        type="submit"
        disabled={loading}
        className="nb-btn nb-btn-green w-full"
      >
        {loading ? '登録中...' : 'はじめる 🌿'}
      </button>
    </form>
  )
}
