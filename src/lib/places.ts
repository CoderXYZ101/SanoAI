/**
 * REAL places from OpenStreetMap, through its free Nominatim search service. No key, no fictional listings.
 * Usage policy: only user-initiated searches, at most about one request per second, with attribution on screen.
 * The area typed (or the device location, if the user allows it) is sent to OpenStreetMap's server.
 */
export type PlaceKind = "pharmacy" | "hospital" | "clinic" | "doctors";

export interface Place {
  id: string;
  kind: PlaceKind;
  name: string;
  address: string;
  phone: string | null;
  website: string | null;
  hours: string | null;
  speciality: string | null;
  lat: number;
  lon: number;
  distanceKm: number;
}
export interface Spot {
  lat: number;
  lon: number;
  label: string;
}

interface Raw {
  osm_type: string;
  osm_id: number;
  lat: string;
  lon: string;
  name?: string;
  type: string;
  display_name: string;
  address?: Record<string, string>;
  extratags?: Record<string, string> | null;
}

const BASE = "https://nominatim.openstreetmap.org/search";
let queue: Promise<unknown> = Promise.resolve();
let lastCall = 0;
const cache = new Map<string, Raw[]>();

/** Serialises requests and keeps them at least 1.1 s apart. */
function search(params: Record<string, string>): Promise<Raw[]> {
  const url = `${BASE}?${new URLSearchParams({ format: "jsonv2", ...params })}`;
  const hit = cache.get(url);
  if (hit) return Promise.resolve(hit);
  const run = queue.then(async () => {
    const wait = lastCall + 1100 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCall = Date.now();
    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(20_000), headers: { "accept-language": "en" } });
    } catch {
      throw new Error("The map service could not be reached. Check your connection and try again.");
    }
    if (!res.ok) throw new Error(res.status === 429 ? "The map service is busy. Wait a few seconds and try again." : "The map service returned an error. Please try again.");
    const data = (await res.json()) as Raw[];
    cache.set(url, data);
    return data;
  });
  queue = run.catch(() => {});
  return run;
}

/** Turns an area name or PIN code in India into coordinates. */
export async function locate(query: string): Promise<Spot> {
  const q = query.trim();
  const rows = await search(/^\d{6}$/.test(q) ? { postalcode: q, countrycodes: "in", limit: "1" } : { q, countrycodes: "in", limit: "1" });
  if (!rows.length) throw new Error(`Couldn't find “${q}”. Try a nearby area name with the city, or a 6-digit PIN code.`);
  return { lat: Number(rows[0].lat), lon: Number(rows[0].lon), label: rows[0].display_name.split(",").slice(0, 3).join(",") };
}

export function deviceLocation(): Promise<Spot> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("This browser can't share a location. Type your area instead."));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude, label: "your location" }),
      () => reject(new Error("Location wasn't shared. Type your area or PIN code instead.")),
      { timeout: 15_000, maximumAge: 300_000 },
    );
  });
}

export function distanceKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h = Math.sin(rad(b.lat - a.lat) / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lon - a.lon) / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(h));
}

export function toPlace(r: Raw, kind: PlaceKind, from: Spot): Place | null {
  if (!r.name) return null; // unnamed map points are not useful to a person
  const t = r.extratags ?? {};
  const a = r.address ?? {};
  const at = { lat: Number(r.lat), lon: Number(r.lon) };
  const address = [a.house_number, a.road, a.neighbourhood, a.suburb, a.city ?? a.town ?? a.village, a.postcode].filter(Boolean).join(", ");
  const site = t.website || t["contact:website"] || null;
  return {
    id: `${r.osm_type}-${r.osm_id}`,
    kind,
    name: r.name,
    address: address || r.display_name.split(",").slice(1, 5).join(",").trim(),
    phone: (t.phone || t["contact:phone"] || t["contact:mobile"] || "").split(";")[0].trim() || null,
    website: site && /^https?:\/\//i.test(site) ? site : null,
    hours: t.opening_hours || null,
    speciality: (t["healthcare:speciality"] || "").replace(/_/g, " ").replace(/;/g, ", ") || null,
    ...at,
    distanceKm: distanceKm(from, at),
  };
}

/** Places of the given kinds around a spot, nearest first. Widens the area once if little is found. */
export async function nearby(from: Spot, kinds: PlaceKind[]): Promise<Place[]> {
  const seen = new Map<string, Place>();
  for (const km of [4, 12]) {
    const dLat = km / 111;
    const dLon = km / (111 * Math.cos((from.lat * Math.PI) / 180));
    const viewbox = [from.lon - dLon, from.lat + dLat, from.lon + dLon, from.lat - dLat].map((n) => n.toFixed(5)).join(",");
    for (const kind of kinds) {
      const rows = await search({ q: kind, viewbox, bounded: "1", limit: "40", extratags: "1", addressdetails: "1" });
      for (const row of rows) {
        const place = toPlace(row, kind, from);
        if (place) seen.set(place.id, place);
      }
    }
    if (seen.size >= 5) break;
  }
  return [...seen.values()].sort((a, b) => a.distanceKm - b.distanceKm);
}
