import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const alt = 'Code Company Wise — Free Alternative to LeetCode Premium'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#161616',
          fontFamily: 'sans-serif',
          padding: '60px',
        }}
      >
        {/* Logo row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '32px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '14px',
              backgroundColor: '#FFA116',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '32px',
              fontWeight: 'bold',
              color: '#161616',
            }}
          >
            {'</>'}
          </div>
          <span style={{ fontSize: '36px', fontWeight: 'bold', color: '#ffffff' }}>
            Code Company Wise
          </span>
        </div>

        {/* Headline */}
        <div
          style={{
            fontSize: '52px',
            fontWeight: 'bold',
            color: '#ffffff',
            textAlign: 'center',
            lineHeight: 1.2,
            marginBottom: '24px',
          }}
        >
          Free Alternative to{' '}
          <span style={{ color: '#FFA116' }}>LeetCode Premium</span>
        </div>

        {/* Subtext */}
        <div
          style={{
            fontSize: '26px',
            color: 'rgba(235,235,245,0.55)',
            textAlign: 'center',
            marginBottom: '48px',
          }}
        >
          Company-wise interview questions · 662 companies · Track your progress
        </div>

        {/* Pills */}
        <div style={{ display: 'flex', gap: '16px' }}>
          {['30 Days', '3 Months', '6 Months', 'All Time'].map(label => (
            <div
              key={label}
              style={{
                padding: '10px 24px',
                borderRadius: '999px',
                border: '1px solid rgba(255,161,22,0.4)',
                color: '#FFA116',
                fontSize: '20px',
                backgroundColor: 'rgba(255,161,22,0.1)',
              }}
            >
              {label}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  )
}
