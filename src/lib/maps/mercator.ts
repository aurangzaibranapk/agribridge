/** Web-Mercator hisaab (OSM tiles, 256px) -- pure functions, test ke liye. */
export const TILE = 256;
export const DEFAULT_CENTER = { lat: 31.42, lng: 73.08 }; // Faisalabad / Sargodha ilaqa

export function project(lat: number, lng: number, z: number): { x: number; y: number } {
  const s = TILE * 2 ** z; const sin = Math.sin((Math.max(-85, Math.min(85, lat)) * Math.PI) / 180);
  return { x: ((lng + 180) / 360) * s, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * s };
}
export function unproject(x: number, y: number, z: number): { lat: number; lng: number } {
  const s = TILE * 2 ** z; const n = Math.PI - (2 * Math.PI * y) / s;
  return { lat: (180 / Math.PI) * Math.atan(Math.sinh(n)), lng: (x / s) * 360 - 180 };
}
/** Sab pins dikhane wala sab se bara zoom (5..16). */
export function fitView(points: { lat: number; lng: number }[], w: number, h: number, pad = 40): { center: { lat: number; lng: number }; zoom: number } {
  if (!points.length) return { center: DEFAULT_CENTER, zoom: 10 };
  if (points.length === 1) return { center: points[0], zoom: 15 };
  for (let z = 16; z >= 5; z--) {
    const ps = points.map((p) => project(p.lat, p.lng, z));
    const xs = ps.map((p) => p.x), ys = ps.map((p) => p.y);
    if (Math.max(...xs) - Math.min(...xs) <= w - pad * 2 && Math.max(...ys) - Math.min(...ys) <= h - pad * 2) {
      return { center: unproject((Math.max(...xs) + Math.min(...xs)) / 2, (Math.max(...ys) + Math.min(...ys)) / 2, z), zoom: z };
    }
  }
  return { center: points[0], zoom: 5 };
}
