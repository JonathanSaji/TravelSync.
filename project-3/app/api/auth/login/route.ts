import { NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db'
import { verifyScryptPassword } from '@/lib/auth'

export const dynamic = 'force-dynamic'

interface LoginBody {
  username?: unknown
  password?: unknown
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as LoginBody
    const username = typeof body.username === 'string' ? body.username.trim() : ''
    const password = typeof body.password === 'string' ? body.password : ''

    if (!username || !password) {
      return NextResponse.json({ error: 'Username and password are required.' }, { status: 400 })
    }

    const result = await dbQuery<{
      id: string | number
      username: string
      display_name: string | null
      password_hash: string
      is_active: boolean
    }>(
      `
        SELECT id, username, display_name, password_hash, is_active
        FROM public.accounts
        WHERE username = $1
        LIMIT 1
      `,
      [username],
    )

    const account = result.rows[0]
    if (!account || !account.is_active) {
      return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 })
    }

    const ok = verifyScryptPassword(password, account.password_hash)
    if (!ok) {
      return NextResponse.json({ error: 'Invalid username or password.' }, { status: 401 })
    }

    await dbQuery(
      `
        UPDATE public.accounts
        SET last_login_at = NOW(), updated_at = NOW()
        WHERE id = $1
      `,
      [account.id],
    )

    return NextResponse.json({
      user: {
        id: String(account.id),
        username: account.username,
        displayName: account.display_name,
      },
    })
  } catch (error) {
    console.error('auth login error:', error)
    return NextResponse.json({ error: 'Login failed.' }, { status: 500 })
  }
}
