import { NextResponse } from 'next/server'
import nodemailer from 'nodemailer'

export const dynamic = 'force-dynamic'

function hasValidAdminKey(req: Request): boolean {
  const expected = process.env.DB_ADMIN_KEY?.trim()
  if (!expected) return true
  return req.headers.get('x-admin-key')?.trim() === expected
}

export async function POST(req: Request) {
  if (!hasValidAdminKey(req)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
  }

  const user = process.env.EMAIL_USER?.trim()
  const pass = process.env.EMAIL_PASS?.trim()

  if (!user || !pass) {
    return NextResponse.json(
      {
        ok: false,
        stage: 'env',
        detail: {
          emailUserSet: Boolean(user),
          emailPassSet: Boolean(pass),
        },
      },
      { status: 500 },
    )
  }

  try {
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user, pass },
    })

    const verify = await transporter.verify()

    const info = await transporter.sendMail({
      from: `"TravelSync" <${user}>`,
      to: user,
      subject: 'TravelSync detailed email test',
      html: '<p>Detailed email diagnostic test.</p>',
    })

    return NextResponse.json({
      ok: true,
      stage: 'send',
      verify,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      {
        ok: false,
        stage: 'send',
        error: message,
      },
      { status: 500 },
    )
  }
}
