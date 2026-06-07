import type { TripPhoto } from "./tripPhotos";

export interface DayGroup {
  date: string;   // "2024-06-03"
  label: string;  // "Day 1 · June 3"
  photos: TripPhoto[];
}

export function groupPhotosByDay(photos: TripPhoto[], tripStartDate: string): DayGroup[] {
  if (photos.length === 0) return [];

  const groups = new Map<string, TripPhoto[]>();

  for (const photo of photos) {
    const raw = photo.taken_at ?? photo.uploaded_at;
    const dateKey = new Date(raw).toISOString().split("T")[0];
    if (!groups.has(dateKey)) groups.set(dateKey, []);
    groups.get(dateKey)!.push(photo);
  }

  const start = new Date(tripStartDate + "T00:00:00Z");

  return Array.from(groups.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, photos]) => {
      const d = new Date(date + "T00:00:00Z");
      const dayNum = Math.round((d.getTime() - start.getTime()) / 86_400_000) + 1;
      const label = `Day ${dayNum} · ${d.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" })}`;
      return { date, label, photos };
    });
}
