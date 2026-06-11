import { NextResponse } from 'next/server'
import { sendEmail } from '@/lib/email'

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

  const emailUser = process.env.EMAIL_USER?.trim()
  const emailPass = process.env.EMAIL_PASS?.trim()

  // Check 1: Are env vars set?
  if (!emailUser || !emailPass) {
    return NextResponse.json({
      ok: false,
      check: 'env_vars',
      result: 'FAIL',
      detail: `EMAIL_USER=${emailUser ? 'set' : 'MISSING'}, EMAIL_PASS=${emailPass ? 'set' : 'MISSING'}`,
    }, { status: 500 })
  }

  // Check 2: Try sending a real email
  const to = emailUser // send to yourself as a smoke test
  const subject = 'TravelSync — Email Test'
  const html = `
    <div style="font-family:Arial,sans-serif;padding:20px;background:#f7f5f0;">
      <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;border:1px solid #edeae2;">
        <p style="font-size:12px;text-transform:uppercase;letter-spacing:0.08em;color:#7a9e8e;font-weight:700;margin:0 0 8px;">TravelSync Email Test</p>
        <h2 style="margin:0 0 12px;font-size:20px;color:#2c2b28;">✅ Email system is working</h2>
        <p style="color:#5c5a56;line-height:1.6;margin:0;">
          This is a test email triggered from the admin panel.<br/>
          ENV: EMAIL_USER is <strong>${emailUser}</strong>.
        </p>
      </div>
    </div>
  `

  try {
    await sendEmail({ to, subject, html })
    return NextResponse.json({
      ok: true,
      check: 'send_email',
      result: 'PASS',
      detail: `Email sent to ${to}`,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return NextResponse.json({
      ok: false,
      check: 'send_email',
      result: 'FAIL',
      detail: message,
    }, { status: 500 })
  }
}
