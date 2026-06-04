import { NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
import {
  hashScryptPassword,
  isValidSignupEmail,
  normalizeSignupEmail,
  normalizeSignupUsername,
} from '@/lib/auth'

export const dynamic = 'force-dynamic'

interface RegisterBody {
  email?: unknown
  username?: unknown
  password?: unknown
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as RegisterBody
    const email = typeof body.email === 'string' ? normalizeSignupEmail(body.email) : ''
    const username = typeof body.username === 'string' ? normalizeSignupUsername(body.username) : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!email || !username || !password) {
      return NextResponse.json({ error: 'Email, username, and password are required.' }, { status: 400 })
    }

    if (username.length < 3) {
      return NextResponse.json({ error: 'Username must be at least 3 characters.' }, { status: 400 })
    }

    if (!isValidSignupEmail(email)) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
    }

    const existing = await dbQuery<{ id: string | number }>(
      `
        SELECT id
        FROM public.accounts
        WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($2)
        LIMIT 1
      `,
      [username, email],
    )

    if (existing.rows.length > 0) {
      return NextResponse.json({ error: 'Username or email already exists.' }, { status: 409 })
    }

    const passwordHash = hashScryptPassword(password)
    const inserted = await dbQuery<{
      id: string | number
      username: string
      display_name: string | null
      email: string
    }>(
      `
        INSERT INTO public.accounts (username, email, password_hash, display_name, role, is_active, email_verified, created_at, updated_at)
        VALUES ($1, $2, $3, $1, 'user', TRUE, FALSE, NOW(), NOW())
        RETURNING id, username, display_name, email
      `,
      [username, email, passwordHash],
    )

    const account = inserted.rows[0]
    return NextResponse.json({
      user: {
        id: String(account.id),
        username: account.username,
        displayName: account.display_name,
        email: account.email,
      },
    })
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && (error as { code?: string }).code === '23505') {
      return NextResponse.json({ error: 'Username or email already exists.' }, { status: 409 })
    }

    console.error('auth register error:', error)
    return NextResponse.json({ error: 'Account creation failed.' }, { status: 500 })
  }
}