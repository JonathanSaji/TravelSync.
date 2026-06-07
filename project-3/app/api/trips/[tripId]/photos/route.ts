import { NextRequest, NextResponse } from "next/server";
import { getTripPhotos, getTripLinkedAlbum } from "@/lib/tripPhotos";

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ tripId: string }> }
) {
  const { tripId } = await params;
  const userId = req.nextUrl.searchParams.get("userId");
  if (!userId) return NextResponse.json({ error: "userId is required" }, { status: 400 });

  const [album, photos] = await Promise.all([
    getTripLinkedAlbum(tripId, userId),
    getTripPhotos(tripId, userId),
  ]);

  return NextResponse.json({ album, photos });
}
