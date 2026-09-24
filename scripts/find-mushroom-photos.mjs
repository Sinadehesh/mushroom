#!/usr/bin/env node
// Lists candidate photos for a mushroom from the iNaturalist API (no key needed):
// research-grade observations, openly licensed (CC0 / CC BY / CC BY-SA), most-faved first.
//
//   npm run photos:find -- chanterelle            # print 12 candidates with preview links
//   npm run photos:find -- chanterelle --limit 30
//
// Open the preview links and pick the clearest field shots: the whole fruiting body in
// its habitat, cap plus the underside (gills, pores or spines) across the set, no hands
// or cut-open specimens on a table. Paste their JSON lines into scripts/mushroom-photos.json.
// Then run `npm run photos:download`. Please keep to iNaturalist's API etiquette
// (~1 request/second), which this script does.

import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const { MUSHROOMS_BY_ID } = await import(join(root, 'src/data/mushrooms.ts'));

const [mushroomId] = process.argv.slice(2);
const limitIdx = process.argv.indexOf('--limit');
const limit = limitIdx > 0 ? Number(process.argv[limitIdx + 1]) : 12;
const mushroom = MUSHROOMS_BY_ID[mushroomId];
if (!mushroom) {
  console.error(`Usage: npm run photos:find -- <mushroom-id>\nUnknown mushroom id "${mushroomId ?? ''}".`);
  process.exit(1);
}

const HEADERS = { 'User-Agent': 'MycoLock photo curator (https://github.com/sinadehesh/mushroom)' };
const BLOCKED_HINT =
  'api.inaturalist.org looks blocked by a proxy or firewall (iNaturalist itself rarely answers 403). ' +
  'In a sandboxed cloud session, allow api.inaturalist.org and static.inaturalist.org in its network ' +
  'settings, or run this on your own machine. photos:download is unaffected: it uses the ' +
  'inaturalist-open-data S3 bucket.';
const api = async (path, params) => {
  let res;
  try {
    res = await fetch(`https://api.inaturalist.org/v1/${path}?${new URLSearchParams(params)}`, { headers: HEADERS });
  } catch (err) {
    throw new Error(`Could not reach the iNaturalist API (${err.cause?.code ?? err.message}). ${BLOCKED_HINT}`);
  }
  if (res.status === 403) throw new Error(`iNaturalist API 403. ${BLOCKED_HINT}`);
  if (!res.ok) throw new Error(`iNaturalist API ${res.status}`);
  await new Promise((r) => setTimeout(r, 1000));
  return res.json();
};

const taxa = await api('taxa', { q: mushroom.scientificName, is_active: 'true', per_page: '5' });
const taxon = taxa.results.find((t) => t.name === mushroom.scientificName) ?? taxa.results[0];
if (!taxon) throw new Error(`No iNaturalist taxon for ${mushroom.scientificName}`);
console.log(`${mushroom.commonName} → ${taxon.name} (taxon ${taxon.id})\n`);

const obs = await api('observations', {
  taxon_id: String(taxon.id),
  quality_grade: 'research',
  photo_license: 'cc0,cc-by,cc-by-sa',
  order_by: 'votes',
  per_page: String(limit),
});

const LICENSES = { cc0: 'CC0', 'cc-by': 'CC-BY', 'cc-by-sa': 'CC-BY-SA' };
for (const o of obs.results) {
  const photo = o.photos.find((p) => LICENSES[p.license_code]);
  if (!photo) continue;
  const entry = {
    photoId: photo.id,
    ext: photo.url.split('.').pop().split('?')[0],
    license: LICENSES[photo.license_code],
    author: o.user.name || o.user.login,
    observationUrl: `https://www.inaturalist.org/observations/${o.id}`,
  };
  console.log(`preview: ${photo.url.replace('/square.', '/large.')}`);
  console.log(`${JSON.stringify(entry)},\n`);
}
