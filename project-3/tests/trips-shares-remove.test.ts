import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({ dbQuery: vi.fn() }))
vi.mock('next/server', () => ({
  NextResponse: {
    json: (payload: unknown, init?: { status?: number }) => ({ payload, status: init?.status ?? 200 }),
  },
}))

import { DELETE } from '../app/api/trips/[tripId]/shares/route'
import { dbQuery } from '@/lib/db'

const mockDb = dbQuery as ReturnType<typeof vi.fn>

function makeReq(tripId: string, body: unknown) {
  return {
    url: `http://localhost/api/trips/${tripId}/shares`,
    json: async () => body,
  }
}

describe('DELETE /api/trips/[tripId]/shares — self-removal', () => {
  beforeEach(() => mockDb.mockReset())

  it('removes the share when userId matches shared_with_user_id (self-removal)', async () => {
    // trip exists check
    mockDb
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })  // SELECT trip
      .mockResolvedValueOnce({ rowCount: 1 })          // DELETE share
    const res = await (DELETE as any)(makeReq('1', { userId: 55 }))
    expect(res.status).toBe(200)
    expect(res.payload.ok).toBe(true)
    expect(res.payload.sharedUserId).toBe('55')
  })

  it('returns 404 when the share row does not exist', async () => {
    mockDb
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })
      .mockResolvedValueOnce({ rowCount: 0 })
    const res = await (DELETE as any)(makeReq('1', { userId: 55 }))
    expect(res.status).toBe(404)
  })

  it('returns 400 when userId is missing', async () => {
    const res = await (DELETE as any)(makeReq('1', {}))
    expect(res.status).toBe(400)
  })

  it('allows owner to remove another user when sharedUserId is provided', async () => {
    mockDb
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })           // SELECT trip exists
      .mockResolvedValueOnce({ rows: [{ owner_id: 42 }] })    // loadTripOwner
      .mockResolvedValueOnce({ rowCount: 1 })                  // DELETE share
    const res = await (DELETE as any)(makeReq('1', { userId: 42, sharedUserId: 99 }))
    expect(res.status).toBe(200)
    expect(res.payload.ok).toBe(true)
    expect(res.payload.sharedUserId).toBe('99')
  })

  it('returns 403 when non-owner tries to remove another user', async () => {
    mockDb
      .mockResolvedValueOnce({ rows: [{ id: 1 }] })           // SELECT trip exists
      .mockResolvedValueOnce({ rows: [{ owner_id: 99 }] })    // loadTripOwner — different user
    const res = await (DELETE as any)(makeReq('1', { userId: 42, sharedUserId: 55 }))
    expect(res.status).toBe(403)
  })
})
