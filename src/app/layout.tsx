import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'sanpostar',
  description: '歩くだけで、必ずあなたが一位になれる瞬間がある',
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  )
}
