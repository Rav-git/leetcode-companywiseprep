import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

function makeRedis() {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null
  return new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  })
}

function makeLimiter(requests: number, window: `${number} ${'s' | 'm' | 'h' | 'd'}`) {
  const redis = makeRedis()
  if (!redis) return null
  return new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(requests, window) })
}

// 5 sign-up attempts per hour per IP — prevents email/quota spam
export const registerLimiter = makeLimiter(5, '1 h')

// 10 OTP verify attempts per 10 min per IP — backs up the in-DB attempt counter
export const verifyOtpLimiter = makeLimiter(10, '10 m')

// 3 resend requests per 10 min per email — prevents email flooding
export const resendOtpLimiter = makeLimiter(3, '10 m')

// 60 solve actions per minute per user — prevents DB spam
export const solveLimiter = makeLimiter(60, '1 m')

export function getIp(req: Request): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}
