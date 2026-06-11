import { vi, describe, it, expect, beforeAll } from 'vitest'

// Mock OpenAI client used by app/api/generate-trip/route.ts
vi.mock('openai', () => {
  const OpenAIMock = vi.fn().mockImplementation(function () {
    return {
      responses: {
        create: async () => ({
          output_text: JSON.stringify({
            tripName: 'My Trip',
            harmonyPlan: { note: 'All good', conflicts: [] },
            itinerary: [],
          }),
        }),
      },
    }
  })

  return {
    default: OpenAIMock,
  }
})

// Mock NextResponse.json to return the payload directly for assertions
vi.mock('next/server', () => ({
  NextResponse: {
    json: (payload: unknown, init?: { status?: number }) => ({ payload, status: init?.status ?? 200 }),
  },
}))

import { POST } from '../app/api/generate-trip/route'

beforeAll(() => {
  process.env.OPENAI_API_KEY = 'test-key'
})

describe('generate-trip API (mocked)', () => {
  it('returns parsed JSON from mocked AI', async () => {
    const req = { json: async () => ({ location: 'Paris', days: 3, ideas: 'sightseeing', plan: { name: 'Test Trip' } }) }
    const res = await (POST as any)(req)
    expect(res).toBeDefined()
    expect(res.payload).toBeDefined()
    expect(res.payload.tripName).toBe('My Trip')
    expect(res.status).toBe(200)
  })
})
