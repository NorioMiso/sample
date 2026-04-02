'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV_ITEMS = [
  { href: '/',         icon: '🏠', label: 'ホーム' },
  { href: '/courses',  icon: '🗺️', label: 'さんぽを探す' },
  { href: '/records',  icon: '📍', label: 'きろく' },
  { href: '/profile',  icon: '👤', label: 'マイページ' },
]

export default function BottomNav() {
  const pathname = usePathname()

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        background: 'var(--surface)',
        borderTop: '3px solid var(--ink)',
        display: 'flex',
        padding: '10px 0 calc(10px + env(safe-area-inset-bottom))',
        zIndex: 50,
      }}
    >
      {NAV_ITEMS.map(item => {
        const isActive = item.href === '/'
          ? pathname === '/'
          : pathname.startsWith(item.href)

        return (
          <Link
            key={item.href}
            href={item.href}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '3px',
              textDecoration: 'none',
            }}
          >
            <span
              style={{
                width: 36,
                height: 36,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 12,
                fontSize: 18,
                background: isActive ? 'var(--yellow)' : 'transparent',
                border: isActive ? '2px solid var(--ink)' : '2px solid transparent',
                boxShadow: isActive ? '2px 2px 0 var(--ink)' : 'none',
              }}
            >
              {item.icon}
            </span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 800,
                color: isActive ? 'var(--ink)' : 'var(--ink-soft)',
                letterSpacing: '0.03em',
              }}
            >
              {item.label}
            </span>
          </Link>
        )
      })}
    </nav>
  )
}
