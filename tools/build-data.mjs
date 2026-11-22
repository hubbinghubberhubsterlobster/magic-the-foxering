// Magic the Foxering – bereitet alle Daten vor (läuft in GitHub Actions: bei jedem Build und täglich).
// Aufruf: node tools/build-data.mjs <www-Ordner> <Ausgabe-Ordner> [alter Daten-Ordner]
//
// Erzeugt im Ausgabe-Ordner:
//   cards.json     alle Magic-Karten (Papier) mit Drucken, deutschen Namen und Cardmarket-Preisen (via Scryfall)
//   prices.json    nur die Preise (kleine Datei für tägliche Updates)
//   metadata.json  Stand + Prüfsumme der Kartenliste
//   precons.json   Fertigdecks (Commander-, Starter-, Planeswalker-Decks …) aus MTGJSON
//   meta.json      Turnier-Meta (MTGGoldfish) + beliebteste Commander mit Empfehlungen (EDHREC)
//   rates.json     Wechselkurse (EZB)
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';

const [, , WWW = 'app/src/main/assets/www', OUT = 'site/data', OLD = ''] = process.argv;
fs.mkdirSync(OUT, {recursive: true});

// Gemeinsame Hilfsfunktionen aus der App laden (gleiche Logik wie auf dem Handy)
const ctx = {window: {}, console, Intl, Date, Math, JSON, Map, Set, URL, setTimeout, clearTimeout, localStorage: null, indexedDB: null, location: {href: 'https://x/'}, document: null};
ctx.globalThis = ctx;
vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(WWW, 'data.js'), 'utf8') + '\nglobalThis.__x = {parseEdhrec, edhSlug, LEGAL_FORMATS, META_FORMATS, parseDeckText};', ctx);
const X = ctx.__x;

const UA = {'User-Agent': 'MagicTheFoxering-Data/1.0 (+https://github.com)', 'Accept': 'application/json;q=0.9,*/*;q=0.8'};
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(url, type = 'json', tries = 3){
  for(let i = 1; ; i++){
    try{
      const r = await fetch(url, {headers: UA});
      if(!r.ok) throw new Error(r.status + ' ' + url);
      return type === 'json' ? await r.json() : type === 'buf' ? Buffer.from(await r.arrayBuffer()) : await r.text();
    }catch(e){ if(i >= tries) throw e; await sleep(1500 * i); }
  }
}
const write = (f, o) => { const s = JSON.stringify(o); fs.writeFileSync(path.join(OUT, f), s); console.log('✓', f, (s.length / 1e6).toFixed(1) + ' MB'); };
const readOld = f => { try{ return OLD ? JSON.parse(fs.readFileSync(path.join(OLD, f), 'utf8')) : null; }catch(e){ return null; } };

/* =========================================================
   1) Karten aus Scryfall ("all_cards": alle Drucke in allen Sprachen)
   ========================================================= */
const SKIP_LAYOUT = new Set(['token', 'double_faced_token', 'emblem', 'art_series', 'vanguard', 'scheme', 'planar', 'reversible_card_token']);
const SKIP_SETTYPE = new Set(['token', 'memorabilia', 'minigame', 'alchemy', 'treasure_chest']);
const RAR = {common: 'c', uncommon: 'u', rare: 'r', mythic: 'm', special: 's', bonus: 'b'};
const cents = v => v == null || v === '' ? 0 : Math.round(parseFloat(v) * 100) || 0;
const faces = c => c.card_faces || [];
const joinF = (c, k) => faces(c).length ? faces(c).map(f => f[k] || '').filter(Boolean).join(' // ') : (c[k] || '');

const bulk = await get('https://api.scryfall.com/bulk-data');
const items = Array.isArray(bulk) ? bulk : bulk.data || bulk.items || [];
let all = items.find(b => /^all[_-]?cards$/i.test(b.type || '') || /^all cards$/i.test(b.name || ''));
if(!all){ console.log('Bulk-Antwort:', JSON.stringify(bulk).slice(0, 1500)); throw new Error('Kein "all_cards" in der Bulk-Liste'); }
// Scryfall liefert inzwischen auch/nur JSON-Lines als .gz (jsonl_download_uri)
let dlUri = all.jsonl_download_uri || all.download_uri || all.downloadUri || all.download_url;
if(!dlUri && all.uri){ const one = await get(all.uri); dlUri = one.jsonl_download_uri || one.download_uri || one.downloadUri || one.download_url; all = Object.assign({}, one, all); }
if(!dlUri){ console.log('Bulk-Eintrag:', JSON.stringify(all).slice(0, 1500)); throw new Error('Keine Download-Adresse für all_cards'); }
all.download_uri = dlUri;
console.log('Lade', dlUri, (all.compressed_size || all.size) ? ((all.compressed_size || all.size) / 1e9).toFixed(2) + ' GB' : '', '…');

const oracle = [], oIdx = new Map();          // oracle_id → Index
const prints = [];                             // englische Papier-Drucke
const deById = new Map();                      // "set:cn" → deutsche Scryfall-ID
const deName = new Map();                      // oracle_id → {n, t, d}

function oracleOf(c){
  const oid = c.oracle_id || (faces(c)[0] && faces(c)[0].oracle_id);
  if(!oid) return -1;
  if(oIdx.has(oid)) return oIdx.get(oid);
  const f0 = faces(c)[0] || {};
  const leg = X.LEGAL_FORMATS.reduce((m, f, i) => m | (/^(legal|restricted)$/.test((c.legalities || {})[f] || '') ? 1 << i : 0), 0);
  const colors = c.colors || [...new Set(faces(c).flatMap(f => f.colors || []))];
  const pt = c.power != null ? c.power + '/' + c.toughness : f0.power != null ? f0.power + '/' + f0.toughness : c.loyalty != null ? 'L' + c.loyalty : f0.loyalty != null ? 'L' + f0.loyalty : c.defense != null ? 'D' + c.defense : '';
  const text = faces(c).length ? faces(c).map(f => f.oracle_text || '').join('\n—\n') : (c.oracle_text || '');
  const i = oracle.length;
  oracle.push([c.name, '', joinF(c, 'mana_cost'), c.cmc || 0, c.type_line || joinF(c, 'type_line'), '', colors.join(''), (c.color_identity || []).join(''),
    text, pt, leg, c.edhrec_rank || 0, (c.keywords || []).join('|'), c.layout || '', oid]);
  oIdx.set(oid, i);
  return i;
}

let lines = 0;
{
  const res = await fetch(all.download_uri, {headers: UA});
  if(!res.ok) throw new Error('Bulk-Download ' + res.status);
  const gz = /\.gz($|\?)/.test(all.download_uri) && !/gzip/i.test(res.headers.get('content-encoding') || '');
  const reader = (gz ? res.body.pipeThrough(new DecompressionStream('gzip')) : res.body).getReader();
  const dec = new TextDecoder();
  let buf = '';
  const handle = line => {
    line = line.trim(); if(line.length < 3) return;
    if(line.endsWith(',')) line = line.slice(0, -1);
    if(line[0] !== '{') return;
    lines++;
    let c; try{ c = JSON.parse(line); }catch(e){ return; }
    if(c.digital || !(c.games || []).includes('paper')) return;
    if(SKIP_LAYOUT.has(c.layout) || SKIP_SETTYPE.has(c.set_type)) return;
    const key = c.set + ':' + c.collector_number;
    if(c.lang === 'en'){
      const oi = oracleOf(c); if(oi < 0) return;
      const fin = (c.finishes || []).reduce((m, f) => m | (f === 'nonfoil' ? 1 : f === 'foil' ? 2 : f === 'etched' ? 4 : 0), 0) || 1;
      const fe = c.frame_effects || [];
      const flags = (c.promo ? 1 : 0) | (c.full_art || c.border_color === 'borderless' || fe.includes('showcase') || fe.includes('extendedart') ? 2 : 0)
        | (c.image_status === 'missing' || c.image_status === 'placeholder' ? 4 : 0) | (c.variation ? 8 : 0);
      const pr = c.prices || {};
      prints.push({k: key, a: [oi, c.set, c.collector_number, RAR[c.rarity] || 's', c.id, fin, cents(pr.eur), cents(pr.eur_foil || pr.eur_etched), '', flags], rel: c.released_at || ''});
    } else if(c.lang === 'de'){
      deById.set(key, c.id);
      const oid = c.oracle_id || (faces(c)[0] && faces(c)[0].oracle_id);
      const n = faces(c).length ? faces(c).map(f => f.printed_name || f.name).join(' // ') : (c.printed_name || '');
      const t = faces(c).length && !c.printed_type_line ? faces(c).map(f => f.printed_type_line || '').filter(Boolean).join(' // ') : (c.printed_type_line || '');
      const prev = deName.get(oid);
      if(oid && n && (!prev || (c.released_at || '') > prev.d)) deName.set(oid, {n, t, d: c.released_at || ''});
    }
  };
  for(;;){
    const {done, value} = await reader.read();
    if(done) break;
    buf += dec.decode(value, {stream: true});
    let i;
    while((i = buf.indexOf('\n')) >= 0){ handle(buf.slice(0, i)); buf = buf.slice(i + 1); }
  }
  handle(buf);
}
console.log(lines, 'Einträge gelesen →', oracle.length, 'Karten,', prints.length, 'Drucke,', deById.size, 'deutsche Drucke');

for(const o of oracle){ const d = deName.get(o[14]); if(d){ o[1] = d.n === o[0] ? '' : d.n; o[5] = d.t; } o.pop(); }
for(const p of prints){ const d = deById.get(p.k); if(d) p.a[8] = d; }

const setsApi = (await get('https://api.scryfall.com/sets')).data;
const used = new Map(); for(const p of prints) used.set(p.a[1], (used.get(p.a[1]) || 0) + 1);
const sets = setsApi.filter(s => used.has(s.code)).map(s => [s.code, s.name, s.released_at || '', s.set_type || '', s.parent_set_code || '',
  ((s.icon_svg_uri || '').match(/\/sets\/([^/.?]+)\.svg/) || [])[1] || s.code, used.get(s.code), s.printed_size || s.card_count || 0]);
const rel = new Map(sets.map(s => [s[0], s[2]]));
const cnNum = cn => { const m = String(cn).match(/\d+/); return m ? +m[0] : 99999; };
prints.sort((a, b) => (rel.get(b.a[1]) || '').localeCompare(rel.get(a.a[1]) || '') || a.a[1].localeCompare(b.a[1]) || cnNum(a.a[2]) - cnNum(b.a[2]) || String(a.a[2]).localeCompare(String(b.a[2])));

let h = 2166136261; for(const p of prints){ for(const ch of p.k){ h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } }
const cv = (h >>> 0).toString(36) + '-' + oracle.length + '-' + prints.length;
const date = all.updated_at || new Date().toISOString();
const P = prints.map(p => p.a);
write('cards.json', {v: 1, cv, date, sets, o: oracle, p: P.map(a => { const b = [...a]; b[6] = 0; b[7] = 0; return b; })});
write('prices.json', {cv, date, e: P.map(a => a[6]), f: P.map(a => a[7])});
write('metadata.json', {cv, date});
const printKey = new Set(prints.map(p => p.k));
const enId = new Map(prints.map(p => [p.a[4], p.k]));

/* =========================================================
   2) Fertigdecks (MTGJSON)
   ========================================================= */
try{
  const SKIP_DECK = /world championship|pro tour|mtgo|arena|promo/i;
  const gz = await get('https://mtgjson.com/api/v5/AllDeckFiles.tar.gz', 'buf');
  const tar = zlib.gunzipSync(gz);
  const decks = [];
  for(let off = 0; off + 512 <= tar.length;){
    const name = tar.toString('utf8', off, off + 100).replace(/\0.*$/s, '');
    if(!name) break;
    const size = parseInt(tar.toString('utf8', off + 124, off + 136).replace(/\0.*$/s, '').trim() || '0', 8);
    const type = tar[off + 156];
    const body = tar.subarray(off + 512, off + 512 + size);
    off += 512 + Math.ceil(size / 512) * 512;
    if(!name.endsWith('.json') || (type !== 48 && type !== 0)) continue;
    let j; try{ j = JSON.parse(body.toString('utf8')).data; }catch(e){ continue; }
    if(!j || SKIP_DECK.test(j.type || '')) continue;
    const rows = [];
    const add = (arr, cmd) => { for(const c of arr || []){
      const sid = c.identifiers && c.identifiers.scryfallId;
      let k = sid && enId.get(sid);
      if(!k){ const kk = String(c.setCode || '').toLowerCase() + ':' + c.number; if(printKey.has(kk)) k = kk; }
      rows.push([k || '?' + c.name, c.count || 1, (c.isFoil ? 1 : 0) | (cmd ? 2 : 0)]);
    } };
    add(j.commander, true); add(j.mainBoard, false);
    if(/commander/i.test(j.type || '')) add(j.sideBoard, false);
    if(rows.length >= 10) decks.push([j.name, String(j.code || '').toLowerCase(), j.releaseDate || '', j.type || '', rows]);
  }
  decks.sort((a, b) => b[2].localeCompare(a[2]) || a[0].localeCompare(b[0]));
  write('precons.json', {date, decks});
}catch(e){
  console.warn('Fertigdecks nicht geladen:', e.message);
  const old = readOld('precons.json'); if(old) write('precons.json', old);
}

/* =========================================================
   3) Meta: Turnierdecks (MTGGoldfish) + Commander (EDHREC)
   ========================================================= */
const oldMeta = readOld('meta.json') || {formats: {}, commanders: []};
const meta = {date: new Date().toISOString(), source: 'MTGGoldfish · EDHREC', formats: {}, commanders: []};
const GF = 'https://www.mtggoldfish.com';
const unent = t => String(t).replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCharCode(parseInt(n, 16)))
  .replace(/&quot;/g, '"').replace(/&apos;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
/* Deckliste aus einer MTGGoldfish-Seite lesen: verstecktes Textfeld oder die Kartentabelle */
function goldfishDeck(html){
  const m = html.match(/<(?:input|textarea)[^>]*id=["']deck_input_deck["'][^>]*?(?:value=["']([^"']*)["'][^>]*)?>([^<]*)/i)
    || html.match(/<(?:input|textarea)[^>]*value=["']([^"']*)["'][^>]*id=["']deck_input_deck["'][^>]*>()/i);
  if(m){ const t = unent(m[1] || m[2] || ''); const d = X.parseDeckText(t); if(d.main.length >= 2) return d; }
  // Tabelle: deck-col-qty / deck-col-card, Abschnitt "Sideboard" trennt
  const main = [], side = []; let cur = main;
  const re = /(class=["'][^"']*deck-category-header[^"']*["'][\s\S]*?<\/t[dhr]>)|class=["']deck-col-qty["'][^>]*>\s*(\d+)\s*<[\s\S]*?class=["']deck-col-card["'][^>]*>([\s\S]*?)<\/td>/gi;
  let r;
  while((r = re.exec(html))){
    if(r[1]){ if(/sideboard/i.test(r[1].replace(/<[^>]+>/g, ' '))) cur = side; continue; }
    const name = unent(r[3].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
    if(name) cur.push([name, +r[2]]);
  }
  return main.length >= 2 ? {main, side} : null;
}
for(const fmt of X.META_FORMATS){
  try{
    const html = await get(`${GF}/metagame/${fmt}/full#paper`, 'text');
    const tiles = html.split(/class=['"]archetype-tile['"]/).slice(1);
    const list = [], seen = new Set();
    for(const t of tiles){
      const m = t.match(/href=['"]\/archetype\/([^'"#?]+)(?:#paper)?['"][^>]*>\s*([^<]{2,70}?)\s*<\/a>/);
      if(!m || seen.has(m[1])) continue;
      const sm = t.replace(/<[^>]+>/g, ' ').match(/(\d{1,2}(?:[.,]\d)?)\s*%/);
      seen.add(m[1]);
      list.push({slug: m[1], name: m[2].replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&').trim(), share: sm ? +sm[1].replace(',', '.') : null});
      if(list.length >= 14) break;
    }
    for(const a of list){
      await sleep(900);
      try{
        const ah = await get(`${GF}/archetype/${a.slug}#paper`, 'text');
        const dm = ah.match(/\/deck\/download\/(\d+)/);
        // Die Liste steht direkt auf der Archetyp-Seite (der Download-Link ist für Skripte gesperrt)
        let d = goldfishDeck(ah);
        if(!d && dm){ await sleep(600); try{ d = X.parseDeckText(await get(`${GF}/deck/download/${dm[1]}`, 'text', 1)); }catch(e){} }
        if(!d || !d.main.length){
          console.warn('  Archetyp', a.slug, 'keine Liste gefunden');
          if(!globalThis.__gfDump){ globalThis.__gfDump = 1; for(const k of ['deck_input', 'deck-col-qty', 'decklist', 'deck-view']){ const i = ah.indexOf(k); if(i >= 0) console.log('  [Seite] ' + k + ': ' + ah.slice(Math.max(0, i - 200), i + 600).replace(/\s+/g, ' ')); } }
          continue;
        }
        a.cards = d.main; a.side = d.side; a.deck = dm ? +dm[1] : null;
      }catch(e){ console.warn('  Archetyp', a.slug, e.message); }
    }
    const ok = list.filter(a => a.cards && a.cards.length);
    if(ok.length >= 3){ meta.formats[fmt] = ok; console.log('✓ Meta', fmt, ok.length, 'Decks'); }
    else throw new Error('zu wenig Decks');
  }catch(e){
    console.warn('Meta', fmt, 'nicht geladen:', e.message);
    if(oldMeta.formats && oldMeta.formats[fmt]) meta.formats[fmt] = oldMeta.formats[fmt];
  }
  await sleep(800);
}
try{
  const top = await get('https://json.edhrec.com/pages/commanders/year.json');
  const cmds = X.parseEdhrec(top).filter(x => x.n).sort((a, b) => b.n - a.n).slice(0, 60);
  for(const c of cmds){
    await sleep(500);
    try{
      const j = await get('https://json.edhrec.com/pages/commanders/' + X.edhSlug(c.name) + '.json');
      c.recs = X.parseEdhrec(j).filter(x => x.name !== c.name).sort((a, b) => (b.rate + b.syn) - (a.rate + a.syn)).slice(0, 160)
        .map(x => [x.name, Math.round(x.rate * 100), Math.round(x.syn * 100), x.tag]);
    }catch(e){ console.warn('  EDHREC', c.name, e.message); }
    meta.commanders.push({name: c.name, decks: c.n, recs: c.recs || []});
  }
  console.log('✓ Commander', meta.commanders.length);
}catch(e){
  console.warn('EDHREC nicht geladen:', e.message);
  meta.commanders = oldMeta.commanders || [];
}
write('meta.json', meta);

/* =========================================================
   4) Wechselkurse
   ========================================================= */
try{
  let rates = null, rdate = null;
  try{ const j = await get('https://api.frankfurter.app/latest?from=EUR'); rates = {EUR: 1, ...j.rates}; rdate = j.date; }
  catch(e){
    const x = await get('https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml', 'text');
    rates = {EUR: 1}; for(const m of x.matchAll(/currency=['"]([A-Z]{3})['"]\s+rate=['"]([\d.]+)['"]/g)) rates[m[1]] = +m[2];
    const d = x.match(/time=['"](\d{4}-\d\d-\d\d)['"]/); rdate = d ? d[1] : null;
  }
  write('rates.json', {rates, date: rdate});
}catch(e){ console.warn('Kurse:', e.message); const old = readOld('rates.json'); if(old) write('rates.json', old); }
console.log('Fertig.');
