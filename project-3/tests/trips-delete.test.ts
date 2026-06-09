import { vi, describe, it, expect, beforeEach } from 'vitest'

vi.mock('@/lib/db', () => ({ dbQuery: vi.fn() }))
vi.mock('@/lib/tripOwnerColumn', () => ({
  getTripOwnerColumn: vi.fn(async () => 'owner_id'),
}))
vi.mock('next/server', () => ({
  NextResponse: {
    json: (payload: unknown, init?: { status?: number }) => ({ payload, status: init?.status ?? 200 }),
  },
}))

import { DELETE } from '../app/api/trips/[tripId]/route'
import { dbQuery } from '@/lib/db'

const mockDb = dbQuery as ReturnType<typeof vi.fn>

function makeReq(tripId: string, body: unknown) {
  return {
    url: `http://localhost/api/trips/${tripId}`,
    json: async () => body,
  }
}

describe('DELETE /api/trips/[tripId]', () => {
  beforeEach(() => mockDb.mockReset())

  it('deletes trip and shares when user is the owner', async () => {
    mockDb
      .mockResolvedValueOnce({ rows: [{ owner_id: 42 }] }) // SELECT owner
      .mockResolvedValueOnce({ rowCount: 2 })               // DELETE shares
      .mockResolvedValueOnce({ rowCount: 1 })               // DELETE trip
    const res = await (DELETE as any)(makeReq('1', { userId: 42 }))
    expect(res.status).toBe(200)
    expect(res.payload).toEqual({ ok: true })
    expect(mockDb).toHaveBeenCalledTimes(3)
  })

  it('returns 403 when user is not the owner', async () => {
    mockDb.mockResolvedValueOnce({ rows: [{ owner_id: 99 }] })
    const res = await (DELETE as any)(makeReq('1', { userId: 42 }))
    expect(res.status).toBe(403)
    expect(mockDb).toHaveBeenCalledTimes(1)
  })

  it('returns 404 when trip does not exist', async () => {
    mockDb.mockResolvedValueOnce({ rows: [] })
    const res = await (DELETE as any)(makeReq('1', { userId: 42 }))
    expect(res.status).toBe(404)
  })

  it('returns 400 when userId is missing', async () => {
    const res = await (DELETE as any)(makeReq('1', {}))
    expect(res.status).toBe(400)
    expect(mockDb).not.toHaveBeenCalled()
  })

  it('returns 400 when tripId is invalid', async () => {
    const res = await (DELETE as any)(makeReq('abc', { userId: 42 }))
    expect(res.status).toBe(400)
    expect(mockDb).not.toHaveBeenCalled()
  })
})
