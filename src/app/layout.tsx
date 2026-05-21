import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'
import AuthProvider from '@/components/AuthProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Code Company Wise — LeetCode Interview Prep',
  description:
    'Browse 662 companies and their LeetCode interview questions. Track your solving progress for free.',
  metadataBase: new URL('https://code-company-wise.vercel.app'),
  openGraph: {
    title: 'Code Company Wise — LeetCode Interview Prep',
    description: 'Browse 662 companies and their LeetCode interview questions. Free LeetCode Premium alternative.',
    url: 'https://code-company-wise.vercel.app',
    siteName: 'Code Company Wise',
    type: 'website',
  },
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} text-white`} style={{ backgroundColor: '#161616' }}>
        <AuthProvider>
          <Navbar />
          {children}
        </AuthProvider>
      </body>
    </html>
  )
}
