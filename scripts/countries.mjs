// Country of each OSM changeset by the centre of its bbox: data/countries.jsonl ({id, iso, country}).
// Boundaries: data/countries.geojson — Natural Earth 1:50m admin 0 (public domain), reduced to iso + Russian
// name. A centre outside every polygon (sea, coast at this scale) takes the nearest country within ~0.5°.
// Runs at the end of fetch.mjs; on its own: node scripts/countries.mjs
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const DIR = 'data/changesets';
const OUT = 'data/countries.jsonl';
const NEAR = 0.5;

function load() {
  const g = JSON.parse(readFileSync('data/countries.geojson', 'utf8'));
  return g.features.map((f) => {
    const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
    const xs = polys.flat(3).filter((_, i) => i % 2 === 0);
    const ys = polys.flat(3).filter((_, i) => i % 2 === 1);
    return { ...f.properties, polys, box: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] };
  });
}

function inRing(x, y, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
const inCountry = (x, y, c) => c.polys.some(([outer, ...holes]) => inRing(x, y, outer) && !holes.some((h) => inRing(x, y, h)));

function segDist2(x, y, [ax, ay], [bx, by]) {
  const dx = bx - ax, dy = by - ay;
  const t = dx || dy ? Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy))) : 0;
  return (x - ax - t * dx) ** 2 + (y - ay - t * dy) ** 2;
}

export function locate(countries, x, y) {
  const near = countries.filter((c) => x >= c.box[0] - NEAR && x <= c.box[2] + NEAR && y >= c.box[1] - NEAR && y <= c.box[3] + NEAR);
  const hit = near.find((c) => c.box[0] <= x && x <= c.box[2] && c.box[1] <= y && y <= c.box[3] && inCountry(x, y, c));
  if (hit) return hit;
  let best = null, bestD = NEAR * NEAR;
  for (const c of near)
    for (const poly of c.polys)
      for (const ring of poly)
        for (let i = 1; i < ring.length; i++) {
          const d = segDist2(x, y, ring[i - 1], ring[i]);
          if (d < bestD) (bestD = d), (best = c);
        }
  return best;
}

export function writeCountries() {
  const countries = load();
  const rows = readdirSync(DIR)
    .filter((f) => f.endsWith('.jsonl'))
    .flatMap((f) => readFileSync(`${DIR}/${f}`, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)))
    .filter((r) => r.bbox)
    .sort((a, b) => a.id - b.id)
    .map((r) => {
      const c = locate(countries, (r.bbox[0] + r.bbox[2]) / 2, (r.bbox[1] + r.bbox[3]) / 2);
      return { id: r.id, iso: c?.iso ?? null, country: c?.name ?? null };
    });
  writeFileSync(OUT, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  console.log(`${OUT}: ${rows.length}, without a country ${rows.filter((r) => !r.country).length}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) writeCountries();
