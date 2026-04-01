'use client'

import { useState, useTransition } from 'react'
import { toggleNiceSanpo } from '@/app/actions/course'

type Props = {
  coursePostId: string
  initialLiked: boolean
  initialCount: number
}

export default function NiceSanpoButton({ coursePostId, initialLiked, initialCount }: Props) {
  const [liked, setLiked]   = useState(initialLiked)
  const [count, setCount]   = useState(initialCount)
  const [pending, startTransition] = useTransition()

  function handleClick() {
    startTransition(async () => {
      const result = await toggleNiceSanpo(coursePostId)
      setLiked(result.liked)
      setCount(c => result.liked ? c + 1 : c - 1)
    })
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className={`nb-btn w-full justify-center ${liked ? 'nb-btn-yellow' : 'nb-btn-white'}`}
      style={{ opacity: pending ? 0.7 : 1 }}
    >
      {liked ? '💛' : '🤍'} ナイス散歩！ {count > 0 && `(${count})`}
    </button>
  )
}
