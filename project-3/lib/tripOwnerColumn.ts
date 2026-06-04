import { dbQuery } from '@/lib/db'

type OwnerColumn = 'owner_id' | 'user_id'

let cachedOwnerColumn: OwnerColumn | null = null

export async function getTripOwnerColumn(): Promise<OwnerColumn> {
  if (cachedOwnerColumn) return cachedOwnerColumn

  const result = await dbQuery<{ column_name: string }>(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'TravelSync'
        AND table_name = 'trips'
        AND column_name IN ('owner_id', 'user_id')
    `,
  )

  const names = new Set(result.rows.map(r => r.column_name))
  cachedOwnerColumn = names.has('owner_id') ? 'owner_id' : 'user_id'
  return cachedOwnerColumn
}
