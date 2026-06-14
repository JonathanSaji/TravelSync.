import { Resend } from 'resend'

function getResendClient() {
  const apiKey = process.env.RESEND_API_KEY?.trim()

  if (!apiKey) {
    throw new Error('RESEND_API_KEY must be set in environment variables.')
  }

  return new Resend(apiKey)
}

export interface EmailPayload {
  to: string | string[]
  subject: string
  html: string
}

export async function sendEmail(payload: EmailPayload): Promise<void> {
  const resend = getResendClient()

  const toAddresses = Array.isArray(payload.to) ? payload.to : [payload.to]

  const { error } = await resend.emails.send({
    from: 'TravelSync <noreply@sub-sync.ca>',
    to: toAddresses,
    subject: payload.subject,
    html: payload.html,
  })

  if (error) {
    throw new Error(`Resend error: ${error.message}`)
  }
}
