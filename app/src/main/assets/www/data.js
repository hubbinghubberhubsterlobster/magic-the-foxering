'use strict';
/* =========================================================
   Magic the Foxering – Daten: Kartenkatalog, Preise, Kurse, Speicher
   Quelle: Scryfall (Karten, Bilder, Cardmarket-Trendpreise in Euro),
   vorbereitet von tools/build-data.mjs (GitHub Actions, täglich).
   ========================================================= */
const NATIVE = window.Native || null;
const WEB = !NATIVE;
// Täglich aktualisierte Daten (GitHub-Branch "gh-pages"). Die App bringt beim Installieren eine Kopie mit (data/).
const REPO = 'hubbinghubberhubsterlobster/magic-the-foxering';
const REMOTE = 'https://raw.githubusercontent.com/' + REPO + '/gh-pages/data/';
const LOCAL = 'data/';
const CURRENCIES = ['EUR','USD','GBP','CHF','PLN','CZK','DKK','SEK','NOK','HUF','JPY','CAD','AUD'];
const HOUR = 3600e3;
const IMG = 'https://cards.scryfall.io/';
const SYM = 'https://svgs.scryfall.io/card-symbols/';
const SETICON = 'https://svgs.scryfall.io/sets/';

const COLORS = {
  W:{de:'Weiß', c:'#F3E9C6', basic:'Plains', basicDe:'Ebene'},
  U:{de:'Blau', c:'#3A8FD9', basic:'Island', basicDe:'Insel'},
  B:{de:'Schwarz', c:'#4A3F52', basic:'Swamp', basicDe:'Sumpf'},
  R:{de:'Rot', c:'#E0483A', basic:'Mountain', basicDe:'Gebirge'},
  G:{de:'Grün', c:'#2F9E55', basic:'Forest', basicDe:'Wald'}
};
const COLOR_KEYS = ['W','U','B','R','G'];
const RARITIES = ['c','u','r','m','s','b'];
const RAR_DE = {c:'Common', u:'Uncommon', r:'Rare', m:'Mythic', s:'Special', b:'Bonus'};
const RAR_COL = {c:'#B8BCC8', u:'#9FC3D6', r:'#E3B65C', m:'#F26B3A', s:'#B07CF6', b:'#B07CF6'};
// Reihenfolge = Bits in den Kartendaten (siehe tools/build-data.mjs)
const LEGAL_FORMATS = ['standard','pioneer','modern','legacy','vintage','commander','pauper','brawl'];
const FORMAT_DE = {standard:'Standard', pioneer:'Pioneer', modern:'Modern', legacy:'Legacy', vintage:'Vintage', commander:'Commander', pauper:'Pauper', brawl:'Brawl', limited:'Limited (40 Karten)', casual:'Casual (60 Karten)'};
const META_FORMATS = ['standard','pioneer','modern','pauper','legacy'];
const TYPES = [['Creature','Kreatur'],['Planeswalker','Planeswalker'],['Instant','Spontanzauber'],['Sorcery','Hexerei'],['Artifact','Artefakt'],['Enchantment','Verzauberung'],['Battle','Schlacht'],['Land','Land']];
const TYPE_DE = Object.fromEntries(TYPES);
const BASICS = new Set(['Plains','Island','Swamp','Mountain','Forest','Wastes','Snow-Covered Plains','Snow-Covered Island','Snow-Covered Swamp','Snow-Covered Mountain','Snow-Covered Forest']);

const S = {
  oracle: [], cards: [], byId: new Map(), byOracle: new Map(), sets: {}, cardsDate: null, cv: null,
  priceDate: null, rates: {EUR:1}, ratesDate: null, meta: null, precons: null,
  coll: {},      // "set:nr|lang|foil" -> {q, t}
  decks: [],
  bundles: [],   // Bundle-Events: {id, name, prod, created, cards:{key:{q,t}}, merged}
  partners: [],  // Koop: {id, name, created, updated, coll, fmt, tourney}
  products: null, setDe: {},
  settings: {
    currency:'EUR', dispLang:'de', scanLang:'auto', defaultLang:'de', confirm:2, sound:true, vibrate:true, rotation:'auto', foil:false, frame:'m'
  },
  ui: { partner:null, duel:false, pick:false, bundle:null, assist:null, tab:'collection', mode:'owned', q:'', cols:[], set:'', rarity:'', type:'', fmt:'', lang:'', foil:'', sort:'value', limit:240, deck:null, allSets:false, setQ:'' }
};

/* ---------- Hilfsfunktionen ---------- */
const $ = (s, r=document) => r.querySelector(s);
const $$ = (s, r=document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sleep = ms => new Promise(r => setTimeout(r, ms));

function netUrl(u){ return NATIVE && /^https?:/.test(u) ? '/net?u=' + encodeURIComponent(u) : u; }
async function getText(u){
  const r = await fetch(netUrl(u), {cache:'no-store'});
  if(!r.ok){ let h = u; try{ h = new URL(u, location.href).host; }catch(e){} throw new Error('HTTP ' + r.status + ' bei ' + h); }
  return r.text();
}
async function getJSON(u){ return JSON.parse(await getText(u)); }
function stampUrl(base, f){ return base + f + (base === LOCAL ? '' : '?t=' + Math.floor(Date.now() / 300000)); }
// Web-Version liegt selbst auf GitHub Pages → "data/" ist dort schon aktuell. Die Android-App holt Updates aus GitHub.
const UPD = WEB ? LOCAL : REMOTE;

/* ---------- IndexedDB (Schlüssel/Wert) ---------- */
const DB = {
  db: null,
  open(){
    return new Promise((res, rej) => {
      try{
        const r = indexedDB.open('foxering', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('kv');
        r.onsuccess = () => { this.db = r.result; res(); };
        r.onerror = () => rej(r.error);
      }catch(e){ rej(e); }
    });
  },
  get(k){
    return new Promise((res) => {
      if(!this.db) return res(null);
      try{ const q = this.db.transaction('kv').objectStore('kv').get(k); q.onsuccess = () => res(q.result ?? null); q.onerror = () => res(null); }
      catch(e){ res(null); }
    });
  },
  set(k, v){
    return new Promise((res, rej) => {
      if(!this.db) return res();
      try{ const t = this.db.transaction('kv','readwrite'); t.objectStore('kv').put(v, k); t.oncomplete = () => res(); t.onerror = () => rej(t.error); }
      catch(e){ rej(e); }
    });
  }
};

let saveTimer = null;
let QIDX = null;
function persist(){ QIDX = null; clearTimeout(saveTimer); saveTimer = setTimeout(saveNow, 250); if(window.scheduleAutoBackup) window.scheduleAutoBackup(); }
async function saveNow(){
  clearTimeout(saveTimer); QIDX = null;
  const data = {coll:S.coll, decks:S.decks, bundles:S.bundles, partners:S.partners, settings:S.settings};
  try{ localStorage.setItem('mf-user', JSON.stringify(data)); }catch(e){}
  try{ await DB.set('user', data); }catch(e){}
}
async function loadUser(){
  let u = await DB.get('user');
  if(!u){ try{ u = JSON.parse(localStorage.getItem('mf-user') || 'null'); }catch(e){ u = null; } }
  if(u){ S.coll = u.coll || {}; S.decks = u.decks || []; S.bundles = u.bundles || []; S.partners = u.partners || []; Object.assign(S.settings, u.settings || {}); }
}

/* ---------- Kartenkatalog ---------- */
function applyCards(cd){
  S.oracle = cd.o.map((a, i) => ({i, name:a[0], de:a[1] || '', mana:a[2] || '', cmc:a[3] || 0, type:a[4] || '', typeDe:a[5] || '', col:a[6] || '', ci:a[7] || '',
    txt:a[8] || '', pt:a[9] || '', leg:a[10] || 0, edh:a[11] || 0, kw:a[12] ? a[12].split('|') : [], lay:a[13] || ''}));
  S.cards = cd.p.map((a, i) => ({id:a[1] + ':' + a[2], idx:i, o:S.oracle[a[0]], s:a[1], n:a[2], r:a[3], sid:a[4], fin:a[5] || 1, eur:a[6] || 0, eurf:a[7] || 0, de:a[8] || '', fl:a[9] || 0}));
  S.byId = new Map(S.cards.map(c => [c.id, c]));
  S.byOracle = new Map();
  for(const c of S.cards){ let l = S.byOracle.get(c.o.i); if(!l) S.byOracle.set(c.o.i, l = []); l.push(c); }
  S.sets = {};
  for(const s of cd.sets) S.sets[s[0]] = {code:s[0], name:s[1], release:s[2], type:s[3], parent:s[4], icon:s[5], count:s[6], size:s[7]};
  S.cardsDate = cd.date; S.cv = cd.cv;
  if(window.ENGINE) ENGINE.reset();
  if(window.ASSIST) ASSIST.reset();
  HAY = null;
}
function applyPrices(pr){
  if(!pr || pr.cv !== S.cv || !pr.e) return false;
  for(let i = 0; i < S.cards.length; i++){ S.cards[i].eur = pr.e[i] || 0; S.cards[i].eurf = pr.f[i] || 0; }
  S.priceDate = pr.date; if(window.ASSIST) ASSIST.reset();
  return true;
}
/* Lädt Karten (+Preise). base = LOCAL (mitgeliefert) oder UPD (aktuell aus dem Netz) */
async function loadCards(base, progress=()=>{}){
  progress('Lade Magic-Kartendaten …');
  const cd = await getJSON(stampUrl(base, 'cards.json'));
  progress('Lade Cardmarket-Preise …');
  const pr = await getJSON(stampUrl(base, 'prices.json'));
  progress('Bereite Karten vor …');
  await sleep(20);
  applyCards(cd); applyPrices(pr);
  await DB.set('cards', cd); await DB.set('prices', pr);
  return cd;
}
/* Prüft, ob es neue Daten gibt; lädt nur das Nötige */
async function updateData(force){
  const md = await getJSON(stampUrl(UPD, 'metadata.json'));
  if(force || md.cv !== S.cv){ await loadCards(UPD); return 'cards'; }
  if(md.date !== S.priceDate){ const pr = await getJSON(stampUrl(UPD, 'prices.json')); if(applyPrices(pr)) await DB.set('prices', pr); return 'prices'; }
  return 'same';
}
async function updateRates(base=UPD){
  let fx;
  try{ fx = await getJSON(stampUrl(base, 'rates.json')); }
  catch(e){ if(!NATIVE) throw e; const j = await getJSON('https://api.frankfurter.app/latest?from=EUR'); fx = {rates:Object.assign({EUR:1}, j.rates), date:j.date}; }
  S.rates = Object.assign({EUR:1}, fx.rates || {}); S.ratesDate = fx.date;
  await DB.set('rates', fx);
}
async function updateMeta(base=UPD){
  const m = await getJSON(stampUrl(base, 'meta.json'));
  if(m && (Object.keys(m.formats || {}).length || (m.commanders || []).length)){ S.meta = m; await DB.set('meta', m); if(window.ASSIST) ASSIST.reset(); }
  return S.meta;
}
function applyProducts(p){
  if(!p || !p.items) return;
  S.products = p; S.setDe = p.setDe || {};
}
async function updateProducts(base=UPD){
  const p = await getJSON(stampUrl(base, 'products.json'));
  if(p && p.items){ applyProducts(p); await DB.set('products', p); }
  return S.products;
}
async function loadPrecons(){
  if(S.precons) return S.precons;
  let p = await DB.get('precons');
  try{ const n = await getJSON(stampUrl(UPD, 'precons.json')); if(n && n.decks) p = n; }
  catch(e){ if(!p) p = await getJSON(stampUrl(LOCAL, 'precons.json')); }
  S.precons = p; DB.set('precons', p).catch(() => {});
  return p;
}

/* ---------- Preise & Formatierung ---------- */
function priceEUR(c, foil){
  if(!c) return null;
  const v = foil ? (c.eurf || c.eur) : (c.eur || c.eurf);
  return v ? v / 100 : null;
}
/* Günstigster Druck einer Karte (für Kaufvorschläge) */
function cheapest(o){
  let best = null;
  for(const c of S.byOracle.get(o.i) || []){ const p = priceEUR(c, false); if(p && (best == null || p < best)) best = p; }
  return best;
}
function money(eur){
  if(eur == null || isNaN(eur)) return '–';
  let cur = S.settings.currency, r = cur === 'EUR' ? 1 : S.rates[cur];
  if(!r){ cur = 'EUR'; r = 1; }
  const noDec = cur === 'JPY' || cur === 'HUF';
  try{ return new Intl.NumberFormat('de-DE', {style:'currency', currency:cur, maximumFractionDigits: noDec ? 0 : 2, minimumFractionDigits: noDec ? 0 : 2}).format(eur * r); }
  catch(e){ return (eur * r).toFixed(2) + ' ' + cur; }
}
function fmtDate(d){
  if(!d) return 'nie';
  const x = new Date(d); if(isNaN(x)) return String(d);
  return x.toLocaleDateString('de-DE', {day:'2-digit', month:'2-digit', year:'numeric'}) + (String(d).length > 10 ? ', ' + x.toLocaleTimeString('de-DE', {hour:'2-digit', minute:'2-digit'}) : '');
}

/* ---------- Karten-Anzeige ---------- */
function dl(){ return S.settings.dispLang; }
function oName(o, L=dl()){ return L === 'de' && o.de ? o.de : o.name; }
function cName(c, L=dl()){ return oName(c.o, L); }
function cType(c, L=dl()){ return L === 'de' && c.o.typeDe ? c.o.typeDe : c.o.type; }
function imgUrl(id, size){ return id ? IMG + size + '/front/' + id[0] + '/' + id[1] + '/' + id + '.jpg' : ''; }
function cImg(c, L=dl(), size='normal'){ return imgUrl(L === 'de' && c.de ? c.de : c.sid, size); }
function cImgEn(c, size='normal'){ return imgUrl(c.sid, size); }
/* <img> mit Rückfall auf das englische Bild, falls es das deutsche nicht gibt */
function cardImg(c, L, size, attrs=''){
  const a = cImg(c, L, size), b = cImgEn(c, size);
  return `<img ${attrs} loading="lazy" src="${esc(a)}" ${a !== b ? `data-fb="${esc(b)}"` : ''} alt="">`;
}
function setName(code){ const s = S.sets[code]; const de = dl() === 'de' && S.setDe[code]; return de || (s ? s.name : String(code).toUpperCase()); }
function setIcon(code){ const s = S.sets[code]; return `<img class="seticon" src="${SETICON}${esc(s ? s.icon : code)}.svg" alt="" onerror="this.remove()">`; }
function colList(o){ return (o.col || '').split('').filter(Boolean); }
function ciList(o){ return (o.ci || '').split('').filter(Boolean); }
function colDots(cols){ return cols.length ? cols.map(k => `<i class="dot" style="background:${(COLORS[k] || {}).c || '#888'}"></i>`).join('') : '<i class="dot" style="background:#9AA0B4"></i>'; }
function cNumLabel(c){ return c.s.toUpperCase() + ' #' + c.n; }
function isLand(o){ return /\bLand\b/.test(o.type.split('//')[0]); }
function isBasic(o){ return BASICS.has(o.name); }
function mainType(o){
  const t = o.type.split('//')[0];
  if(/\bLand\b/.test(t)) return 'Land';
  for(const [k] of TYPES) if(new RegExp('\\b' + k + '\\b').test(t)) return k;
  return 'Other';
}
function isLegendary(o){ return /\bLegendary\b/.test(o.type.split('//')[0]); }
function canCommand(o){ return (isLegendary(o) && /\bCreature\b/.test(o.type.split('//')[0])) || /can be your commander/i.test(o.txt); }
function legalIn(o, fmt){ const i = LEGAL_FORMATS.indexOf(fmt); return i < 0 || !!(o.leg & (1 << i)); }
function maxCopies(o, fmt){
  if(fmt === 'limited' || isBasic(o) || /A deck can have any number of cards named/i.test(o.txt)) return 99;
  const m = o.txt.match(/A deck can have up to (\w+) cards named/i);
  if(m){ const w = {seven:7, eight:8, nine:9, ten:10}[m[1].toLowerCase()]; if(w) return w; }
  return fmt === 'commander' || fmt === 'brawl' ? 1 : 4;
}
/* Manakosten & Kartentext mit Symbolen */
function symName(s){ return s.replace(/\//g, '').replace('½', 'HALF').replace('∞', 'INFINITY').toUpperCase(); }
function manaHtml(cost, cls='ms'){ return esc(cost || '').replace(/\{([^}]+)\}/g, (_, s) => `<img class="${cls}" src="${SYM}${encodeURIComponent(symName(s))}.svg" alt="{${esc(s)}}">`); }
function textHtml(t){ return manaHtml(t, 'ms sm').replace(/\n/g, '<br>'); }

/* ---------- Sammlung ---------- */
function ckey(id, lang, foil){ return id + '|' + lang + '|' + (foil ? 1 : 0); }
function addCard(id, lang, foil, n=1){
  const k = ckey(id, lang, foil);
  const e = S.coll[k] || {q:0, t:Date.now()};
  e.q += n; if(n > 0) e.t = Date.now();
  if(e.q <= 0) delete S.coll[k]; else S.coll[k] = e;
  QIDX = null; persist();
  return e.q > 0 ? e.q : 0;
}
function qtyOf(id, lang, foil){ const e = S.coll[ckey(id, lang, foil)]; return e ? e.q : 0; }
function entries(){
  const out = [];
  for(const [k, e] of Object.entries(S.coll)){
    const [id, lang, f] = k.split('|');
    const c = S.byId.get(id);
    if(c) out.push({c, lang, foil: f === '1', q: e.q, t: e.t || 0});
  }
  return out;
}
function ownedById(){
  const m = new Map();
  for(const e of entries()){
    let a = m.get(e.c.id);
    if(!a){ a = {c:e.c, q:0, qf:0, langs:{}, value:0, t:0}; m.set(e.c.id, a); }
    a.q += e.q; if(e.foil) a.qf += e.q;
    a.langs[e.lang] = (a.langs[e.lang] || 0) + e.q;
    const p = priceEUR(e.c, e.foil); if(p) a.value += p * e.q;
    if(e.t > a.t) a.t = e.t;
  }
  return m;
}
function ownedQty(id){
  if(!QIDX){ QIDX = new Map(); for(const [k, e] of Object.entries(S.coll)){ const i = k.slice(0, k.indexOf('|')); QIDX.set(i, (QIDX.get(i) || 0) + e.q); } }
  return QIDX.get(id) || 0;
}
/* Besitz pro Karte (alle Drucke/Sprachen zusammen), Schlüssel = Oracle-Index */
function ownedByOracle(){
  const m = new Map();
  for(const e of entries()){ m.set(e.c.o.i, (m.get(e.c.o.i) || 0) + e.q); }
  return m;
}
function collectionStats(){
  let total = 0, value = 0; const uniq = new Set();
  for(const e of entries()){ total += e.q; uniq.add(e.c.o.i); const p = priceEUR(e.c, e.foil); if(p) value += p * e.q; }
  return {total, unique: uniq.size, value};
}
/* Kartengruppe für Decks: gleiche Karte = gleicher Name (alle Drucke & Sprachen) */
function gkey(c){ return 'o:' + c.o.name; }

/* Bevorzugter Druck einer Karte: eigener Druck, sonst ein normaler, aktueller */
function ownedPrint(o){
  let best = null, bq = 0;
  for(const c of S.byOracle.get(o.i) || []){ const q = ownedQty(c.id); if(q > bq){ bq = q; best = c; } }
  return best;
}
function bestPrint(o){ return ownedPrint(o) || (window.ENGINE ? ENGINE.preferPrinting(S.byOracle.get(o.i) || []) : (S.byOracle.get(o.i) || [])[0]); }

/* ---------- Suche ---------- */
let HAY = null;
function hay(){
  if(HAY) return HAY;
  HAY = S.oracle.map(o => ENGINE.norm(o.name + ' ' + o.de + ' ' + o.type + ' ' + o.typeDe));
  return HAY;
}
function searchOracle(text, filter=null, limit=60){
  const q = ENGINE.norm(text); if(!q) return [];
  const words = q.split(' '), H = hay(), res = [];
  for(const o of S.oracle){
    if(filter && !filter(o)) continue;
    const h = H[o.i];
    if(!words.every(w => h.includes(w))) continue;
    const nm = ENGINE.norm(o.name), nd = ENGINE.norm(o.de);
    const rank = nm === q || nd === q ? 0 : nm.startsWith(q) || nd.startsWith(q) ? 1 : (' ' + nm + ' ' + nd).includes(' ' + words[0]) ? 2 : 3;
    res.push({o, rank});
  }
  res.sort((a, b) => a.rank - b.rank || (a.o.edh || 1e6) - (b.o.edh || 1e6));
  return res.slice(0, limit).map(x => x.o);
}

/* ---------- Gemeinsame Parser (auch vom Daten-Skript genutzt) ---------- */
/* Deckliste als Text: "4 Lightning Bolt", Leerzeile/„Sideboard“ trennt das Sideboard */
function parseDeckText(txt){
  const main = [], side = []; let cur = main;
  for(const raw of String(txt || '').split(/\r?\n/)){
    const l = raw.trim();
    if(!l){ if(main.length) cur = side; continue; }
    if(/^(sideboard|side ?board:|sb:?)$/i.test(l)){ cur = side; continue; }
    const m = l.match(/^(\d+)\s*x?\s+(.+?)\s*$/i);
    if(m) cur.push([m[2], +m[1]]);
  }
  return {main, side};
}
/* EDHREC-Antwort: alle Kartenlisten einsammeln → [{name, n, rate, syn, tag}] */
function parseEdhrec(j){
  const out = [], seen = new Set();
  (function walk(x, tag){
    if(!x || typeof x !== 'object') return;
    if(Array.isArray(x)){ for(const y of x) walk(y, tag); return; }
    if(Array.isArray(x.cardviews)){
      const t = x.tag || x.header || tag || '';
      for(const v of x.cardviews){
        if(!v || !v.name || seen.has(v.name)) continue; seen.add(v.name);
        const n = v.num_decks ?? v.inclusion ?? 0, pot = v.potential_decks || 0;
        out.push({name:v.name, n, rate: pot ? Math.min(1, n / pot) : 0, syn: v.synergy || 0, tag:t});
      }
      return;
    }
    for(const k of Object.keys(x)) walk(x[k], tag);
  })(j, '');
  return out;
}
function edhSlug(name){
  return String(name).split(' // ')[0].normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/['’",.!?:]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

/* ---------- Bundle-Events ---------- */
function bundleById(id){ return S.bundles.find(b => b.id === id); }
function bundleEntries(b){
  const out = [];
  for(const [k, e] of Object.entries(b.cards || {})){ const [id, lang, f] = k.split('|'); const c = S.byId.get(id); if(c) out.push({c, lang, foil: f === '1', q: e.q, t: e.t || 0, k}); }
  return out;
}
function bundleAdd(b, id, lang, foil, n=1){
  const k = ckey(id, lang, foil), e = b.cards[k] || {q:0, t:Date.now()};
  e.q += n; if(n > 0) e.t = Date.now();
  if(e.q <= 0) delete b.cards[k]; else b.cards[k] = e;
  if(b.merged) addCard(id, lang, foil, n);   // schon übernommen → Sammlung mitführen
  persist();
  return e.q > 0 ? e.q : 0;
}
function bundleQty(b, id, lang, foil){ const e = b.cards[ckey(id, lang, foil)]; return e ? e.q : 0; }
function bundleOwned(b){ const m = new Map(); for(const e of bundleEntries(b)) m.set(e.c.o.i, (m.get(e.c.o.i) || 0) + e.q); return m; }
function bundleStats(b){
  let total = 0, value = 0; const uniq = new Set(); let top = null, topV = 0;
  for(const e of bundleEntries(b)){ total += e.q; uniq.add(e.c.o.i); const p = priceEUR(e.c, e.foil) || 0; value += p * e.q; if(p > topV){ topV = p; top = e; } }
  return {total, unique: uniq.size, value, top, topV};
}
