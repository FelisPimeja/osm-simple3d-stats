// Incrementally pulls osm-simple3d-editor changesets from OSMCha into data/changesets/YYYY-MM.jsonl.
// Re-fetches a few days back on every run: OSMCha processes changesets with a delay and updates
// review status afterwards, so recent records are overwritten by id.
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';

const EDITOR = 'osm-simple3d-editor';
const START = '2026-01-01';
const OVERLAP_DAYS = 3;
const PAGE_SIZE = 500;
const DIR = 'data/changesets';
const STATE = 'data/state.json';

function token() {
  if (process.env.OSMCHA_TOKEN) return process.env.OSMCHA_TOKEN.trim();
  if (existsSync('.env.local')) {
    const m = readFileSync('.env.local', 'utf8').match(/^OSMCHA_TOKEN=(.+)$/m);
    if (m) return m[1].trim();
  }
  throw new Error('OSMCHA_TOKEN is not set (env or .env.local)');
}

async function get(url, auth) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Authorization: `Token ${auth}`, Accept: 'application/json' },
        signal: AbortSignal.timeout(300_000),
      });
      if (res.ok) return res.json();
      throw new Error(`HTTP ${res.status}`);
    } catch (e) {
      if (attempt >= 4) throw new Error(`${url}: ${e.message}`);
      console.warn(`retry ${attempt} after ${e.message}`);
      await new Promise((r) => setTimeout(r, 15_000 * attempt));
    }
  }
}

function toRecord(f) {
  const p = f.properties;
  const ring = f.geometry?.coordinates?.[0] ?? [];
  const xs = ring.map((c) => c[0]);
  const ys = ring.map((c) => c[1]);
  return {
    id: f.id,
    date: p.date,
    user: p.user,
    uid: Number(p.uid),
    comment: p.comment ?? '',
    create: p.create,
    modify: p.modify,
    delete: p.delete,
    bbox: ring.length ? [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)] : null,
    hashtags: p.metadata?.hashtags ?? '',
    tags: Object.entries(p.tag_changes ?? {}).map(([k, v]) => ({ k, v })),
    reasons: (p.reasons ?? []).map((r) => r.name ?? String(r)),
    is_suspect: p.is_suspect,
    checked: p.checked,
    harmful: p.harmful,
  };
}

const readJsonl = (file) =>
  existsSync(file) ? readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];

const auth = token();
const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : {};
const since = state.last_date
  ? new Date(Date.parse(state.last_date) - OVERLAP_DAYS * 86400_000).toISOString().slice(0, 10)
  : START;

console.log(`fetching ${EDITOR} changesets since ${since}`);
const fetched = [];
let url = `https://osmcha.org/api/v1/changesets/?editor=${EDITOR}&date__gte=${since}&page_size=${PAGE_SIZE}`;
while (url) {
  const page = await get(url, auth);
  fetched.push(...page.features.filter((f) => f.properties.editor === EDITOR).map(toRecord));
  console.log(`  ${fetched.length}/${page.count}`);
  url = page.next;
}

const byMonth = new Map();
for (const r of fetched) {
  const m = r.date.slice(0, 7);
  if (!byMonth.has(m)) byMonth.set(m, []);
  byMonth.get(m).push(r);
}
for (const [month, records] of byMonth) {
  const file = `${DIR}/${month}.jsonl`;
  const merged = new Map(readJsonl(file).map((r) => [r.id, r]));
  for (const r of records) merged.set(r.id, r);
  const rows = [...merged.values()].sort((a, b) => a.id - b.id);
  writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + '\n');
  console.log(`  ${file}: ${rows.length}`);
}

const all = readdirSync(DIR).filter((f) => f.endsWith('.jsonl')).flatMap((f) => readJsonl(`${DIR}/${f}`));
const lastDate = all.reduce((m, r) => (r.date > m ? r.date : m), state.last_date ?? START);
// updated_at changes every run, so the daily commit also keeps the scheduled workflow alive.
writeFileSync(STATE, JSON.stringify({ last_date: lastDate, total: all.length, updated_at: new Date().toISOString() }, null, 2) + '\n');
console.log(`total ${all.length}, last ${lastDate}`);
