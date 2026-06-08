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
        confirmed BOOLEAN NOT NULL DEFAULT FALSE,
        trip_status TEXT NOT NULL DEFAULT 'planned',
        start_date DATE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `)

    // Add new columns to existing trips tables (safe, idempotent)
    await client.query(`ALTER TABLE "TravelSync".trips ADD COLUMN IF NOT EXISTS confirmed BOOLEAN NOT NULL DEFAULT FALSE`)
    await client.query(`ALTER TABLE "TravelSync".trips ADD COLUMN IF NOT EXISTS trip_status TEXT NOT NULL DEFAULT 'planned'`)
    await client.query(`ALTER TABLE "TravelSync".trips ADD COLUMN IF NOT EXISTS start_date DATE`)

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
      CREATE TABLE IF NOT EXISTS "TravelSync".trip_reminder_logs (
        id BIGSERIAL PRIMARY KEY,
        trip_id BIGINT NOT NULL REFERENCES "TravelSync".trips(id) ON DELETE CASCADE,
        user_id BIGINT NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
        reminder_type TEXT NOT NULL,
        sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        UNIQUE (trip_id, user_id, reminder_type)
      )
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_trips_owner_id ON "TravelSync".trips(owner_id)
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_trips_start_date ON "TravelSync".trips(start_date)
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_trip_shares_user ON "TravelSync".trip_shares(shared_with_user_id)
    `)

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_reminder_logs_trip ON "TravelSync".trip_reminder_logs(trip_id)
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
      AND table_name IN ('trips', 'trip_shares', 'trip_reminder_logs')
    ORDER BY table_name
  `)

  return result.rows.map(r => r.table_name)
}
