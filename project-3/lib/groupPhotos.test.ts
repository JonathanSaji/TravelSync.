import { describe, it, expect } from "vitest";
import { groupPhotosByDay } from "./groupPhotos";

const makePhoto = (id: string, taken_at: string | null, uploaded_at: string) => ({
  id, storage_url: "https://example.com/photo.jpg", taken_at, uploaded_at,
});

describe("groupPhotosByDay", () => {
  it("groups photos by taken_at date", () => {
    const photos = [
      makePhoto("1", "2024-06-03T10:00:00Z", "2024-06-10T00:00:00Z"),
      makePhoto("2", "2024-06-03T14:00:00Z", "2024-06-10T00:00:00Z"),
      makePhoto("3", "2024-06-04T09:00:00Z", "2024-06-10T00:00:00Z"),
    ];
    const groups = groupPhotosByDay(photos, "2024-06-03");
    expect(groups).toHaveLength(2);
    expect(groups[0].photos).toHaveLength(2);
    expect(groups[1].photos).toHaveLength(1);
  });

  it("labels days relative to trip start", () => {
    const photos = [makePhoto("1", "2024-06-05T10:00:00Z", "2024-06-10T00:00:00Z")];
    const groups = groupPhotosByDay(photos, "2024-06-03");
    expect(groups[0].label).toBe("Day 3 · June 5");
  });

  it("falls back to uploaded_at when taken_at is null", () => {
    const photos = [makePhoto("1", null, "2024-06-03T10:00:00Z")];
    const groups = groupPhotosByDay(photos, "2024-06-03");
    expect(groups).toHaveLength(1);
    expect(groups[0].photos[0].id).toBe("1");
  });

  it("returns empty array for no photos", () => {
    expect(groupPhotosByDay([], "2024-06-03")).toEqual([]);
  });
});
