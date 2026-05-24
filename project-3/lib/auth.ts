import crypto from 'crypto'

export function hashScryptPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function normalizeSignupUsername(value: string): string {
  return value.trim()
}

export function normalizeSignupEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function isValidSignupEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
}

export function verifyScryptPassword(password: string, storedHash: string): boolean {
  const [salt, originalHash] = storedHash.split(':')
  if (!salt || !originalHash) return false

  const attemptedHash = crypto.scryptSync(password, salt, 64).toString('hex')
  const originalBuffer = Buffer.from(originalHash, 'hex')
  const attemptedBuffer = Buffer.from(attemptedHash, 'hex')

  if (originalBuffer.length !== attemptedBuffer.length) return false
  return crypto.timingSafeEqual(originalBuffer, attemptedBuffer)
}
