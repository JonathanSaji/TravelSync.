import nodemailer from 'nodemailer'

function getTransporter() {
  const user = process.env.EMAIL_USER?.trim()
  const pass = process.env.EMAIL_PASS?.trim()

  if (!user || !pass) {
    throw new Error('EMAIL_USER and EMAIL_PASS must be set in environment variables.')
  }

  return nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass },
  })
}

export interface EmailPayload {
  to: string | string[]
  subject: string
  html: string
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const transporter = getTransporter()
  const from = `"TravelSync" <${process.env.EMAIL_USER?.trim()}>`

  await transporter.sendMail({
    from,
    to: Array.isArray(payload.to) ? payload.to.join(', ') : payload.to,
    subject: payload.subject,
    html: payload.html,
  })
}
