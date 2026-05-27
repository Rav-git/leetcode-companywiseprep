import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Inter } from 'next/font/google'
import './globals.css'
import Navbar from '@/components/Navbar'
import AuthProvider from '@/components/AuthProvider'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Code Company Wise — LeetCode Company-wise Problems for Free',
  description:
    'Browse 662 companies and their real LeetCode interview questions by time period. Track your solving progress — free alternative to LeetCode Premium.',
  metadataBase: new URL('https://code-company-wise.vercel.app'),
  openGraph: {
    title: 'Code Company Wise — LeetCode Company-wise Problems for Free',
    description: 'Browse 662 companies and their real LeetCode interview questions. Filter by difficulty, time period, and solved status — 100% free.',
    url: 'https://code-company-wise.vercel.app',
    siteName: 'Code Company Wise',
    type: 'website',
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Code Company Wise' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Code Company Wise — LeetCode Company-wise Problems for Free',
    description: 'Browse 662 companies and their real LeetCode interview questions. 100% free.',
    images: ['/opengraph-image'],
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
