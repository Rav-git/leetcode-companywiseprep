import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#FFA116',
          borderRadius: '40px',
        }}
      >
        <div
          style={{
            color: '#111111',
            fontSize: '100px',
            fontWeight: 900,
            fontFamily: '"Arial Black", Arial, sans-serif',
            letterSpacing: '-12px',
            lineHeight: 1,
          }}
        >
          {'</>'}
        </div>
      </div>
    ),
    { ...size },
  )
}
