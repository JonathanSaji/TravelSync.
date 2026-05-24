import { Pool, type QueryResultRow } from 'pg'

let pool: Pool | null = null

function getConnectionString(): string {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    throw new Error('DATABASE_URL is not configured.')
  }
  return url
}

export function getDbPool(): Pool {
  if (!pool) {
    pool = new Pool({ connectionString: getConnectionString() })
  }
  return pool
}

export async function dbQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
) {
  return getDbPool().query<T>(text, params)
}
