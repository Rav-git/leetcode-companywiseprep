import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 32, height: 32 }
export const contentType = 'image/png'

export default function Icon() {
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
          borderRadius: '7px',
        }}
      >
        <div
          style={{
            color: '#111111',
            fontSize: '26px',
            fontWeight: 900,
            fontFamily: '"Arial Black", Arial, sans-serif',
            letterSpacing: '-3px',
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
