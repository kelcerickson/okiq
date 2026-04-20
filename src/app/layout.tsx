import type { Metadata } from 'next'
import './globals.css'
import BottomNav from '@/components/BottomNav'

export const metadata: Metadata = {
  title: 'OK IQ — Club Stat Tracker',
  description: 'Youth soccer stat tracking for club teams',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body style={{ paddingBottom: 70 }}>
        {children}
        <BottomNav />
      </body>
    </html>
  )
}
