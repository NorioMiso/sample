import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'サンポスター',
  description: '歩き出したら誰もが何かしらのサンポスター★',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" className="h-full">
      <body className="min-h-full flex flex-col" style={{ background: 'var(--bg)' }}>
        {children}
      </body>
    </html>
  )
}
