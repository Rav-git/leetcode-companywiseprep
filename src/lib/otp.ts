import { createHash } from 'crypto'

// SHA-256 not bcrypt: OTPs are short-lived (10 min) and already random,
// so bcrypt's deliberate slowness is unnecessary and adds latency.
export function hashOtp(code: string): string {
  return createHash('sha256').update(code).digest('hex')
}

// 6 digits: industry-standard OTP length — enough entropy for a 10-minute window
// with a 5-attempt hard limit before the record is deleted.
export function generateOtp(): string {
  return Math.floor(100000 + Math.random() * 900000).toString()
}
