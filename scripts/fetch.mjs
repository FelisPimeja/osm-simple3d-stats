// Pulls osm-simple3d-editor changesets into data/:
// - OpenStreetMap, from OSMCha: data/changesets/YYYY-MM.jsonl. Two queries — changesets made by the editor
//   itself (created_by=osm-simple3d-editor) and JOSM changesets with hashtags=#simple3d (the JOSM plugin adds
//   it when the upload contains objects edited in 3D). Re-fetches a few days back on every run: OSMCha
//   processes changesets with a delay and updates review status afterwards, so recent records are
//   overwritten by id.
// - OpenHistoricalMap: data/ohm.jsonl, rebuilt from the daily dump of all changesets (no OSMCha there).
// - OpenGeofiction: data/ogf.jsonl, incrementally from the API (/changesets by time window; no dumps).
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

const EDITOR = 'osm-simple3d-editor';
const HASHTAG = '#simple3d';
const START = '2026-01-01';
// OGF/OHM support appeared in the editor on 2026-10-10
const START_OTHER = '2026-10-10';
const OVERLAP_DAYS = 3;
const PAGE_SIZE = 500;
const DIR = 'data/changesets';
const STATE = 'data/state.json';
// Bump to re-fetch everything from START (new fields in records)
const SCHEMA = 2;
const UA = { 'User-Agent': 'osm-simple3d-stats (github.com/felispimeja/osm-simple3d-stats)' };

function token() {
  if (process.env.OSMCHA_TOKEN) return process.env.OSMCHA_TOKEN.trim();
  if (existsSync('.env.local')) {
    const m = readFileSync('.env.local', 'utf8').match(/^OSMCHA_TOKEN=(.+)$/m);
    if (m) return m[1].trim();
  }
  throw new Error('OSMCHA_TOKEN is not set (env or .env.local)');
}

async function get(url, headers = {}) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { ...UA, Accept: 'application/json', ...headers },
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

const hasHashtag = (h) => (h ?? '').split(/[;,\s]+/).some((t) => t.toLowerCase() === HASHTAG);
const ours = (tags) => (tags.created_by ?? '').startsWith(EDITOR) || hasHashtag(tags.hashtags);
const reported = (v) => (v && v !== 'Not reported' ? v : '');

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
    editor: p.editor,
    via: p.editor.startsWith(EDITOR) ? 'editor' : 'josm',
    source: reported(p.source),
    imagery_used: reported(p.imagery_used),
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
const writeJsonl = (file, rows) => writeFileSync(file, rows.map((r) => JSON.stringify(r)).join('\n') + (rows.length ? '\n' : ''));
const daysBefore = (date, days) => new Date(Date.parse(date) - days * 86400_000).toISOString().slice(0, 10);

const state = existsSync(STATE) ? JSON.parse(readFileSync(STATE, 'utf8')) : {};
const fresh = state.schema !== SCHEMA;

// --- OpenStreetMap (OSMCha) ---

const auth = token();

async function osmcha(query, keep) {
  const out = [];
  let url = `https://osmcha.org/api/v1/changesets/?${query}&page_size=${PAGE_SIZE}`;
  while (url) {
    const page = await get(url, { Authorization: `Token ${auth}` });
    out.push(...page.features.filter(keep).map(toRecord));
    console.log(`  ${out.length}/${page.count}`);
    url = page.next;
  }
  return out;
}

const since = !fresh && state.last_date ? daysBefore(state.last_date, OVERLAP_DAYS) : START;
console.log(`OSM: ${EDITOR} changesets since ${since}`);
const fetched = await osmcha(`editor=${EDITOR}&date__gte=${since}`, (f) => f.properties.editor === EDITOR);
// The metadata filter is an exact match: JOSM changesets that have other hashtags besides #simple3d are missed
console.log(`OSM: JOSM changesets with hashtags=${HASHTAG} since ${since}`);
fetched.push(...await osmcha(
  `editor=JOSM&date__gte=${since}&metadata=${encodeURIComponent(`hashtags=${HASHTAG}`)}`,
  (f) => !f.properties.editor.startsWith(EDITOR) && hasHashtag(f.properties.metadata?.hashtags),
));

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
  writeJsonl(file, rows);
  console.log(`  ${file}: ${rows.length}`);
}

const all = readdirSync(DIR).filter((f) => f.endsWith('.jsonl')).flatMap((f) => readJsonl(`${DIR}/${f}`));
const lastDate = all.reduce((m, r) => (r.date > m ? r.date : m), state.last_date ?? START);

// --- OpenHistoricalMap / OpenGeofiction: changeset metadata only (no tag changes) ---

const unescapeXml = (s) =>
  s.replace(/&(lt|gt|quot|apos|amp|#\d+|#x[0-9a-f]+);/gi, (_, e) =>
    ({ lt: '<', gt: '>', quot: '"', apos: "'", amp: '&' })[e] ??
    String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1))));

function plainRecord(c, tags) {
  const num = (v) => (v == null ? null : Number(v));
  const bbox = c.min_lon != null ? [c.min_lon, c.min_lat, c.max_lon, c.max_lat].map(Number) : null;
  return {
    id: Number(c.id),
    date: c.created_at,
    user: c.user,
    uid: Number(c.uid),
    comment: tags.comment ?? '',
    editor: tags.created_by ?? '',
    via: (tags.created_by ?? '').startsWith(EDITOR) ? 'editor' : 'josm',
    source: tags.source ?? '',
    imagery_used: tags.imagery_used ?? '',
    changes: num(c.changes_count ?? c.num_changes),
    create: num(c.created_count),
    modify: num(c.modified_count),
    delete: num(c.deleted_count),
    bbox,
  };
}

/** OHM: the daily dump of all changesets (~11 MB bz2), streamed through bzcat. */
async function ohm() {
  const base = 'https://planet.openhistoricalmap.org/planet/changesets/';
  const xml = await fetch('https://s3.amazonaws.com/planet.openhistoricalmap.org?list-type=2&prefix=planet/changesets/changesets-&start-after=planet/changesets/changesets-' + daysBefore(new Date().toISOString(), 7).slice(2).replaceAll('-', ''), { headers: UA }).then((r) => r.text());
  const name = [...xml.matchAll(/changesets-\d+_\d+\.osm\.bz2/g)].map((m) => m[0]).sort().at(-1);
  if (!name) throw new Error('no changeset dumps for the last week');
  console.log(`OHM: ${name}`);
  const res = await fetch(base + name, { headers: UA });
  if (!res.ok) throw new Error(`dump: HTTP ${res.status}`);
  const bz = spawn('bzcat', [], { stdio: ['pipe', 'pipe', 'inherit'] });
  (async () => {
    for await (const chunk of res.body) if (!bz.stdin.write(chunk)) await new Promise((r) => bz.stdin.once('drain', r));
    bz.stdin.end();
  })();
  const out = [];
  let cur = null, tags = {};
  const attrs = (s) => Object.fromEntries([...s.matchAll(/([\w:]+)="([^"]*)"/g)].map((m) => [m[1], unescapeXml(m[2])]));
  const done = () => { if (cur && ours(tags)) out.push(plainRecord(cur, tags)); cur = null; tags = {}; };
  for await (const line of createInterface({ input: bz.stdout })) {
    const t = line.trim();
    if (t.startsWith('<changeset ')) {
      done();
      cur = attrs(t);
      if (t.endsWith('/>')) done();
    } else if (t.startsWith('<tag ') && cur) {
      const a = attrs(t);
      tags[a.k] = a.v;
    } else if (t.startsWith('</changeset')) done();
  }
  done();
  return out.filter((r) => r.date >= START_OTHER).sort((a, b) => a.id - b.id);
}

/** OGF: walks /changesets back from now in pages of 100 (newest first) down to `since`. */
async function ogf(since) {
  const seen = new Set();
  const out = [];
  let end = new Date().toISOString();
  for (;;) {
    const j = await get(`https://opengeofiction.net/api/0.6/changesets.json?limit=100&time=${since}T00:00:00Z,${end}`);
    const page = j.changesets.filter((c) => !seen.has(c.id));
    if (!page.length) break;
    for (const c of page) {
      seen.add(c.id);
      if (ours(c.tags ?? {})) out.push(plainRecord(c, c.tags));
    }
    end = page.at(-1).created_at;
  }
  console.log(`OGF: scanned ${seen.size} changesets since ${since}, ours ${out.length}`);
  return out;
}

const other = { ogf_last_date: state.ogf_last_date };
try {
  const rows = await ohm();
  writeJsonl('data/ohm.jsonl', rows);
  console.log(`  data/ohm.jsonl: ${rows.length}`);
} catch (e) {
  console.warn(`OHM skipped: ${e.message}`);
}
try {
  const ogfSince = !fresh && state.ogf_last_date ? daysBefore(state.ogf_last_date, OVERLAP_DAYS) : START_OTHER;
  const scanned = new Date().toISOString();
  const merged = new Map(readJsonl('data/ogf.jsonl').map((r) => [r.id, r]));
  for (const r of await ogf(ogfSince)) merged.set(r.id, r);
  writeJsonl('data/ogf.jsonl', [...merged.values()].sort((a, b) => a.id - b.id));
  // Scanned up to now even when none of the changesets are ours: the next run starts from here
  other.ogf_last_date = scanned;
  console.log(`  data/ogf.jsonl: ${merged.size}`);
} catch (e) {
  console.warn(`OGF skipped: ${e.message}`);
}

// updated_at changes every run, so the daily commit also keeps the scheduled workflow alive.
writeFileSync(STATE, JSON.stringify({
  schema: SCHEMA, last_date: lastDate, total: all.length, ...other, updated_at: new Date().toISOString(),
}, null, 2) + '\n');
console.log(`total ${all.length}, last ${lastDate}`);
