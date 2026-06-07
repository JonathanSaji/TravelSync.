// lib/tripPhotos.ts
import { dbQuery } from "./db";

export interface TripPhoto {
  id: string;
  storage_url: string;
  taken_at: string | null;
  uploaded_at: string;
}

export interface LinkedAlbum {
  id: string;
  name: string;
}

export async function getTripLinkedAlbum(
  tripId: string,
  accountId: string
): Promise<LinkedAlbum | null> {
  const result = await dbQuery<LinkedAlbum>(
    `SELECT id, name FROM "TravelSync".photo_albums
     WHERE trip_id = $1 AND account_id = $2
     LIMIT 1`,
    [tripId, accountId]
  );
  return result.rows[0] ?? null;
}

export async function getTripPhotos(
  tripId: string,
  accountId: string
): Promise<TripPhoto[]> {
  const result = await dbQuery<TripPhoto>(
    `SELECT p.id, p.storage_url, p.taken_at, p.uploaded_at
     FROM "TravelSync".photos p
     JOIN "TravelSync".photo_albums a ON p.album_id = a.id
     WHERE a.trip_id = $1 AND p.account_id = $2
     ORDER BY COALESCE(p.taken_at, p.uploaded_at) ASC`,
    [tripId, accountId]
  );
  return result.rows;
}
