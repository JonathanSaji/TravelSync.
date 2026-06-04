import { getDbPool } from '@/lib/db'

export async function ensureTravelSyncTables() {
  const pool = getDbPool()
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    await client.query('CREATE SCHEMA IF NOT EXISTS "TravelSync"')

    await client.query(`
      CREATE TABLE IF NOT EXISTS "TravelSync".trips (
        id BIGSERIAL PRIMARY KEY,
        owner_id BIGINT NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
        plan_details JSONB NOT NULL,
        ideas JSONB NOT NULL DEFAULT '[]'::jsonb,
        itinerary JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    await client.query(`
      CREATE TABLE IF NOT EXISTS "TravelSync".trip_shares (
        trip_id BIGINT NOT NULL REFERENCES "TravelSync".trips(id) ON DELETE CASCADE,
        shared_with_user_id BIGINT NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
        shared_by_user_id BIGINT REFERENCES public.accounts(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (trip_id, shared_with_user_id)
      )
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_trips_owner_id ON "TravelSync".trips(owner_id)
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_trip_shares_user ON "TravelSync".trip_shares(shared_with_user_id)
    `)

    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function getTravelSyncTables() {
  const result = await getDbPool().query<{
    table_name: string
  }>(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'TravelSync'
      AND table_name IN ('trips', 'trip_shares')
    ORDER BY table_name
  `)

  return result.rows.map(r => r.table_name)
}
