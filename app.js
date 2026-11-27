'use strict';
/* =========================================================
   Magic the Foxering – Oberfläche
   ========================================================= */
const A = {};          // Klick-Aktionen (data-act)
const view = $('#view');

/* ---------- Toast / Sheet / Dialoge ---------- */
let toastT = null;
function toast(msg, ms=2200){ const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms); }
let sheetOnClose = null;
function openSheet(html, onClose=null){ $('#sheet').innerHTML = html; $('#sheet').scrollTop = 0; $('#sheet-wrap').classList.add('open'); sheetOnClose = onClose; }
function closeSheet(){ if(!$('#sheet-wrap').classList.contains('open')) return; $('#sheet-wrap').classList.remove('open'); const f = sheetOnClose; sheetOnClose = null; if(f) f(); }
function sheetOpen(){ return $('#sheet-wrap').classList.contains('open'); }
A['sheet-close'] = closeSheet;
/* Sheet nach unten wischen (oder auf den Griff oben tippen) schließt es */
(function(){
  const sh = $('#sheet'); let y0 = null, dy = 0, drag = false;
  sh.addEventListener('touchstart', e => {
    const t = e.touches[0], top = sh.getBoundingClientRect().top;
    if(sh.scrollTop > 0 && t.clientY - top > 50){ y0 = null; return; }
    y0 = t.clientY; dy = 0; drag = false;
  }, {passive:true});
  sh.addEventListener('touchmove', e => {
    if(y0 == null) return;
    dy = e.touches[0].clientY - y0;
    if(dy > 6 && sh.scrollTop <= 0){ drag = true; sh.style.transition = 'none'; sh.style.transform = `translateY(${dy}px)`; if(e.cancelable) e.preventDefault(); }
    else if(dy < 0 && drag){ sh.style.transform = ''; }
  }, {passive:false});
  const end = () => {
    if(y0 == null) return;
    sh.style.transition = ''; sh.style.transform = '';
    if(drag && dy > 80) closeSheet();
    y0 = null; drag = false;
  };
  sh.addEventListener('touchend', end); sh.addEventListener('touchcancel', end);
  sh.addEventListener('click', e => { if(e.target === sh && e.clientY - sh.getBoundingClientRect().top < 28) closeSheet(); });
})();

function ask(title, text, buttons){
  return new Promise(res => {
    const bs = buttons || [{l:'Abbrechen', v:false, c:'ghost'}, {l:'OK', v:true}];
    openSheet(`<h2>${esc(title)}</h2>${text ? `<p class="muted">${text}</p>` : ''}<div class="actions" style="flex-wrap:wrap">${bs.map((b,i) => `<button class="btn ${b.c||''}" data-ask="${i}">${esc(b.l)}</button>`).join('')}</div>`, () => res(null));
    $$('#sheet [data-ask]').forEach(el => el.onclick = () => { const v = bs[+el.dataset.ask].v; sheetOnClose = null; closeSheet(); res(v); });
  });
}
function promptText(title, value='', placeholder=''){
  return new Promise(res => {
    openSheet(`<h2>${esc(title)}</h2><input class="field" id="pt-in" value="${esc(value)}" placeholder="${esc(placeholder)}"><div class="actions"><button class="btn ghost" data-pt="0">Abbrechen</button><button class="btn" data-pt="1">OK</button></div>`, () => res(null));
    const inp = $('#pt-in'); setTimeout(() => inp.focus(), 250);
    const done = ok => { const v = inp.value.trim(); sheetOnClose = null; closeSheet(); res(ok ? v : null); };
    $$('#sheet [data-pt]').forEach(el => el.onclick = () => done(el.dataset.pt === '1'));
    inp.onkeydown = e => { if(e.key === 'Enter') done(true); };
  });
}

/* ---------- Kleine Bausteine ---------- */
const LOGO = `<svg viewBox="0 0 108 108" style="stroke:none"><path fill="#F28C28" d="M34,30 L46,45 L62,45 L74,30 L76,53 C76,67 66,78 54,82 C42,78 32,67 32,53 Z"/><path fill="#8A3B12" d="M37,36 L45,45 L38,47 Z M71,36 L63,45 L70,47 Z"/><path fill="#FFF4E6" d="M39,59 C46,62 50,66 54,75 C58,66 62,62 69,59 C66,70 61,77 54,81 C47,77 42,70 39,59 Z"/><circle fill="#1B1530" cx="46.1" cy="56" r="2.6"/><circle fill="#1B1530" cx="61.9" cy="56" r="2.6"/><path fill="#1B1530" d="M51.2,74 L56.8,74 L54,77.6 Z"/><circle fill="#E0483A" cx="54" cy="24" r="5"/><circle fill="#3A8FD9" cx="42" cy="20" r="3.4"/><circle fill="#2F9E55" cx="66" cy="20" r="3.4"/></svg>`;
const ICON_SEARCH = `<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>`;
function colorButtons(sel, act, withC=true){
  return [...COLOR_KEYS, ...(withC ? ['C'] : [])].map(k => `<button class="mana ${sel.includes(k) ? 'on' : ''}" data-act="${act}" data-col="${k}" title="${k === 'C' ? 'Farblos' : COLORS[k].de}" style="--mc:${k === 'C' ? '#B9B4C2' : COLORS[k].c}"><span>${k}</span><img src="${SYM}${k}.svg" alt="" onerror="this.remove()"></button>`).join('');
}
function tile(c, o={}){
  const L = o.lang || dl();
  return `<button class="tile ${o.missing ? 'missing' : ''}" data-act="card" data-id="${esc(c.id)}">
    <div class="img">${cardImg(c, L, 'normal')}<div class="ph">${esc(cName(c, L))}</div>
      ${o.q ? `<span class="qty">×${o.q}</span>` : ''}${o.qf ? `<span class="foil">✦ ${o.qf}</span>` : ''}</div>
    <div class="tname">${esc(cName(c, L))}</div><div class="tsub">${setIcon(c.s)}${esc(c.s.toUpperCase())} #${esc(c.n)}</div>
    <div class="tprice">${o.price != null ? money(o.price) : money(priceEUR(c, false))}</div></button>`;
}
function stepper(attrs, q){
  return `<div class="stepper"><button data-act="own" ${attrs} data-d="-1">−</button><b>${q}</b><button data-act="own" ${attrs} data-d="1">+</button></div>`;
}
function langName(L){ return ({de:'Deutsch', en:'Englisch', fr:'Französisch', it:'Italienisch', es:'Spanisch', pt:'Portugiesisch', ja:'Japanisch', ko:'Koreanisch', ru:'Russisch', zhs:'Chinesisch', zht:'Chinesisch (trad.)', ph:'Phyrexianisch'})[L] || String(L).toUpperCase(); }

/* ---------- Navigation ---------- */
const NAV = [];
function snap(){ const u = S.ui; return {partner:u.partner, duel:u.duel, pick:u.pick, tab:u.tab, deck:u.deck, assist:u.assist, bundle:u.bundle, mode:u.mode, set:u.set, sort:u.sort, q:u.q, cols:[...u.cols], rarity:u.rarity, type:u.type, fmt:u.fmt, lang:u.lang, foil:u.foil, y: window.scrollY}; }
function go(ch){ NAV.push(snap()); if(NAV.length > 50) NAV.shift(); Object.assign(S.ui, ch); S.ui.limit = 240; render(); window.scrollTo(0, 0); }
function goBack(){ if(!NAV.length) return false; const st = NAV.pop(); const y = st.y; delete st.y; Object.assign(S.ui, st); render(); setTimeout(() => window.scrollTo(0, y || 0), 0); return true; }
function backBtn(){ return NAV.length ? `<button class="round back" data-act="back" aria-label="Zurück">‹</button>` : ''; }
A.back = () => { if(!goBack()) go({tab:'collection', deck:null, assist:null}); };
A.tab = el => { const t = el.dataset.tab; NAV.length = 0; if(t === S.ui.tab && !S.ui.deck && !S.ui.assist && !S.ui.bundle && !S.ui.partner && !(t === 'collection' && S.ui.set)){ window.scrollTo(0, 0); render(); return; } Object.assign(S.ui, {tab:t, deck:null, assist:null, bundle:null, partner:null, duel:false, pick:false, limit:240}); if(t === 'collection') S.ui.set = ''; render(); window.scrollTo(0, 0); };
function render(){
  if(SEL && S.ui.tab !== 'collection') selEnd();
  $$('#nav .nav-btn').forEach(b => b.classList.toggle('on', b.dataset.tab === S.ui.tab));
  if(!S.cards.length) return;
  const t = S.ui.tab;
  if(t === 'collection') renderCollection();
  else if(t === 'sets') renderSets();
  else if(t === 'decks') S.ui.assist ? ASSIST.render() : S.ui.deck ? (S.ui.pick ? renderPick() : renderDeck()) : renderDecks();
  else if(t === 'coop') S.ui.deck ? (S.ui.pick ? renderPick() : renderDeck()) : S.ui.partner ? (S.ui.duel ? renderDuel() : renderPartner()) : renderCoop();
  else if(t === 'bundles') S.ui.assist ? ASSIST.render() : S.ui.deck ? (S.ui.pick ? renderPick() : renderDeck()) : S.ui.bundle ? renderBundle() : renderBundles();
  else S.ui.assist ? ASSIST.render() : renderMore();
}

/* =========================================================
   Sammlung
   ========================================================= */
function filterActive(){ const u = S.ui; return (u.set ? 1 : 0) + (u.rarity ? 1 : 0) + (u.type ? 1 : 0) + (u.fmt ? 1 : 0) + (u.lang ? 1 : 0) + (u.foil ? 1 : 0); }
function matchOracle(o){
  const u = S.ui;
  if(u.cols.length){ const cl = colList(o); if(!(cl.length ? cl.some(k => u.cols.includes(k)) : u.cols.includes('C'))) return false; }
  if(u.type && !new RegExp('\\b' + u.type + '\\b').test(o.type)) return false;
  if(u.fmt && !legalIn(o, u.fmt)) return false;
  if(u.q){
    const q = ENGINE.norm(u.q), h = hay()[o.i];
    if(!q.split(' ').every(w => h.includes(w))) return false;
  }
  return true;
}
function directPrint(q){ const m = String(q).trim().toLowerCase().match(/^([a-z0-9]{2,6})\s*[#: ]\s*([a-z0-9★\-]+)$/); return m ? S.byId.get(m[1] + ':' + m[2]) : null; }
function matchCard(c){
  const u = S.ui;
  if(u.set && c.s !== u.set) return false;
  if(u.rarity && c.r !== u.rarity) return false;
  if(u.q){ const dp = directPrint(u.q); if(dp) return dp === c; }
  return matchOracle(c.o);
}
function renderCollection(){
  const st = collectionStats(), u = S.ui;
  view.innerHTML = `
    <div class="row between"><div class="logo">${backBtn()}${LOGO}<h1 style="margin:0">Foxering</h1></div>
      <span class="tag">${esc(S.settings.currency)}</span></div>
    <div class="hero" style="margin-top:12px">
      <svg class="spark" viewBox="0 0 24 24" style="fill:#E3B65C;stroke:none"><path d="M12 0l2.6 9.4L24 12l-9.4 2.6L12 24l-2.6-9.4L0 12l9.4-2.6z"/></svg>
      <div class="lbl">Sammlungswert</div><div class="big">${money(st.value)}</div>
      <div class="stats"><div><b>${st.total}</b>Karten</div><div><b>${st.unique}</b>verschiedene</div><div><b>${S.decks.length}</b>Decks</div></div>
      <div class="tiny" style="color:#b9b3dc;margin-top:8px">Cardmarket-Trendpreise · Stand ${fmtDate(S.priceDate)}</div>
      <div class="tiny" id="sync" style="color:#9fe3bf;margin-top:2px">${esc(S.syncMsg || '')}</div>
    </div>
    ${safetyBanner(st)}
    <div class="seg"><button class="${u.mode==='owned'?'on':''}" data-act="mode" data-m="owned">Meine Karten</button><button class="${u.mode==='all'?'on':''}" data-act="mode" data-m="all">Alle Karten</button></div>
    <div class="search">${ICON_SEARCH}<input id="q" placeholder="Name (DE/EN), Typ oder z. B. „MH3 123“" value="${esc(u.q)}"></div>
    <div class="row" style="margin-bottom:12px"><div class="chips grow">${colorButtons(u.cols, 'col')}</div>
      <button class="chip ${filterActive() ? 'on' : ''}" data-act="filters">Filter ${filterActive() ? `<span class="badge">${filterActive()}</span>` : ''}</button></div>
    ${u.set ? `<div class="row" style="margin:-4px 0 12px"><span class="chip on">${setIcon(u.set)} ${esc(setName(u.set))}</span><button class="chip" data-act="clear-set">✕ Set</button></div>` : ''}
    <div class="row between" style="margin-bottom:8px"><div id="grid-info" class="muted small"></div><button class="chip" data-act="sel-start">☑ Auswählen</button></div>
    <div id="grid" class="grid"></div><div id="grid-more"></div>`;
  const q = $('#q'); let qt = null;
  q.oninput = () => { clearTimeout(qt); qt = setTimeout(() => { S.ui.q = q.value.trim(); S.ui.limit = 240; renderGrid(); }, 220); };
  renderGrid();
}
function sortItems(items, so){
  const nm = (a, b) => cName(a.c).localeCompare(cName(b.c), 'de');
  items.sort((a, b) => so === 'name' ? nm(a, b) : so === 'new' ? b.t - a.t : so === 'qty' ? b.q - a.q : so === 'number' ? cmpNum(a.c, b.c)
    : so === 'cmc' ? (a.c.o.cmc - b.c.o.cmc) || nm(a, b) : so === 'total' ? (b.value - a.value) : ((b.unit || 0) - (a.unit || 0)) || (b.value - a.value) || nm(a, b));
}
function renderGrid(){
  const u = S.ui, grid = $('#grid'); if(!grid) return;
  let items, hint = '';
  const own = ownedById();
  if(u.mode === 'owned'){
    items = [...own.values()].filter(a => matchCard(a.c)
      && (!u.lang || a.langs[u.lang]) && (!u.foil || (u.foil === 'foil' ? a.qf > 0 : a.q - a.qf > 0)));
    items.forEach(a => a.unit = a.q ? a.value / a.q : 0);
  } else {
    let prints;
    const dp = u.q && directPrint(u.q);
    if(dp) prints = [dp];
    else if(u.set) prints = S.cards.filter(c => c.s === u.set && matchCard(c));
    else if(u.q || u.cols.length || u.type || u.fmt || u.rarity){
      prints = S.oracle.filter(matchOracle).map(o => bestPrint(o)).filter(c => c && (!u.rarity || c.r === u.rarity));
    } else { prints = []; hint = 'Suche nach einer Karte, wähle Farben oder ein Set (Filter oder Reiter „Sets“).'; }
    items = prints.map(c => { const a = own.get(c.id); const v = priceEUR(c, false) || 0; return {c, q: a ? a.q : 0, qf: a ? a.qf : 0, value: v, unit: v, t: a ? a.t : 0}; });
  }
  sortItems(items, u.mode === 'all' && u.sort === 'value' && u.set ? 'number' : u.sort);
  const shown = items.slice(0, u.limit);
  const nCopies = items.reduce((s2, i) => s2 + (i.q || 0), 0), nNames = new Set(items.map(i => i.c.o.i)).size;
  $('#grid-info').textContent = !items.length ? '' : u.mode === 'all' ? `${items.length} ${items.length === 1 ? 'Karte' : 'Karten'} · ${items.filter(i => i.q).length} im Besitz`
    : `${nCopies} Karten · ${nNames} verschiedene · ${items.length} Drucke`;
  if(!items.length){
    grid.innerHTML = '';
    $('#grid-more').innerHTML = hint ? `<div class="empty">${esc(hint)}</div>` : u.mode === 'owned' && !Object.keys(S.coll).length
      ? `<div class="empty"><div class="icon">🦊</div><b>Noch keine Karten</b><p>Tippe unten auf den Scan-Knopf, leg das Handy in deinen Ständer und schieb eine Karte nach der anderen drunter.</p><button class="btn" data-act="scan-open">Scanner starten</button><p class="small">Oder unter <b>Decks</b> ein gekauftes Fertigdeck (z. B. Commander-Deck) hinzufügen.</p><button class="btn ghost small" data-act="backup-import">♻️ Backup wiederherstellen</button></div>`
      : `<div class="empty">Keine Karten gefunden.</div>`;
    return;
  }
  GRID_IDS = items.map(a => a.c.id);
  grid.innerHTML = shown.map(a => tile(a.c, {q:a.q, qf:a.qf, missing: u.mode === 'all' && !a.q, price: u.mode === 'owned' ? (a.q ? a.value / a.q : null) : null,
    lang: u.mode === 'owned' && a.langs ? (Object.entries(a.langs).sort((x,y) => y[1]-x[1])[0] || [dl()])[0] : dl()})).join('');
  if(SEL) $$('#grid .tile').forEach(t => t.classList.toggle('chosen', SEL.has(t.dataset.id)));
  $('#grid-more').innerHTML = items.length > shown.length ? `<div style="text-align:center;margin:18px 0"><button class="btn ghost" data-act="more-cards">Weitere ${Math.min(240, items.length - shown.length)} anzeigen</button></div>` : '';
}
function setRel(code){ const s = S.sets[code]; return s && s.release ? s.release : '9999'; }
function cnNum(n){ const m = String(n).match(/\d+/); return m ? +m[0] : 99999; }
function cmpNum(a, b){ const sa = setRel(a.s), sb = setRel(b.s); if(sa !== sb) return sa < sb ? 1 : -1; if(a.s !== b.s) return a.s < b.s ? -1 : 1; return cnNum(a.n) - cnNum(b.n) || String(a.n).localeCompare(String(b.n)); }
A.mode = el => { S.ui.mode = el.dataset.m; S.ui.limit = 240; renderCollection(); };
A.col = el => { const k = el.dataset.col, a = S.ui.cols; S.ui.cols = a.includes(k) ? a.filter(x => x !== k) : [...a, k]; $$('[data-act="col"]').forEach(b => b.classList.toggle('on', S.ui.cols.includes(b.dataset.col))); renderGrid(); };
A['more-cards'] = () => { S.ui.limit += 240; renderGrid(); };
A['clear-set'] = () => { S.ui.set = ''; renderCollection(); };
A.filters = () => {
  const u = S.ui;
  const ownSets = new Set(entries().map(e => e.c.s)); if(u.set) ownSets.add(u.set);
  const sets = [...ownSets].sort((a, b) => setRel(b).localeCompare(setRel(a)));
  const opt = (v, l, cur) => `<option value="${esc(v)}" ${v === cur ? 'selected' : ''}>${esc(l)}</option>`;
  openSheet(`<h2>Filter & Sortierung</h2>
    <label class="lbl">Sortieren nach</label><select id="f-sort">${[['value','Preis pro Karte'],['total','Gesamtwert (Preis × Anzahl)'],['name','Name'],['number','Set & Nummer'],['cmc','Manawert'],['new','Zuletzt hinzugefügt'],['qty','Anzahl']].map(([v,l]) => opt(v,l,u.sort)).join('')}</select>
    <label class="lbl">Set (aus deiner Sammlung – alle Sets unter „Sets“)</label><select id="f-set">${opt('', 'Alle Sets', u.set)}${sets.map(s => opt(s, setName(s) + ' (' + s.toUpperCase() + ')', u.set)).join('')}</select>
    <label class="lbl">Kartentyp</label><select id="f-type">${opt('', 'Alle', u.type)}${TYPES.map(([k,v]) => opt(k, v, u.type)).join('')}</select>
    <label class="lbl">Seltenheit</label><select id="f-rar">${opt('', 'Alle', u.rarity)}${RARITIES.map(r => opt(r, RAR_DE[r], u.rarity)).join('')}</select>
    <label class="lbl">Erlaubt im Format</label><select id="f-fmt">${opt('', 'Egal', u.fmt)}${LEGAL_FORMATS.map(f => opt(f, FORMAT_DE[f], u.fmt)).join('')}</select>
    <label class="lbl">Sprache (Meine Karten)</label><select id="f-lang">${opt('', 'Alle', u.lang)}${opt('de','Deutsch',u.lang)}${opt('en','Englisch',u.lang)}</select>
    <label class="lbl">Ausführung (Meine Karten)</label><select id="f-foil">${opt('', 'Alle', u.foil)}${opt('normal','Normal',u.foil)}${opt('foil','Foil',u.foil)}</select>
    <div class="actions"><button class="btn ghost" data-act="filters-reset">Zurücksetzen</button><button class="btn" data-act="filters-apply">Anwenden</button></div>`);
};
A['filters-apply'] = () => { const u = S.ui; u.sort = $('#f-sort').value; u.set = $('#f-set').value; u.rarity = $('#f-rar').value; u.type = $('#f-type').value; u.fmt = $('#f-fmt').value; u.lang = $('#f-lang').value; u.foil = $('#f-foil').value; u.limit = 240; closeSheet(); renderCollection(); };
A['filters-reset'] = () => { Object.assign(S.ui, {set:'', rarity:'', type:'', fmt:'', lang:'', foil:'', cols:[], q:'', sort:'value'}); closeSheet(); renderCollection(); };

/* =========================================================
   Sets
   ========================================================= */
const MAIN_SET = /^(expansion|core|masters|draft_innovation|commander|starter|funny|duel_deck|planechase|archenemy|from_the_vault|spellbook|premium_deck|box)$/;
function renderSets(){
  const u = S.ui, by = new Map();
  for(const a of ownedById().values()){
    let x = by.get(a.c.s); if(!x){ x = {cns:new Set(), all:new Set(), value:0, q:0}; by.set(a.c.s, x); }
    x.all.add(a.c.n); x.value += a.value; x.q += a.q;
    const s = S.sets[a.c.s], base = s && (s.size || s.count);
    if(!base || cnNum(a.c.n) <= base) x.cns.add(a.c.n);
  }
  const q = ENGINE.norm(u.setQ || '');
  let sets = Object.values(S.sets).filter(s => (u.allSets ? MAIN_SET.test(s.type) || by.has(s.code) : by.has(s.code)) && (!q || ENGINE.norm(s.name + ' ' + s.code).includes(q)));
  sets.sort((a, b) => (b.release || '').localeCompare(a.release || ''));
  const more = sets.length > 160; sets = sets.slice(0, 160);
  const rows = sets.map(s => {
    const x = by.get(s.code) || {cns:new Set(), all:new Set(), value:0, q:0};
    const base = s.size || s.count || 1;
    const pct = Math.min(100, Math.round(x.cns.size / base * 100));
    return `<button class="deck-item" data-act="open-set" data-set="${esc(s.code)}">
      <div class="seticon-big">${setIcon(s.code)}</div>
      <div class="grow"><div class="row between"><b class="ell">${esc(s.name)}</b><span class="gold small">${x.q ? money(x.value) : ''}</span></div>
      <div class="muted tiny" style="margin:2px 0 7px">${esc(s.code.toUpperCase())}${s.release ? ' · ' + fmtDate(s.release) : ''} · ${x.cns.size}/${base}${x.all.size > x.cns.size ? ' · +' + (x.all.size - x.cns.size) + ' Sonderdrucke' : ''}</div>
      <div class="progress"><i style="width:${pct}%"></i></div></div><span class="muted small" style="width:38px;text-align:right">${pct}%</span></button>`;
  }).join('');
  view.innerHTML = `<div class="row">${backBtn()}<h1 class="grow">Sets</h1></div>
    <div class="seg"><button class="${!u.allSets?'on':''}" data-act="sets-mode" data-v="0">Meine Sets</button><button class="${u.allSets?'on':''}" data-act="sets-mode" data-v="1">Alle Sets</button></div>
    <div class="search">${ICON_SEARCH}<input id="setq" placeholder="Set suchen (Name oder Kürzel)" value="${esc(u.setQ || '')}"></div>
    ${rows || `<div class="empty">${u.allSets ? 'Kein Set gefunden.' : 'Noch keine Karten gescannt. Unter „Alle Sets“ findest du jedes Magic-Set.'}</div>`}
    ${more ? '<p class="tiny muted" style="text-align:center">Weitere Sets: Suche benutzen.</p>' : ''}`;
  const inp = $('#setq'); let t = null;
  inp.oninput = () => { clearTimeout(t); t = setTimeout(() => { S.ui.setQ = inp.value; const pos = inp.selectionStart; renderSets(); const n = $('#setq'); n.focus(); try{ n.setSelectionRange(pos, pos); }catch(e){} }, 250); };
}
A['sets-mode'] = el => { S.ui.allSets = el.dataset.v === '1'; renderSets(); };
A['open-set'] = el => { go({tab:'collection', mode:'all', set: el.dataset.set, sort:'number', q:'', cols:[], rarity:'', type:'', fmt:'', lang:'', foil:''}); };

/* =========================================================
   Kartendetail
   ========================================================= */
let detailState = {id:null, lang:null};
A.card = el => { const id = el.dataset.id; if(SEL && el.classList.contains('tile')){ selToggle(id, el); return; } openCard(id); };

/* ---------- Mehrfachauswahl in der Sammlung ---------- */
let SEL = null, GRID_IDS = [], lpTimer = null, lpFired = false;
function selBar(){
  let bar = $('#selbar');
  if(!SEL){ if(bar) bar.remove(); document.body.classList.remove('selecting'); $$('.tile.chosen').forEach(t => t.classList.remove('chosen')); return; }
  document.body.classList.add('selecting');
  if(!bar){ bar = document.createElement('div'); bar.id = 'selbar'; document.body.appendChild(bar); }
  const n = SEL.size, owned = S.ui.mode === 'owned';
  let copies = 0; for(const id of SEL) copies += ownedQty(id);
  bar.innerHTML = `<div class="row between" style="margin-bottom:8px"><b>${n} ausgewählt${copies ? ` <span class="tiny muted">(${copies} Exemplare)</span>` : ''}</b>
      <div class="row" style="gap:6px"><button class="chip" data-act="sel-all">Alle (${GRID_IDS.length})</button><button class="chip" data-act="sel-none">Keine</button><button class="chip" data-act="sel-end">✕</button></div></div>
    <div class="row" style="gap:8px">
      <button class="btn small grow" data-act="sel-deck" ${n ? '' : 'disabled'}>➕ Zu Deck</button>
      <button class="btn small ghost grow" data-act="sel-add" ${n ? '' : 'disabled'}>＋1 Stück</button>
      ${owned ? `<button class="btn small danger grow" data-act="sel-delete" ${n ? '' : 'disabled'}>🗑 Löschen</button>` : ''}</div>`;
}
function selStart(firstId){ SEL = new Set(firstId != null ? [firstId] : []); $$('#grid .tile').forEach(t => t.classList.toggle('chosen', SEL.has(t.dataset.id))); selBar(); }
function selToggle(id, el){ if(SEL.has(id)) SEL.delete(id); else SEL.add(id); if(el) el.classList.toggle('chosen', SEL.has(id)); selBar(); }
function selEnd(){ SEL = null; selBar(); }
A['sel-start'] = () => SEL ? selEnd() : selStart();
A['sel-end'] = selEnd;
A['sel-all'] = () => { GRID_IDS.forEach(id => SEL.add(id)); $$('#grid .tile').forEach(t => t.classList.add('chosen')); selBar(); };
A['sel-none'] = () => { SEL.clear(); $$('#grid .tile').forEach(t => t.classList.remove('chosen')); selBar(); };
A['sel-delete'] = async () => {
  const ids = [...SEL]; let copies = 0; for(const id of ids) copies += ownedQty(id);
  const how = await ask(`${ids.length} Karten löschen?`, `Du hast davon zusammen ${copies} Exemplare. Wie soll ich löschen? Tipp: Vorher wird automatisch ein Backup gespeichert.`,
    [{l:'Komplett entfernen', v:'all', c:'danger'}, {l:'Je 1 Exemplar weniger', v:'one', c:'ghost'}, {l:'Abbrechen', v:null, c:'ghost'}]);
  if(!how) return;
  try{ autoBackup(true); }catch(e){}
  let removed = 0;
  for(const id of ids){
    const keys = Object.keys(S.coll).filter(k => k.split('|')[0] === id);
    if(how === 'all'){ for(const k of keys){ removed += S.coll[k].q; delete S.coll[k]; } }
    else { const k = keys.sort((a, b) => (S.coll[a].t || 0) - (S.coll[b].t || 0)).pop(); if(k){ addCard(id, k.split('|')[1], k.split('|')[2] === '1', -1); removed++; } }
  }
  persist(); selEnd(); renderCollection(); toast(`${removed} Exemplare entfernt`);
};
A['sel-add'] = async () => {
  const lang = await ask('Zur Sammlung hinzufügen', `Je 1 Exemplar von ${SEL.size} Karten hinzufügen. Welche Sprache?`, [{l:'Deutsch', v:'de'}, {l:'Englisch', v:'en'}, {l:'Abbrechen', v:null, c:'ghost'}]);
  if(!lang) return;
  for(const id of SEL) addCard(id, lang, false, 1);
  const n = SEL.size; selEnd(); renderCollection(); toast(`${n} Karten hinzugefügt`);
};
A['sel-deck'] = () => {
  openSheet(`<h2>${SEL.size} Karten zu Deck hinzufügen</h2>
    <label class="lbl">Anzahl pro Karte</label><div class="seg" id="sd-n"><button class="on" data-act="sd-n" data-n="1">Je 1</button><button data-act="sd-n" data-n="own">So viele ich habe</button><button data-act="sd-n" data-n="4">Je 4</button></div>
    <div class="list">${S.decks.filter(d => !d.pool && !d.coop).map(d => `<button class="item" style="width:100%;text-align:left" data-act="sd-pick" data-id="${d.id}"><div class="deck-inks">${colDots(deckStats(d).cols)}</div><div class="grow"><b>${esc(d.name)}</b><div class="tiny muted">${FORMAT_DE[d.fmt] || ''} · ${deckStats(d).count} Karten</div></div><span class="muted">›</span></button>`).join('')}
      <button class="item" style="width:100%;text-align:left" data-act="sd-pick" data-id="new"><span style="font-size:20px">＋</span><div class="grow"><b>Neues Deck</b></div></button></div>`);
  window.__sdN = '1';
};
A['sd-n'] = el => { window.__sdN = el.dataset.n; $$('#sd-n button').forEach(b => b.classList.toggle('on', b === el)); };
A['sd-pick'] = async el => {
  let d;
  if(el.dataset.id === 'new'){ const name = await promptText('Neues Deck', '', 'Name des Decks'); if(!name) return; d = newDeck(name, 'commander'); }
  else d = S.decks.find(x => x.id === el.dataset.id);
  if(!d) return;
  const mode = window.__sdN; let n = 0;
  for(const id of SEL){
    const c = S.byId.get(id); if(!c) continue;
    const max = maxCopies(c.o, d.fmt);
    const want = mode === 'own' ? Math.min(max, Math.max(1, ownedQty(id))) : mode === '4' ? Math.min(4, max) : 1;
    const cur = deckCount(d, c.o), add = Math.max(0, Math.min(want, max - cur));
    if(add){ d.cards[id] = (d.cards[id] || 0) + add; n += add; }
  }
  closeSheet(); persist(); selEnd(); toast(`${n} Karten zu „${d.name}“ hinzugefügt`);
  go({tab:'decks', deck: d.id, assist:null});
};
document.addEventListener('pointerdown', e => {
  const t = e.target.closest('#grid .tile'); if(!t || SEL) return;
  lpFired = false; clearTimeout(lpTimer);
  lpTimer = setTimeout(() => { lpFired = true; if(NATIVE) NATIVE.vibrate(25); selStart(t.dataset.id); }, 480);
});
['pointerup', 'pointercancel', 'pointermove'].forEach(ev => document.addEventListener(ev, e => { if(ev === 'pointermove' && (Math.abs(e.movementX) + Math.abs(e.movementY)) < 3) return; clearTimeout(lpTimer); }));
document.addEventListener('click', e => { if(lpFired && e.target.closest('#grid .tile')){ e.stopPropagation(); e.preventDefault(); lpFired = false; } }, true);

function openCard(id, lang){
  const c = S.byId.get(id); if(!c) return;
  detailState = {id, lang: lang || detailState.lang || dl()};
  const L = detailState.lang, o = c.o;
  const prints = ENGINE.printings(c).filter(x => x.id !== c.id).sort(cmpNum);
  const cmUrl = `https://www.cardmarket.com/de/Magic/Products/Search?searchString=${encodeURIComponent(o.name.split(' // ')[0])}`;
  const edhUrl = `https://edhrec.com/cards/${edhSlug(o.name)}`;
  const hasDe = !!(o.de || c.de);
  const legal = LEGAL_FORMATS.map(f => `<span class="tag ${legalIn(o, f) ? 'ok' : 'no'}">${FORMAT_DE[f]}</span>`).join('');
  const s = S.sets[c.s] || {};
  openSheet(`
    ${hasDe ? `<div class="seg" style="max-width:220px;margin:0 auto 10px"><button class="${L==='de'?'on':''}" data-act="detail-lang" data-l="de">Deutsch</button><button class="${L==='en'?'on':''}" data-act="detail-lang" data-l="en">Englisch</button></div>` : ''}
    ${cardImg(c, L, 'large', 'class="detail-img"')}
    <h2 style="text-align:center;margin-bottom:2px">${esc(cName(c, L))} <span class="manacost">${manaHtml(o.mana)}</span></h2>
    ${L === 'de' && o.de ? `<div class="muted small" style="text-align:center">${esc(o.name)}</div>` : ''}
    <div class="muted" style="text-align:center">${esc(cType(c, L))}${o.pt ? ' · ' + esc(o.pt.replace(/^L/, 'Loyalität ').replace(/^D/, 'Verteidigung ')) : ''}</div>
    <div class="row wrap" style="justify-content:center;margin-top:8px;gap:6px">${colDots(colList(o))} <span class="tag" style="color:${RAR_COL[c.r]}">${esc(RAR_DE[c.r] || c.r)}</span> <span class="tag">${setIcon(c.s)} ${esc(s.name || c.s)} #${esc(c.n)}</span></div>
    ${o.txt ? `<h3>Kartentext</h3><div class="cardtext">${textHtml(o.txt)}</div>` : ''}
    <h3>Preise (Cardmarket-Trend)</h3>
    ${c.eur || c.eurf ? `<div class="prices"><div><span>Normal</span><b>${c.eur ? money(c.eur / 100) : '–'}</b></div><div><span>Foil</span><b>${c.eurf ? money(c.eurf / 100) : '–'}</b></div></div>`
      : `<div class="muted small">Für diesen Druck gibt es keinen Cardmarket-Preis.${cheapest(o) ? ' Günstigster Druck: ' + money(cheapest(o)) : ''}</div>`}
    <div class="row" style="gap:8px;margin-top:10px"><button class="btn ghost grow" data-act="open-url" data-url="${esc(cmUrl)}">Cardmarket ↗</button><button class="btn ghost grow" data-act="open-url" data-url="${esc(edhUrl)}">EDHREC ↗</button></div>
    ${canCommand(o) ? `<button class="btn block" style="margin-top:8px" data-act="as-cmd-from" data-id="${esc(c.id)}">✨ Commander-Deck mit dieser Karte bauen</button>` : ''}
    <h3>In deiner Sammlung</h3><div id="own-rows">${ownRows(c)}</div>${deckUse(c)}
    <h3>Formate</h3><div class="row wrap" style="gap:6px">${legal}</div>
    ${prints.length ? `<h3>Andere Drucke (${prints.length})</h3><div class="chips" style="flex-wrap:wrap">${prints.slice(0, 60).map(x => `<button class="chip" data-act="card" data-id="${esc(x.id)}">${setIcon(x.s)} ${esc(x.s.toUpperCase())} #${esc(x.n)} · ${money(priceEUR(x, false))}${ownedQty(x.id) ? ' · ✓' + ownedQty(x.id) : ''}</button>`).join('')}</div>` : ''}
  `);
}
function deckUse(c){
  const AL = syncAlloc(), k = gkey(c), hs = AL.holders.get(k) || [], own = AL.own.get(k) || 0, used = AL.used.get(k) || 0;
  if(!own && !hs.length) return '';
  return `<div class="tiny muted" style="margin-top:8px">${hs.length ? 'In Decks: ' + hs.map(h => `<b>${esc(h.d.name)}</b> ${h.n}×`).join(', ') + ' · ' : ''}frei: <b>${Math.max(0, own - used)}</b> (alle Drucke & Sprachen zusammen)</div>`;
}
function ownRows(c){
  const rows = [];
  for(const L of ['de','en']) for(const f of [0,1]) if(f === 0 ? (c.fin & 1) || qtyOf(c.id, L, 0) : (c.fin & 6) || qtyOf(c.id, L, 1)) rows.push([L, f]);
  for(const k of Object.keys(S.coll)){ const [id, L, f] = k.split('|'); if(id === c.id && !rows.some(r => r[0] === L && r[1] === +f)) rows.push([L, +f]); }
  return rows.map(([L, f]) => `<div class="own-row"><div class="grow">${langName(L)}${f ? ' · Foil' : ''}<div class="tiny muted">${money(priceEUR(c, !!f))} pro Karte</div></div>${stepper(`data-id="${esc(c.id)}" data-lang="${L}" data-foil="${f}"`, qtyOf(c.id, L, f))}</div>`).join('');
}
A['detail-lang'] = el => openCard(detailState.id, el.dataset.l);
A.own = el => {
  const id = el.dataset.id;
  addCard(id, el.dataset.lang, el.dataset.foil === '1', +el.dataset.d);
  const c = S.byId.get(id); const box = $('#own-rows'); if(box && c) box.innerHTML = ownRows(c);
  refreshBehindSheet();
};
function refreshBehindSheet(){ if(S.ui.tab === 'collection'){ renderGrid(); const h = $('.hero .big'); if(h) h.textContent = money(collectionStats().value); } else if(S.ui.tab === 'decks' && S.ui.deck) renderDeck(); else if(S.ui.tab === 'sets') renderSets(); }
A['open-url'] = el => { const u = el.dataset.url; if(NATIVE) NATIVE.openUrl(u); else window.open(u, '_blank'); };

/* =========================================================
   Suche (für Decks und manuelles Hinzufügen)
   ========================================================= */
let searchCb = null, searchFilter = null;
function openSearch(title, onPick, filter=null, hintHtml=''){
  searchCb = onPick; searchFilter = filter;
  openSheet(`<h2>${esc(title)}</h2>${hintHtml}<div class="search">${ICON_SEARCH}<input id="sq" placeholder="Kartenname (Deutsch oder Englisch) …"></div><div id="sres" class="list"></div>`);
  const q = $('#sq'); setTimeout(() => q.focus(), 250);
  let t = null; q.oninput = () => { clearTimeout(t); t = setTimeout(() => searchResults(q.value), 200); };
  searchResults('');
}
function searchResults(text){
  let res;
  const ob = ownedByOracle();
  if(ENGINE.norm(text)) res = searchOracle(text, searchFilter, 50);
  else res = [...ob.keys()].map(i => S.oracle[i]).filter(o => !searchFilter || searchFilter(o)).sort((a, b) => (a.edh || 1e6) - (b.edh || 1e6)).slice(0, 50);
  $('#sres').innerHTML = res.map(o => { const c = bestPrint(o); if(!c) return ''; return `<button class="item" style="width:100%;text-align:left" data-act="search-pick" data-o="${o.i}">
    ${cardImg(c, dl(), 'small', 'style="width:40px;height:56px;border-radius:5px;object-fit:cover;background:var(--surface2)"')}
    <div class="grow"><b class="ell" style="display:block">${esc(oName(o))} <span class="manacost sm">${manaHtml(o.mana)}</span></b><div class="tiny muted ell">${esc(dl() === 'de' && o.typeDe ? o.typeDe : o.type)}</div></div>
    <div style="text-align:right"><div class="gold small">${money(cheapest(o))}</div><div class="tiny muted">${ob.get(o.i) || 0}× im Besitz</div></div></button>`; }).join('')
    || `<div class="empty">${ENGINE.norm(text) ? 'Nichts gefunden.' : 'Tippe einen Namen ein.'}</div>`;
}
A['search-pick'] = el => { const o = S.oracle[+el.dataset.o]; if(o && searchCb) searchCb(o); };

/* =========================================================
   Decks
   ========================================================= */
/* ---------- Karten sind fest einem Deck zugeordnet ----------
   Jede Karte (alle Drucke/Sprachen zusammen) kann nur so oft in Decks liegen, wie du sie besitzt.
   Freie Karten werden Decks automatisch zugeordnet (ältere Decks zuerst). Aus einem anderen Deck
   holst du eine Karte nur bewusst – dann fehlt sie dort. Standardländer zählen nicht (davon hat man genug). */
function newDeck(name, fmt){ const d = {id:'d' + Date.now() + Math.floor(Math.random() * 1000), name, fmt: fmt || 'commander', cards:{}, side:{}, cmd:null, src:'manual', created: Date.now()}; S.decks.unshift(d); persist(); return d; }
function deckCount(d, o){ let n = 0; for(const [id, k] of Object.entries(d.cards)){ const c = S.byId.get(id); if(c && c.o === o) n += k; } return n; }
let ALLOC = null;
function deckNeeds(d){ const m = new Map(); for(const [id, n] of Object.entries(d.cards || {})){ const c = S.byId.get(id); if(!c || isBasic(c.o)) continue; const k = gkey(c); m.set(k, (m.get(k) || 0) + n); } return m; }
function ownedByKey(){ const m = new Map(); for(const e of entries()){ const k = gkey(e.c); m.set(k, (m.get(k) || 0) + e.q); } return m; }
/* Zuordnung Karte → Deck. Bundle-Decks (d.pool) nutzen nur die Karten ihres Bundles, alle anderen die Sammlung. */
function allocGroup(decks, own, needs){
  const used = new Map(), free = k => Math.max(0, (own.get(k) || 0) - (used.get(k) || 0));
  for(const d of decks){
    const al = d.alloc || (d.alloc = {}), need = needs.get(d.id);
    for(const k of Object.keys(al)){ const n = Math.min(al[k], need.get(k) || 0, free(k)); if(n > 0){ al[k] = n; used.set(k, (used.get(k) || 0) + n); } else delete al[k]; }
  }
  for(const d of decks){
    const al = d.alloc;
    for(const [k, n] of needs.get(d.id)){ const have = al[k] || 0; if(have >= n) continue; const add = Math.min(n - have, free(k)); if(add > 0){ al[k] = have + add; used.set(k, (used.get(k) || 0) + add); } }
  }
  const holders = new Map();
  for(const d of decks) for(const [k, n] of Object.entries(d.alloc)){ if(!holders.has(k)) holders.set(k, []); holders.get(k).push({d, n}); }
  return {own, used, holders};
}
function bundleByKey(b){ const m = new Map(); for(const e of bundleEntries(b)){ const k = gkey(e.c); m.set(k, (m.get(k) || 0) + e.q); } return m; }
function syncAlloc(){
  const before = JSON.stringify(S.decks.map(d => d.alloc || {}));
  const decks = [...S.decks].sort((a, b) => (a.created || 0) - (b.created || 0));
  const needs = new Map(decks.map(d => [d.id, deckNeeds(d)]));
  const pools = new Map();
  const poolKey = d => d.pool && bundleById(d.pool) ? d.pool : d.coop && partnerById(d.coop) ? 'coop:' + d.coop + ':' + d.who : '';
  for(const d of decks){ const p = poolKey(d); if(!pools.has(p)) pools.set(p, []); pools.get(p).push(d); }
  const groups = new Map([['', allocGroup(pools.get('') || [], ownedByKey(), needs)]]);
  for(const [p, ds] of pools) if(p) groups.set(p, allocGroup(ds, p.startsWith('coop:') ? (p.endsWith(':me') ? ownedByKey() : partnerByKey(partnerById(p.split(':')[1]))) : bundleByKey(bundleById(p)), needs));
  const main = groups.get('');
  ALLOC = {own: main.own, used: main.used, holders: main.holders, needs, groups, G: d => groups.get(d && groups.has(poolKey(d)) ? poolKey(d) : '')};
  if(JSON.stringify(S.decks.map(d => d.alloc || {})) !== before) persist();
  return ALLOC;
}
function deckStats(d){
  const AL = ALLOC || syncAlloc();
  let count = 0, value = 0, lands = 0; const cols = new Set(); const curve = Array(8).fill(0); const types = {};
  for(const [id, n] of Object.entries(d.cards)){
    const c = S.byId.get(id); if(!c) continue;
    count += n; colList(c.o).forEach(k => cols.add(k));
    value += (priceEUR(c, false) || 0) * n;
    const t = mainType(c.o); types[t] = (types[t] || 0) + n;
    if(t === 'Land') lands += n; else curve[Math.min(7, Math.floor(c.o.cmc || 0))] += n;
  }
  const cmd = d.cmd && S.byId.get(d.cmd);
  const colsArr = cmd ? ciList(cmd.o) : COLOR_KEYS.filter(k => cols.has(k));
  let missing = 0, inOther = 0, buy = 0, missingValue = 0;
  const need = AL.needs.get(d.id) || deckNeeds(d);
  for(const [k, n] of need){
    const a = (d.alloc && d.alloc[k]) || 0; if(a >= n) continue;
    missing += n - a;
    const notOwned = Math.max(0, n - (AL.G(d).own.get(k) || 0));
    buy += notOwned; inOther += n - a - notOwned;
  }
  for(const [id, n] of Object.entries(d.cards)){ const c = S.byId.get(id); if(!c || isBasic(c.o)) continue; const k = gkey(c); const notOwned = Math.max(0, (need.get(k) || 0) - (AL.G(d).own.get(k) || 0)); if(notOwned) missingValue += (priceEUR(c, false) || cheapest(c.o) || 0) * Math.min(n, notOwned); }
  return {count, value, missing, inOther, buy, missingValue, lands, cols: colsArr, curve, types};
}
function deckWarnings(d, st){
  const w = [], fmt = d.fmt, cmd = d.cmd && S.byId.get(d.cmd);
  const isCmd = fmt === 'commander' || fmt === 'brawl';
  const target = fmt === 'commander' ? 100 : fmt === 'limited' ? 40 : 60;
  if(isCmd){
    if(!cmd) w.push('Noch kein Commander festgelegt (Menü ⋯)');
    if(st.count < target) w.push(`Noch ${target - st.count} Karten bis ${target} – so ist das Deck nicht spielbar`);
    else if(st.count > target) w.push(`${st.count} von ${target} Karten – zu viele`);
  } else if(st.count < target) w.push(`Noch ${target - st.count} Karten bis ${target} – so ist das Deck nicht spielbar`);
  const ci = cmd ? new Set(ciList(cmd.o)) : null;
  const per = new Map();
  for(const [id, n] of Object.entries(d.cards)){ const c = S.byId.get(id); if(c) per.set(c.o, (per.get(c.o) || 0) + n); }
  let illegal = 0, offColor = 0;
  for(const [o, n] of per){
    const max = maxCopies(o, fmt);
    if(n > max) w.push(`${oName(o)}: höchstens ${max}×`);
    if(!legalIn(o, fmt)) illegal++;
    if(ci && !ciList(o).every(k => ci.has(k))) offColor++;
  }
  if(illegal && !d.casual) w.push(`${illegal} Karte(n) in ${FORMAT_DE[fmt]} nicht erlaubt`);
  if(offColor) w.push(`${offColor} Karte(n) passen nicht zur Farbidentität des Commanders`);
  return w;
}
const TIER_COL = {S:'#F5D58E', A:'#3CCB7F', B:'#3A8FD9', C:'#9A9CB8', D:'#FF6B6B'};
function tierBadge(r){ return r ? `<div style="text-align:center;min-width:44px"><div style="font-weight:800;font-size:20px;color:${TIER_COL[r.tier]}">${r.tier}</div><div class="tiny muted">${r.score}</div></div>` : '<div style="min-width:44px"></div>'; }
function renderDecks(){
  syncAlloc();
  const rated = S.decks.filter(d => !d.pool && !d.coop).map(d => ({d, r: window.ASSIST ? ASSIST.rateDeck(d) : null})).sort((a, b) => (b.r ? b.r.score : -1) - (a.r ? a.r.score : -1));
  const list = rated.map(({d, r}, i) => { const st = deckStats(d); return `<button class="deck-item" data-act="deck-open" data-id="${d.id}">
      ${tierBadge(r)}
      <div class="deck-inks">${colDots(st.cols)}</div>
      <div class="grow"><b class="ell" style="display:block">${esc(d.name)}</b>
      <div class="tiny muted">${esc(FORMAT_DE[d.fmt] || d.fmt)} · ${st.count} Karten${d.src === 'prebuilt' ? ' · Fertigdeck' : ''}</div>
      ${r && r.arche ? `<div class="tiny muted ell">≈ Meta: ${esc(r.arche.name)}${r.arche.share ? ` (${r.arche.share}%)` : ''}</div>` : ''}
      ${st.missing ? `<div class="miss">${st.missing} fehlen${st.inOther ? ` · ${st.inOther} in anderen Decks` : ''}${st.buy ? ` · ${st.buy} nicht im Besitz` : ''}</div>` : st.count ? '<div class="tiny" style="color:var(--good)">✓ Spielbereit</div>' : ''}</div>
      <div style="text-align:right"><div class="gold small">${money(st.value)}</div>${r ? `<div class="tiny muted">#${i + 1}</div>` : ''}</div></button>`; }).join('');
  view.innerHTML = `<div class="row">${backBtn()}<h1 class="grow">Decks</h1></div>
    <button class="deck-item assist-cta" data-act="assist-open"><span style="font-size:26px">✨</span><div class="grow"><b style="display:block">Deckbuilder</b><span class="tiny muted">Empfehlungen aus deinen Karten – nach Stärke, Stufe oder Spielstil – oder selbst bauen</span></div><span class="muted">›</span></button>
    <div class="row" style="gap:8px;margin-bottom:14px"><button class="btn grow" data-act="prebuilt">🛍️ Fertigdeck gekauft</button><button class="btn ghost" data-act="deck-new">+ Neu</button></div>
    ${list ? `<div class="row between" style="margin:4px 0 8px"><b>Ranking deiner Decks</b><button class="chip" data-act="rank-info">?</button></div>` + list : `<div class="empty"><div class="icon">🃏</div><b>Noch keine Decks</b><p>Hast du ein Commander- oder Starterdeck gekauft? Tipp auf <b>Fertigdeck gekauft</b> – alle Karten landen sofort in deiner Sammlung.</p></div>`}
    <button class="btn ghost block" data-act="deck-import" style="margin-top:6px">Deckliste einfügen (Text, Moxfield, Arena …)</button>`;
}
A['deck-open'] = el => { const d = S.decks.find(x => x.id === el.dataset.id); go({tab: d && d.pool ? 'bundles' : d && d.coop ? 'coop' : 'decks', duel:false, deck: el.dataset.id, assist:null, pick:false}); };
A['deck-back'] = () => { if(!goBack()){ S.ui.deck = null; render(); } };
function fmtButtons(){ return LEGAL_FORMATS.filter(f => f !== 'vintage').map(f => ({l:FORMAT_DE[f], v:f, c:'ghost'})); }
A['deck-new'] = async () => {
  const name = await promptText('Neues Deck', '', 'z. B. Golgari Midrange'); if(!name) return;
  const fmt = await ask('Welches Format?', '', fmtButtons()) || 'commander';
  const d = newDeck(name, fmt); go({deck: d.id});
};
function currentDeck(){ return S.decks.find(d => d.id === S.ui.deck); }
const GROUP_ORDER = ['Creature','Planeswalker','Instant','Sorcery','Artifact','Enchantment','Battle','Other','Land'];
const GROUP_DE = {Creature:'Kreaturen', Planeswalker:'Planeswalker', Instant:'Spontanzauber', Sorcery:'Hexereien', Artifact:'Artefakte', Enchantment:'Verzauberungen', Battle:'Schlachten', Other:'Sonstiges', Land:'Länder'};
function renderDeck(){
  const d = currentDeck(); if(!d){ S.ui.deck = null; return renderDecks(); }
  syncAlloc();
  const st = deckStats(d); const maxC = Math.max(1, ...st.curve);
  const cards = Object.entries(d.cards).map(([id, n]) => ({c: S.byId.get(id), n, id})).filter(x => x.c)
    .sort((a, b) => (a.c.o.cmc - b.c.o.cmc) || cName(a.c).localeCompare(cName(b.c), 'de'));
  const groups = {};
  for(const x of cards){ const g = x.id === d.cmd ? 'Commander' : mainType(x.c.o); (groups[g] = groups[g] || []).push(x); }
  const order = ['Commander', ...GROUP_ORDER].filter(g => groups[g]);
  const warn = deckWarnings(d, st);
  const r = window.ASSIST ? ASSIST.rateDeck(d) : null;
  const side = Object.entries(d.side || {}).map(([id, n]) => ({c: S.byId.get(id), n})).filter(x => x.c);
  view.innerHTML = `
    <div class="row" style="margin-bottom:8px"><button class="round" style="background:var(--surface2)" data-act="deck-back">‹</button><h1 class="grow ell" style="margin:0">${esc(d.name)}</h1><button class="chip" data-act="deck-rename">✎</button></div>
    <div class="hero"><div class="row between"><div><div class="lbl">${esc(FORMAT_DE[d.fmt] || d.fmt)} · Deckwert</div><div class="big">${money(st.value)}</div></div><div class="deck-inks" style="flex-direction:row">${colDots(st.cols)}</div></div>
      <div class="stats"><div><b>${st.count}</b>Karten</div><div><b>${st.lands}</b>Länder</div><div><b style="color:${st.missing ? 'var(--bad)' : 'var(--good)'}">${st.missing}</b>fehlen</div></div>
      ${st.missing ? `<div class="tiny" style="color:#ffc9c9;margin-top:8px">${st.inOther ? `${st.inOther} stecken in anderen Decks` : ''}${st.inOther && st.buy ? ' · ' : ''}${st.buy ? `${st.buy} hast du nicht (ca. ${money(st.missingValue)})` : ''}</div>` : st.count ? `<div class="tiny" style="color:#9fe3bf;margin-top:8px">✓ Spielbereit – alle Karten liegen in diesem Deck</div>` : ''}</div>
    ${r ? `<div class="card row" style="margin-bottom:12px">${tierBadge(r)}<div class="grow"><b>Einschätzung: Stufe ${r.tier}</b>
      <div class="tiny muted">${r.arche ? `Ähnelt <b>${esc(r.arche.name)}</b>${r.arche.share ? ` – ${r.arche.share}% der Turnierdecks` : ''}` : r.note || 'Kein bekannter Meta-Archetyp – eher ein eigenes Deck'}</div>
      <div class="tiny muted">Kartenstärke ${Math.round(r.quality * 100)}/100${r.metaDate ? ' · Meta-Stand ' + fmtDate(r.metaDate) : ''}</div></div></div>` : ''}
    ${d.coop && partnerById(d.coop) ? `<div class="card small" style="margin-bottom:12px">🤝 Koop-Deck ${d.who === 'me' ? 'für dich' : 'von <b>' + esc(partnerById(d.coop).name) + '</b>'} – „${esc(d.duelName || '')}“${d.who === 'them' ? '. „Fehlt“ heißt hier: nicht in der Sammlung von ' + esc(partnerById(d.coop).name) + '.' : ''}</div>` : ''}
    ${d.casual ? '<div class="tiny muted" style="margin:-4px 0 10px">🎲 Casual-Deck: Format-Verbote werden nicht geprüft</div>' : ''}
    ${d.pool && bundleById(d.pool) ? `<div class="card small" style="margin-bottom:12px">🎁 Deck aus dem Bundle <b>${esc(bundleById(d.pool).name)}</b> – „fehlt“ heißt: nicht im Bundle.</div>` : ''}
    ${warn.length ? `<div class="warn" style="margin-bottom:12px">${warn.map(esc).join('<br>')}</div>` : ''}
    ${window.ASSIST && cards.length ? `<details class="guide-box"><summary>📖 So spielst du dieses Deck</summary>${ASSIST.guide(d)}</details>` : ''}
    <div class="card"><b class="small">Manakurve (ohne Länder)</b><div class="curve">${st.curve.map((n, i) => `<div><span>${n || ''}</span><i style="height:${Math.round(n / maxC * 56)}px"></i>${i === 7 ? '7+' : i}</div>`).join('')}</div></div>
    <div class="row" style="gap:8px;margin:12px 0"><button class="btn grow" data-act="deck-pick">🧺 Zusammensuchen</button><button class="btn ghost" data-act="deck-add">+ Karten</button>${window.ASSIST ? '<button class="btn ghost" data-act="deck-improve">✨</button>' : ''}<button class="btn ghost" data-act="deck-menu">⋯</button></div>
    ${order.map(g => { const xs = groups[g]; return `<h3>${esc(g === 'Commander' ? 'Commander' : GROUP_DE[g])} <span class="muted">(${xs.reduce((s, x) => s + x.n, 0)})</span></h3>` + xs.map(x => {
      const basic = isBasic(x.c.o);
      const k = gkey(x.c), need = basic ? 0 : (ALLOC.needs.get(d.id).get(k) || x.n), a = (d.alloc && d.alloc[k]) || 0, miss = Math.max(0, need - a);
      const others = (ALLOC.G(d).holders.get(k) || []).filter(h => h.d.id !== d.id);
      const notOwned = Math.max(0, need - (ALLOC.G(d).own.get(k) || 0));
      const status = basic ? '<span class="muted">Standardland</span>' : !miss ? '<span style="color:var(--good)">✓ im Deck</span>'
        : `<span class="miss">${miss} fehlt</span>${notOwned ? ` <span class="tiny muted">· ${notOwned} nicht im Besitz (${money((priceEUR(x.c, false) || cheapest(x.c.o) || 0) * notOwned)})</span>` : ''}`
          + others.map(h => `<button class="chip mini" data-act="alloc-take" data-k="${esc(k)}" data-from="${h.d.id}">↩ aus „${esc(h.d.name)}“ holen (${h.n})</button>`).join('');
      return `<div class="deck-line" style="align-items:flex-start"><span class="cost">${manaHtml(x.c.o.mana) || '–'}</span>${cardImg(x.c, dl(), 'small', `data-act="card" data-id="${esc(x.c.id)}"`)}
        <div class="grow"><div class="ell" data-act="card" data-id="${esc(x.c.id)}"><b>${esc(cName(x.c))}</b></div><div class="tiny" style="display:flex;flex-wrap:wrap;gap:4px 8px;align-items:center;margin-top:2px">${status}</div></div>
        <div class="stepper"><button data-act="deck-step" data-id="${esc(x.c.id)}" data-d="-1">−</button><b>${x.n}</b><button data-act="deck-step" data-id="${esc(x.c.id)}" data-d="1">+</button></div></div>`; }).join(''); }).join('')
      || `<div class="empty">Noch keine Karten im Deck.</div>`}
    ${side.length ? `<h3>Sideboard <span class="muted">(${side.reduce((s, x) => s + x.n, 0)})</span></h3>` + side.map(x => `<div class="deck-line"><b style="width:26px">${x.n}×</b>${cardImg(x.c, dl(), 'small', `data-act="card" data-id="${esc(x.c.id)}"`)}<div class="grow ell">${esc(cName(x.c))}</div><span class="gold small">${money(priceEUR(x.c, false))}</span></div>`).join('') : ''}`;
}
A['rank-info'] = () => openSheet(`<h2>So entsteht das Ranking</h2><p class="muted small">Jedes Deck bekommt eine Punktzahl von 0–100 und eine Stufe (S, A, B, C, D):</p>
  <div class="list small"><div class="item">🃏 <div class="grow"><b>Kartenstärke</b><br><span class="muted">Wie oft die Karten gespielt werden (EDHREC-Beliebtheit) und wie oft sie in aktuellen Turnierdecks auftauchen</span></div></div>
  <div class="item">🏆 <div class="grow"><b>Meta</b><br><span class="muted">Turnierformate: Ähnlichkeit zu einem aktuellen Top-Deck (MTGGoldfish). Commander: wie viele der empfohlenen Karten für deinen Commander drin sind (EDHREC)</span></div></div>
  <div class="item">⚠️ <div class="grow"><b>Abzüge</b><br><span class="muted">Falsche Deckgröße, nicht erlaubte Karten, falsche Farbidentität</span></div></div></div>
  <p class="tiny muted">Das ist eine Einschätzung – echte Turnierergebnisse hängen auch vom Spielen ab 😉</p><div class="actions"><button class="btn" data-act="sheet-close">Alles klar</button></div>`);
A['alloc-take'] = el => {
  const d = currentDeck(), from = S.decks.find(x => x.id === el.dataset.from), k = el.dataset.k; if(!d || !from) return;
  syncAlloc();
  const need = ALLOC.needs.get(d.id).get(k) || 0, have = d.alloc[k] || 0, can = Math.min(need - have, from.alloc[k] || 0);
  if(can <= 0) return;
  from.alloc[k] -= can; if(!from.alloc[k]) delete from.alloc[k];
  d.alloc[k] = have + can;
  persist(); syncAlloc(); renderDeck();
  toast(`${can}× ins Deck geholt – in „${from.name}“ fehlt sie jetzt`, 3500);
};
A['deck-step'] = el => { const d = currentDeck(); const id = el.dataset.id; d.cards[id] = (d.cards[id] || 0) + +el.dataset.d; if(d.cards[id] <= 0){ delete d.cards[id]; if(d.cmd === id) d.cmd = null; } persist(); renderDeck(); };
function deckFilter(d){
  const cmd = d.cmd && S.byId.get(d.cmd), st = deckStats(d);
  const ci = cmd ? new Set(ciList(cmd.o)) : null;
  return o => legalIn(o, d.fmt) && (!ci || ciList(o).every(k => ci.has(k)));
}
A['deck-add'] = () => {
  const d = currentDeck();
  openSearch('Karte zum Deck', o => {
    const c = bestPrint(o); if(!c) return;
    const max = maxCopies(o, d.fmt), cur = deckCount(d, o);
    if(cur >= max){ toast(`${oName(o)}: höchstens ${max}× in ${FORMAT_DE[d.fmt]}`); return; }
    d.cards[c.id] = (d.cards[c.id] || 0) + 1; persist(); toast(`${oName(o)} · jetzt ${cur + 1}× im Deck`); renderDeck();
  }, deckFilter(d), `<p class="tiny muted" style="margin-top:-6px">Nur Karten, die in ${esc(FORMAT_DE[d.fmt])} erlaubt sind${d.cmd ? ' und zur Farbidentität passen' : ''}.</p>`);
};
A['deck-rename'] = async () => { const d = currentDeck(); const n = await promptText('Deck umbenennen', d.name); if(n){ d.name = n; persist(); renderDeck(); } };
A['deck-menu'] = () => {
  const d = currentDeck();
  openSheet(`<h2>Deck</h2><div class="list">
    ${d.pool || (d.coop && d.who === 'me') ? `<button class="item" style="width:100%" data-act="deck-tonormal">🃏 Auch zu meinen Decks hinzufügen</button>` : ''}
    ${d.fmt === 'commander' || d.fmt === 'brawl' ? '<button class="item" style="width:100%" data-act="deck-cmd">👑 Commander festlegen</button>' : ''}
    <button class="item" style="width:100%" data-act="deck-fmt">🏷️ Format ändern (${esc(FORMAT_DE[d.fmt])})</button>
    <button class="item" style="width:100%" data-act="deck-copy">📋 Als Text kopieren (Moxfield/Arena)</button>
    <button class="item" style="width:100%" data-act="deck-missing">🛒 Fehlende Karten anzeigen</button>
    <button class="item" style="width:100%" data-act="deck-tocoll">➕ Alle Deckkarten zur Sammlung hinzufügen</button>
    <button class="item" style="width:100%;color:var(--bad)" data-act="deck-delete">🗑️ Deck löschen</button></div>`);
};
A['deck-cmd'] = () => {
  const d = currentDeck();
  openSearch('Commander wählen', o => {
    const c = bestPrint(o); if(!c) return;
    if(d.cmd && d.cmd !== c.id && d.cards[d.cmd]){ /* alter Commander bleibt als Karte drin */ }
    d.cmd = c.id; if(!deckCount(d, o)) d.cards[c.id] = 1; persist(); closeSheet(); renderDeck(); toast('Commander: ' + oName(o));
  }, o => canCommand(o));
};
A['deck-fmt'] = async () => { const d = currentDeck(); closeSheet(); const f = await ask('Format', '', fmtButtons()); if(f){ d.fmt = f; persist(); renderDeck(); } };
function deckText(d){
  const line = (id, n) => { const c = S.byId.get(id); return c ? `${n} ${c.o.name} (${c.s.toUpperCase()}) ${c.n}` : null; };
  const out = [];
  if(d.cmd && d.cards[d.cmd]) out.push('Commander', line(d.cmd, d.cards[d.cmd]), '', 'Deck');
  for(const [id, n] of Object.entries(d.cards)) if(id !== d.cmd) out.push(line(id, n));
  const side = Object.entries(d.side || {}); if(side.length){ out.push('', 'Sideboard'); for(const [id, n] of side) out.push(line(id, n)); }
  return out.filter(x => x != null).join('\n');
}
A['deck-copy'] = () => { const t = deckText(currentDeck()); if(NATIVE) NATIVE.copyText(t); else navigator.clipboard && navigator.clipboard.writeText(t); closeSheet(); toast('Deckliste kopiert'); };
A['deck-missing'] = () => {
  const d = currentDeck(); syncAlloc(); const rows = [];
  const own = ALLOC.G(d).own, need = ALLOC.needs.get(d.id) || new Map();
  for(const [id] of Object.entries(d.cards)){ const c = S.byId.get(id); if(!c || isBasic(c.o)) continue; const k = gkey(c); const miss = (need.get(k) || 0) - (own.get(k) || 0); if(miss > 0 && !rows.some(r => r.c.o === c.o)) rows.push({c, miss}); }
  const pr = r => priceEUR(r.c, false) || cheapest(r.c.o) || 0;
  rows.sort((a, b) => pr(b) * b.miss - pr(a) * a.miss);
  const tot = rows.reduce((s, r) => s + pr(r) * r.miss, 0);
  openSheet(`<h2>Fehlende Karten</h2><p class="muted small">Zusammen ca. <b class="gold">${money(tot)}</b> (Cardmarket-Trend, günstigster Druck wenn ohne Preis).</p>
    <div class="list">${rows.map(r => `<button class="item" style="width:100%;text-align:left" data-act="card" data-id="${esc(r.c.id)}"><b>${r.miss}×</b><div class="grow ell">${esc(cName(r.c))}</div><span class="gold small">${money(pr(r) * r.miss)}</span></button>`).join('') || '<div class="empty">Dir fehlt nichts 🎉</div>'}</div>
    ${rows.length ? `<button class="btn ghost block" style="margin-top:10px" data-act="copy-missing">📋 Liste für Cardmarket kopieren</button>` : ''}`);
  window.__missing = rows.map(r => `${r.miss} ${r.c.o.name}`).join('\n');
};
A['copy-missing'] = () => { const t = window.__missing || ''; if(NATIVE) NATIVE.copyText(t); else navigator.clipboard && navigator.clipboard.writeText(t); toast('Kopiert – auf Cardmarket unter „Wants“ → „Liste einfügen“'); };
A['deck-tocoll'] = async () => {
  const d = currentDeck(); closeSheet();
  const lang = await ask('Zur Sammlung hinzufügen', 'In welcher Sprache sind die Karten?', [{l:'Deutsch', v:'de'}, {l:'Englisch', v:'en'}, {l:'Abbrechen', v:null, c:'ghost'}]);
  if(!lang) return;
  let n = 0; for(const [id, k] of Object.entries(d.cards)){ addCard(id, lang, false, k); n += k; }
  toast(`${n} Karten zur Sammlung hinzugefügt`); renderDeck();
};
A['deck-delete'] = async () => {
  closeSheet(); const d = currentDeck();
  const ok = await ask('Deck löschen?', `„${esc(d.name)}“ wird gelöscht. Die Karten bleiben in deiner Sammlung.`, [{l:'Abbrechen', v:false, c:'ghost'}, {l:'Löschen', v:true, c:'danger'}]);
  if(ok){ S.decks = S.decks.filter(x => x.id !== d.id); S.ui.deck = null; persist(); render(); }
};
A['deck-import'] = () => {
  const opt = f => `<option value="${f}">${FORMAT_DE[f]}</option>`;
  openSheet(`<h2>Deckliste einfügen</h2><p class="muted small">Eine Karte pro Zeile, z. B. <code>4 Lightning Bolt</code> oder <code>1 Sol Ring (CMM) 400</code>. Funktioniert mit Listen aus Moxfield, Archidekt, MTG Arena, MTGGoldfish (Deutsch oder Englisch). „Commander“ und „Sideboard“ als Überschrift werden erkannt.</p>
    <input class="field" id="di-name" placeholder="Name des Decks"><div style="height:8px"></div>
    <select id="di-fmt"><option value="auto">Format automatisch erkennen</option>${LEGAL_FORMATS.map(opt).join('')}</select><div style="height:8px"></div>
    <textarea class="field" id="di-text" placeholder="Commander&#10;1 Atraxa, Praetors' Voice&#10;&#10;Deck&#10;1 Sol Ring&#10;…"></textarea>
    <label class="row small" style="margin-top:10px"><input type="checkbox" id="di-coll"> Karten auch zur Sammlung hinzufügen</label>
    <div class="actions"><button class="btn ghost" data-act="sheet-close">Abbrechen</button><button class="btn" data-act="deck-import-go">Importieren</button></div>`);
};
function importDeck(name, lines, fmt, toColl, src='import'){
  const main = lines.filter(x => x.sec !== 'side'), total = main.reduce((s, x) => s + x.n, 0);
  if(fmt === 'auto') fmt = lines.some(x => x.sec === 'cmd') || (total >= 98 && total <= 101) ? 'commander' : 'modern';
  const d = newDeck(name, fmt); d.src = src;
  for(const x of lines){
    const c = x.c || bestPrint(x.o); if(!c) continue;
    const box = x.sec === 'side' ? d.side : d.cards;
    box[c.id] = (box[c.id] || 0) + x.n;
    if(x.sec === 'cmd' && !d.cmd) d.cmd = c.id;
    if(toColl) addCard(c.id, toColl, !!x.foil, x.n);
  }
  if(!d.cmd && fmt === 'commander'){ const cand = main.find(x => x.n === 1 && canCommand(x.o)); if(cand && main.length > 30 && main[0] === cand){ const c = x => x.c || bestPrint(x.o); d.cmd = c(cand).id; } }
  persist();
  return d;
}
A['deck-import-go'] = async () => {
  const {ok, bad} = ENGINE.parseDecklist($('#di-text').value);
  if(!ok.length){ toast('Keine Karten erkannt'); return; }
  const name = $('#di-name').value.trim() || 'Importiertes Deck';
  const d = importDeck(name, ok, $('#di-fmt').value, $('#di-coll').checked ? S.settings.defaultLang : null);
  closeSheet();
  if(bad.length) await ask('Nicht alles erkannt', `${bad.length} Zeile(n) konnte ich keiner Karte zuordnen:<br><br>${bad.map(esc).join('<br>')}`, [{l:'OK', v:true}]);
  go({tab:'decks', deck: d.id, assist:null});
};

/* =========================================================
   Zusammensuchen: Deckkarten nach Farbe → Manawert → Typ, mit Abhaken und Fundort
   ========================================================= */
const PICK_TYPES = [['all','Alle'],['Creature','Kreaturen'],['Instant','Spontan'],['Sorcery','Hexereien'],['Artifact','Artefakte'],['Enchantment','Verzauberungen'],['Planeswalker','Planeswalker'],['Land','Länder']];
const PICK_TYPE_DE = {Creature:'Kreatur', Instant:'Spontanzauber', Sorcery:'Hexerei', Artifact:'Artefakt', Enchantment:'Verzauberung', Planeswalker:'Planeswalker', Battle:'Schlacht', Land:'Land', Other:'Sonstiges'};
let PICK_T = 'all', PICK_HIDE = false;
A['deck-pick'] = () => go({pick: true});
function pickGroup(o){
  if(isLand(o)) return 'L';
  const cl = colList(o);
  return cl.length === 1 ? cl[0] : cl.length > 1 ? 'M' : 'C';
}
const PICK_GROUPS = {W:'Weiß', U:'Blau', B:'Schwarz', R:'Rot', G:'Grün', M:'Mehrfarbig', C:'Farblos', L:'Länder'};
const PICK_ORDER = ['W','U','B','R','G','M','C','L'];
function pickOwnSource(d){
  if(d.pool && bundleById(d.pool)) return bundleEntries(bundleById(d.pool));
  if(d.coop && d.who === 'them' && partnerById(d.coop)) return partnerEntries(partnerById(d.coop));
  return entries();
}
function renderPick(){
  const d = currentDeck(); if(!d){ S.ui.pick = false; return render(); }
  const AL = syncAlloc(), GR = AL.G(d), picked = d.picked || (d.picked = {});
  const lines = new Map();
  for(const [id, n] of Object.entries(d.cards)){
    const c = S.byId.get(id); if(!c) continue;
    const k = gkey(c); const x = lines.get(k) || {k, c, n:0}; x.n += n; lines.set(k, x);
  }
  const own = new Map();
  for(const e of pickOwnSource(d)){ const k = gkey(e.c); if(!lines.has(k)) continue; if(!own.has(k)) own.set(k, []); own.get(k).push(e); }
  let total = 0, done = 0;
  for(const x of lines.values()){ total += x.n; done += Math.min(x.n, picked[x.k] || 0); }
  const groups = new Map();
  for(const x of lines.values()){
    if(PICK_T !== 'all' && mainType(x.c.o) !== PICK_T) continue;
    if(PICK_HIDE && (picked[x.k] || 0) >= x.n) continue;
    const g = pickGroup(x.c.o);
    if(!groups.has(g)) groups.set(g, []);
    groups.get(g).push(x);
  }
  const html = PICK_ORDER.filter(g => groups.has(g)).map(g => {
    const xs = groups.get(g).sort((a, b) => (a.c.o.cmc - b.c.o.cmc) || mainType(a.c.o).localeCompare(mainType(b.c.o)) || cName(a.c).localeCompare(cName(b.c), 'de'));
    const gn = xs.reduce((s2, x) => s2 + x.n, 0), gd = xs.reduce((s2, x) => s2 + Math.min(x.n, picked[x.k] || 0), 0);
    const dot = COLORS[g] ? colDots([g]) : g === 'M' ? colDots(['W','U','B','R','G']) : colDots([]);
    let lastCost = null;
    return `<div class="pick-ink"><div class="row between pick-ink-head"><div class="row" style="gap:8px">${dot}<b>${PICK_GROUPS[g]}</b></div><span class="tiny muted">${gd}/${gn} gefunden</span></div>
      ${xs.map(x => {
        const cost = g === 'L' ? null : Math.floor(x.c.o.cmc || 0);
        const head = g !== 'L' && cost !== lastCost ? `<div class="pick-cost">Manawert ${cost}</div>` : ''; lastCost = cost;
        const got = Math.min(x.n, picked[x.k] || 0), full = got >= x.n;
        const basic = isBasic(x.c.o);
        const a = (d.alloc && d.alloc[x.k]) || 0, others = (GR.holders.get(x.k) || []).filter(h => h.d.id !== d.id);
        const totalOwn = GR.own.get(x.k) || 0, used = GR.used.get(x.k) || 0, free = Math.max(0, totalOwn - used);
        const prints = (own.get(x.k) || []).sort((p, q) => q.q - p.q).map(e => `${esc(setName(e.c.s))} #${esc(e.c.n)} · ${e.lang.toUpperCase()}${e.foil ? ' ✦' : ''} ×${e.q}`).join('<br>');
        const where = [];
        if(basic) where.push('<span class="muted">Standardland</span>');
        else {
          if(a) where.push(`<span style="color:var(--good)">${a}× für dieses Deck</span>`);
          if(free) where.push(`${free}× frei`);
          for(const h of others) where.push(`<span class="gold">${h.n}× in „${esc(h.d.name)}“</span>`);
          if(x.n > totalOwn) where.push(`<span class="miss">${x.n - totalOwn}× ${d.pool ? 'nicht im Bundle' : d.coop && d.who === 'them' ? 'nicht bei ' + esc((partnerById(d.coop) || {}).name || '') : 'nicht im Besitz'}</span>`);
        }
        return head + `<div class="pick-line ${full ? 'done' : ''}">
          <button class="pick-box" data-act="pick-toggle" data-k="${esc(x.k)}">${full ? '✓' : got ? got : ''}</button>
          ${cardImg(x.c, dl(), 'small', `data-act="card" data-id="${esc(x.c.id)}"`)}
          <div class="grow" data-act="pick-toggle" data-k="${esc(x.k)}"><div class="ell"><b>${x.n}× ${esc(cName(x.c))}</b> <span class="manacost sm">${manaHtml(x.c.o.mana)}</span></div>
            <div class="tiny muted ell">${esc(PICK_TYPE_DE[mainType(x.c.o)] || '')}</div>
            <div class="tiny" style="margin-top:2px">${where.join(' · ')}</div>
            ${prints && !basic ? `<div class="tiny muted" style="margin-top:2px">${prints}</div>` : ''}</div>
          ${x.n > 1 && !full ? `<button class="chip mini" data-act="pick-one" data-k="${esc(x.k)}">+1</button>` : ''}</div>`;
      }).join('')}</div>`;
  }).join('');
  view.innerHTML = `<div class="row">${backBtn()}<h1 class="grow ell">🧺 ${esc(d.name)}</h1></div>
    <div class="card" style="margin-bottom:10px"><div class="row between"><b>${done}/${total} Karten zusammengesucht</b><button class="chip mini" data-act="pick-reset">Neu starten</button></div>
      <div class="progress" style="margin-top:8px"><i style="width:${total ? Math.round(done / total * 100) : 0}%"></i></div>
      <div class="tiny muted" style="margin-top:6px">Sortiert nach Farbe und Manawert. Tippe eine Karte an, wenn du sie gefunden hast. Darunter steht, welchen Druck du hast und ob sie gerade in einem anderen Deck steckt.</div></div>
    <div class="chips" style="margin-bottom:8px;flex-wrap:wrap">${PICK_TYPES.map(([k, l]) => `<button class="chip ${PICK_T === k ? 'on' : ''}" data-act="pick-type" data-t="${k}">${l}</button>`).join('')}</div>
    <label class="switch-row"><input type="checkbox" data-act="pick-hide" ${PICK_HIDE ? 'checked' : ''}><span class="switch"></span><span class="small">Gefundene ausblenden</span></label>
    ${html || `<div class="empty">${done >= total && total ? '🎉 Alles zusammengesucht!' : 'Keine Karten für diesen Filter.'}</div>`}
    ${done >= total && total ? `<div class="card" style="margin-top:12px;text-align:center">🎉 <b>Deck komplett!</b> Viel Spaß beim Spielen.</div>` : ''}`;
}
function pickNeed(d, k){ let n = 0; for(const [id, q] of Object.entries(d.cards)){ const c = S.byId.get(id); if(c && gkey(c) === k) n += q; } return n; }
function pickSet(k, v){ const d = currentDeck(); if(!d) return; d.picked = d.picked || {}; if(v > 0) d.picked[k] = v; else delete d.picked[k]; persist(); const y = window.scrollY; renderPick(); window.scrollTo(0, y); }
A['pick-toggle'] = el => { const d = currentDeck(), k = el.dataset.k; const need = pickNeed(d, k), got = (d.picked || {})[k] || 0; pickSet(k, got >= need ? 0 : need); };
A['pick-one'] = el => { const d = currentDeck(), k = el.dataset.k; const need = pickNeed(d, k), got = (d.picked || {})[k] || 0; pickSet(k, Math.min(need, got + 1)); };
A['pick-type'] = el => { PICK_T = el.dataset.t; renderPick(); };
A['pick-hide'] = () => { PICK_HIDE = !PICK_HIDE; renderPick(); };
A['pick-reset'] = async () => { const d = currentDeck(); const ok = await ask('Neu starten?', 'Alle Häkchen in dieser Liste werden entfernt.', [{l:'Abbrechen', v:false, c:'ghost'}, {l:'Neu starten', v:true}]); if(ok){ d.picked = {}; persist(); renderPick(); } };

/* Bundle- oder Koop-Deck als normales Deck (Karten aus der eigenen Sammlung) kopieren */
function copyToNormal(d){
  const n = {id:'d' + Date.now() + Math.floor(Math.random() * 1000), name: d.name, fmt: d.fmt === 'limited' ? 'casual' : d.fmt, cards: Object.assign({}, d.cards), side: Object.assign({}, d.side || {}), cmd: d.cmd || null, src:'copy', created: Date.now(), casual: !!d.casual};
  S.decks.unshift(n); persist(); return n;
}
A['deck-tonormal'] = () => {
  const d = currentDeck(); closeSheet(); if(!d) return;
  const n = copyToNormal(d);
  toast(`„${n.name}“ ist jetzt auch unter Decks – mit den Karten aus deiner Sammlung`, 3500);
  go({tab:'decks', bundle:null, partner:null, duel:false, assist:null, pick:false, deck: n.id});
};

/* ---------- Fertigdecks (Commander-, Starter-, Planeswalker-Decks …) ---------- */
const DECKTYPE_DE = {'Commander Deck':'Commander-Deck', 'Theme Deck':'Themendeck', 'Intro Pack':'Einführungspack', 'Planeswalker Deck':'Planeswalker-Deck', 'Welcome Deck':'Willkommensdeck',
  'Duel Deck':'Duell-Deck', 'Challenger Deck':'Herausforderer-Deck', 'Pioneer Challenger Deck':'Pioneer-Herausforderer-Deck', 'Starter Deck':'Starterdeck', 'Starter Kit':'Starter-Kit',
  'Event Deck':'Event-Deck', 'Enhanced Deck':'Erweitertes Deck', 'Game Night Deck':'Game-Night-Deck', 'Guild Kit':'Gilden-Kit', 'Clash Pack':'Clash-Pack', 'Planechase Deck':'Planechase-Deck',
  'Archenemy Deck':'Archenemy-Deck', 'Advanced Deck':'Fortgeschrittenen-Deck', "Deck Builder's Toolkit":'Deckbauer-Toolkit', 'Box Set':'Box-Set', 'Jumpstart':'Jumpstart-Booster',
  'Brawl Deck':'Brawl-Deck', 'Secret Lair Drop':'Secret-Lair-Drop', 'Starter Set':'Starter-Set', 'Premium Deck':'Premium-Deck',
  'Two-Player Starter Set':'Starter-Set für 2 Spieler', 'Commander Collection':'Commander-Kollektion'};
function deckTypeDe(t){ return dl() === 'de' ? (DECKTYPE_DE[t] || String(t).replace(/ Deck$/, '-Deck')) : t; }
let PB = {q:'', kind:'cmd'};
A.prebuilt = async () => {
  openSheet(`<div class="boot" style="min-height:200px"><div class="loader"></div>Lade Fertigdecks …</div>`);
  try{ await loadPrecons(); }catch(e){ openSheet(`<h2>Hat nicht geklappt</h2><p class="muted">Die Liste der Fertigdecks konnte nicht geladen werden. Bist du online?</p><div class="actions"><button class="btn" data-act="sheet-close">OK</button></div>`); return; }
  openSheet(`<h2>Welches Deck hast du gekauft?</h2><p class="muted small">Alle Karten werden automatisch hinzugefügt – kein Scannen nötig.</p>
    <div class="seg" id="pb-kind"><button data-act="pb-kind" data-k="cmd">Commander</button><button data-act="pb-kind" data-k="other">Starter & Co.</button><button data-act="pb-kind" data-k="all">Alle</button></div>
    <div class="search">${ICON_SEARCH}<input id="pb-q" placeholder="Deckname oder Set suchen" value="${esc(PB.q)}"></div><div id="pb-list" class="list"></div>`);
  const q = $('#pb-q'); let t = null; q.oninput = () => { clearTimeout(t); t = setTimeout(() => { PB.q = q.value; pbList(); }, 200); };
  pbList();
};
function pbList(){
  $$('#pb-kind button').forEach(b => b.classList.toggle('on', b.dataset.k === PB.kind));
  const q = ENGINE.norm(PB.q);
  const decks = S.precons.decks.map((d, i) => ({d, i})).filter(({d}) => (PB.kind === 'all' || (PB.kind === 'cmd') === /commander/i.test(d[3]))
    && (!q || ENGINE.norm(d[0] + ' ' + d[1] + ' ' + setName(d[1])).includes(q)));
  $('#pb-list').innerHTML = decks.slice(0, 80).map(({d, i}) => `<button class="item" style="width:100%;text-align:left" data-act="prebuilt-pick" data-i="${i}">
    <div class="seticon-big">${setIcon(d[1])}</div><div class="grow"><b style="display:block">${esc(d[0])}</b><span class="tiny muted">${esc(deckTypeDe(d[3]))} · ${esc(setName(d[1]))} · ${fmtDate(d[2])}</span></div><span class="muted">›</span></button>`).join('')
    + (decks.length > 80 ? `<p class="tiny muted" style="text-align:center">${decks.length - 80} weitere – Suche benutzen</p>` : '') || '<div class="empty">Kein Deck gefunden.</div>';
}
A['pb-kind'] = el => { PB.kind = el.dataset.k; pbList(); };
A['prebuilt-pick'] = el => {
  const deck = S.precons.decks[+el.dataset.i]; if(!deck) return;
  const [name, set, , type, rows] = deck;
  const items = []; let unknown = 0;
  for(const [k, n, fl] of rows){
    let c = k[0] === '?' ? null : S.byId.get(k);
    if(!c && k[0] === '?'){ const o = ENGINE.findByName(k.slice(1)); if(o) c = bestPrint(o); }
    if(!c){ unknown += n; continue; }
    const ex = items.find(x => x.c === c && x.foil === !!(fl & 1)); if(ex) ex.n += n; else items.push({c, n, foil: !!(fl & 1), cmd: !!(fl & 2)});
  }
  const total = items.reduce((s, x) => s + x.n, 0);
  const value = items.reduce((s, x) => s + (priceEUR(x.c, x.foil) || 0) * x.n, 0);
  window.__pb = {name, items, lang: S.settings.defaultLang, fmt: /commander/i.test(type) ? 'commander' : /brawl/i.test(type) ? 'brawl' : 'standard'};
  items.sort((a, b) => (b.cmd - a.cmd) || (priceEUR(b.c, b.foil) || 0) - (priceEUR(a.c, a.foil) || 0));
  openSheet(`<h2>${esc(name)}</h2><p class="muted small">${esc(deckTypeDe(type))} · ${esc(setName(set))} · ${total} Karten · Wert ca. <b class="gold">${money(value)}</b>${unknown ? ` · ${unknown} unbekannt` : ''}</p>
    <label class="lbl">Sprache der Karten</label><div class="seg" id="pb-lang"><button class="${S.settings.defaultLang==='de'?'on':''}" data-act="pb-lang" data-l="de">Deutsch</button><button class="${S.settings.defaultLang==='en'?'on':''}" data-act="pb-lang" data-l="en">Englisch</button></div>
    <label class="row small"><input type="checkbox" id="pb-deck" checked> Auch als Deck speichern</label>
    <div class="actions"><button class="btn ghost" data-act="prebuilt">‹ Zurück</button><button class="btn" data-act="pb-add">Hinzufügen</button></div>
    <h3>Inhalt</h3><div>${items.map(x => `<div class="deck-line"><b style="width:26px">${x.n}×</b>${cardImg(x.c, dl(), 'small')}<div class="grow ell">${x.cmd ? '👑 ' : ''}${esc(cName(x.c))}${x.foil ? ' <span class="tag">Foil</span>' : ''}</div><span class="gold small">${money(priceEUR(x.c, x.foil))}</span></div>`).join('')}</div>`);
};
A['pb-lang'] = el => { window.__pb.lang = el.dataset.l; $$('#pb-lang button').forEach(b => b.classList.toggle('on', b === el)); };
A['pb-add'] = () => {
  const pb = window.__pb; const asDeck = $('#pb-deck').checked;
  let n = 0; for(const x of pb.items){ addCard(x.c.id, pb.lang, x.foil, x.n); n += x.n; }
  if(asDeck){
    const d = newDeck(pb.name, pb.fmt); d.src = 'prebuilt';
    for(const x of pb.items){ d.cards[x.c.id] = (d.cards[x.c.id] || 0) + x.n; if(x.cmd && !d.cmd) d.cmd = x.c.id; }
  }
  persist(); closeSheet(); toast(`${n} Karten zur Sammlung hinzugefügt 🎉`); render();
};

/* =========================================================
   Mehr: Einstellungen & Daten
   ========================================================= */
function renderMore(){
  const s = S.settings, st = collectionStats();
  const sel = (id, opts, cur) => `<select data-set="${id}">${opts.map(([v, l]) => `<option value="${v}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  view.innerHTML = `<div class="row">${backBtn()}<h1 class="grow">Mehr</h1></div>
    <div class="card"><h3 style="margin-top:0">Anzeige</h3>
      <label class="lbl">Währung</label>${sel('currency', CURRENCIES.map(c => [c, c + (c !== 'EUR' && S.rates[c] ? ' (1 € = ' + S.rates[c].toFixed(c === 'JPY' || c === 'HUF' ? 0 : 3) + ')' : '')]), s.currency)}
      <label class="lbl">Kartennamen & Bilder</label>${sel('dispLang', [['de','Deutsch (wenn vorhanden)'],['en','Englisch']], s.dispLang)}</div>
    <div class="card" style="margin-top:12px"><h3 style="margin-top:0">Scanner</h3>
      <label class="lbl">Sprache gescannter Karten</label>${sel('scanLang', [['auto','Automatisch erkennen'],['de','Immer Deutsch'],['en','Immer Englisch']], s.scanLang)}
      <label class="lbl">Wenn nicht erkennbar</label>${sel('defaultLang', [['de','Deutsch annehmen'],['en','Englisch annehmen']], s.defaultLang)}
      <label class="lbl">Erkennung</label>${sel('confirm', [['1','Schnell (1 Bild)'],['2','Sicher (2 Bilder, empfohlen)'],['3','Sehr sicher (3 Bilder)']], s.confirm)}
      <label class="lbl">Ausrichtung der Karte zur Kamera</label>${sel('rotation', [['auto','Automatisch'],['0','0°'],['90','90°'],['180','180°'],['270','270°']], s.rotation)}
      <label class="lbl">Rückmeldung</label>${sel('feedback', [['both','Ton + Vibration'],['sound','Nur Ton'],['vib','Nur Vibration'],['none','Aus']], s.sound && s.vibrate ? 'both' : s.sound ? 'sound' : s.vibrate ? 'vib' : 'none')}</div>
    <button class="deck-item" style="margin-top:12px" data-act="meta-open"><span style="font-size:24px">🏆</span><div class="grow"><b style="display:block">Meta-Decks</b><span class="tiny muted">Was Turnierspieler gerade spielen und die beliebtesten Commander</span></div><span class="muted">›</span></button>
    <div class="card" style="margin-top:12px"><h3 style="margin-top:0">Daten</h3>
      <div class="list small">
        <div class="item"><div class="grow">Karten & Cardmarket-Preise<div class="tiny muted">${S.oracle.length.toLocaleString('de-DE')} Karten · ${S.cards.length.toLocaleString('de-DE')} Drucke · Preise vom ${fmtDate(S.priceDate)}</div></div><button class="btn small ghost" data-act="upd-cards">Aktualisieren</button></div>
        <div class="item"><div class="grow">Meta (Turniere & Commander)<div class="tiny muted">Stand ${fmtDate(S.meta && S.meta.date)}</div></div><button class="btn small ghost" data-act="upd-meta">Aktualisieren</button></div>
        <div class="item"><div class="grow">Wechselkurse (EZB)<div class="tiny muted">Stand ${fmtDate(S.ratesDate)}</div></div><button class="btn small ghost" data-act="upd-rates">Aktualisieren</button></div>
      </div></div>
    <div class="card" style="margin-top:12px"><h3 style="margin-top:0">Sammlung (${st.total} Karten)</h3>
      <div class="list">
        <button class="item" style="width:100%" data-act="csv-export">📤 Als CSV exportieren (Moxfield, Manabox …)</button>
        <button class="item" style="width:100%" data-act="csv-import">📥 CSV importieren (Moxfield, Manabox, Deckbox, Dragon Shield …)</button>
        <button class="item" style="width:100%" data-act="backup-now">💾 Backup jetzt speichern</button>
        <button class="item" style="width:100%" data-act="backup-import">♻️ Backup laden (wiederherstellen)</button>
        <button class="item" style="width:100%" data-act="safe-list">🛟 Sicherheitskopien (automatisch in der App)</button>
        <button class="item" style="width:100%;color:var(--bad)" data-act="coll-clear">🗑️ Sammlung leeren</button>
      </div>
      ${WEB ? `<p class="tiny muted">Deine Sammlung liegt nur in diesem Browser auf diesem Gerät. Speichere ab und zu ein Backup („Backup jetzt speichern“ → in „Dateien“ sichern) – damit kannst du alles wiederherstellen.${IOS ? ' <b>Wichtig auf dem iPhone:</b> Safari, Chrome, jedes In-App-Fenster (z. B. aus WhatsApp) und das Icon auf dem Home-Bildschirm haben jeweils einen eigenen Speicher – öffne Foxering immer auf demselben Weg und nie im privaten/Inkognito-Tab.' : ''} Letztes Backup: <b>${lastBackup() ? fmtDate(new Date(lastBackup()).toISOString()) : 'noch keins'}</b>.</p></div>` : `<label class="lbl">Automatisches Backup</label>${sel('autoBackup', [['on','An (empfohlen)'],['off','Aus']], s.autoBackup === 'off' ? 'off' : 'on')}
      <p class="tiny muted">Nach jeder Änderung speichert die App automatisch ein Backup in <b>Download/Foxering</b>: „foxering-backup-aktuell.json“ plus eins pro Wochentag. Die Dateien bleiben auch erhalten, wenn die App gelöscht wird. Letztes Backup: <b>${lastBackup() ? fmtDate(new Date(lastBackup()).toISOString()) : 'noch keins'}</b>.</p></div>`}
    <p class="tiny muted" style="margin-top:16px">Magic the Foxering ${NATIVE ? 'v' + esc(NATIVE.version()) : '(Browser)'} · Kartendaten, Bilder & Preise: Scryfall (Cardmarket-Trendpreise) · Fertigdecks: MTGJSON · Meta: MTGGoldfish & EDHREC · Kurse: EZB. Inoffizielle Fan-App. Magic: The Gathering ist eine Marke von Wizards of the Coast; Kartenbilder © Wizards of the Coast.</p>`;
  $$('select[data-set]', view).forEach(el => el.onchange = () => {
    const k = el.dataset.set, v = el.value;
    if(k === 'feedback'){ S.settings.sound = v === 'both' || v === 'sound'; S.settings.vibrate = v === 'both' || v === 'vib'; }
    else S.settings[k] = k === 'confirm' ? +v : v;
    persist(); toast('Gespeichert');
    if(k === 'dispLang' || k === 'currency') renderMore();
  });
}
async function runUpdate(fn, label){
  toast(label + ' wird aktualisiert …', 8000);
  try{ const r = await fn(); toast(r === 'same' ? label + ': schon aktuell ✓' : label + ' aktuell ✓'); }catch(e){ toast('Fehler: ' + e.message, 4000); }
  render();
}
A['upd-cards'] = () => runUpdate(() => updateData(false), 'Karten & Preise');
A['upd-rates'] = () => runUpdate(() => updateRates(), 'Wechselkurse');
A['upd-meta'] = () => runUpdate(() => updateMeta(), 'Meta');

function saveFile(name, mime, content){
  if(NATIVE){ const r = NATIVE.saveFile(name, mime, content); if(r.startsWith('ERR:')) toast('Fehler: ' + r.slice(4), 4000); else toast('Gespeichert in ' + r, 4000); return; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([content], {type:mime})); a.download = name; a.click();
}
function stamp(){ const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
function csvCell(v){ const s = String(v ?? ''); return /[",;\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; }
const LANG_CSV = {de:'German', en:'English', fr:'French', it:'Italian', es:'Spanish', pt:'Portuguese', ja:'Japanese', ko:'Korean', ru:'Russian', zhs:'Chinese Simplified', zht:'Chinese Traditional'};
A['csv-export'] = () => {
  const rows = [['Count','Name','Edition','Collector Number','Language','Foil','Condition','Rarity','Price EUR','Set Name','Name DE','Scryfall ID']];
  for(const e of entries().sort((a, b) => cmpNum(a.c, b.c)))
    rows.push([e.q, e.c.o.name, e.c.s, e.c.n, LANG_CSV[e.lang] || e.lang, e.foil ? 'foil' : '', 'Near Mint', RAR_DE[e.c.r], (priceEUR(e.c, e.foil) || 0).toFixed(2), setName(e.c.s), e.c.o.de, e.c.sid]);
  saveFile('foxering-sammlung-' + stamp() + '.csv', 'text/csv', rows.map(r => r.map(csvCell).join(',')).join('\n'));
};
function backupJSON(){ return JSON.stringify({app:'foxering', v:1, date:new Date().toISOString(), coll:S.coll, decks:S.decks, bundles:S.bundles, partners:S.partners, settings:S.settings}); }
A['backup-export'] = () => { saveFile('foxering-backup-' + stamp() + '.json', 'application/json', backupJSON()); try{ localStorage.setItem('mf-lastbackup', String(Date.now())); }catch(e){} if(S.tab === 'collection') render(); };

/* Hinweise oben in der Sammlung: Sicherheitskopie anbieten, wenn alles leer ist; im Browser ans Backup erinnern */
function safetyBanner(st){
  const o = S.ui.safeOffer;
  if(o && !st.total && !S.decks.length) return `<div class="card" style="margin:12px 0;border:1px solid var(--accent)"><b>🛟 Sicherheitskopie gefunden</b>
    <p class="small muted" style="margin:6px 0">Vom ${new Date(o.t).toLocaleString('de-DE', {dateStyle:'medium', timeStyle:'short'})} mit ${o.n} Einträgen. Hier ist gerade alles leer – soll ich sie wiederherstellen?</p>
    <div class="row" style="gap:8px"><button class="btn small" data-act="safe-restore" data-t="${o.t}">Wiederherstellen</button><button class="btn small ghost" data-act="safe-list">Alle Kopien</button><button class="btn small ghost" data-act="safe-dismiss">Nein</button></div></div>`;
  if(!WEB || st.total < 20) return '';
  const lb = lastBackup(), days = lb ? (Date.now() - lb) / 864e5 : 99;
  let snooze = 0; try{ snooze = +(localStorage.getItem('mf-bk-snooze') || 0); }catch(e){}
  if(days < 3 || Date.now() < snooze) return '';
  return `<div class="card" style="margin:12px 0;border:1px solid #E3B65C"><b>💾 Backup speichern</b>
    <p class="small muted" style="margin:6px 0">${lb ? `Dein letztes Backup ist ${Math.floor(days)} Tage alt.` : 'Du hast noch kein Backup.'} Im Browser liegt deine Sammlung nur auf diesem Gerät – und nur in genau diesem Browser${IOS ? ' (Safari, Chrome und das Icon auf dem Home-Bildschirm haben jeweils einen eigenen Speicher)' : ''}. Löscht der Browser seine Daten, ist sie weg.</p>
    <div class="row" style="gap:8px"><button class="btn small" data-act="backup-export">Backup jetzt speichern</button><button class="btn small ghost" data-act="bk-snooze">Später</button></div></div>`;
}
const IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
A['bk-snooze'] = () => { try{ localStorage.setItem('mf-bk-snooze', String(Date.now() + 864e5)); }catch(e){} render(); };
A['safe-dismiss'] = () => { S.ui.safeOffer = null; render(); };
async function restoreSafe(t){
  const x = (await safeList()).find(y => y.t === t); if(!x) { toast('Kopie nicht gefunden'); return; }
  let j; try{ j = JSON.parse(x.json); }catch(e){ toast('Kopie beschädigt'); return; }
  if(userSize(userData()) > 0) await safeAdd(JSON.stringify(userData()), userSize(userData()));
  S.coll = j.coll || {}; S.decks = j.decks || []; S.bundles = j.bundles || []; S.partners = j.partners || []; if(j.settings) Object.assign(S.settings, j.settings);
  S.ui.safeOffer = null; ALLOW_EMPTY = true; await saveNow(); toast('Sicherheitskopie wiederhergestellt ✓', 3000); render();
}
A['safe-restore'] = el => restoreSafe(+el.dataset.t);
A['safe-list'] = async () => {
  const list = await safeList();
  if(!list.length){ toast('Noch keine Sicherheitskopien'); return; }
  const v = await ask('Sicherheitskopien', 'Die App sichert deinen Stand automatisch (alle 10 Minuten bei Änderungen, je einer pro Tag). Welchen Stand möchtest du wiederherstellen? Der aktuelle Stand wird vorher selbst als Kopie gesichert.',
    [...list.map(x => ({l:`${new Date(x.t).toLocaleString('de-DE', {dateStyle:'short', timeStyle:'short'})} · ${x.n} Einträge`, v:x.t, c:'ghost'})), {l:'Abbrechen', v:null}]);
  if(v) restoreSafe(v);
};

/* Automatisches Backup: nach jeder Änderung (gebündelt) und beim Verlassen der App */
const WDAYS = ['So','Mo','Di','Mi','Do','Fr','Sa'];
let abTimer = null, abDirty = false;
function scheduleAutoBackup(){ abDirty = true; clearTimeout(abTimer); abTimer = setTimeout(autoBackup, 20000); }
window.scheduleAutoBackup = scheduleAutoBackup;
function lastBackup(){ try{ return +(localStorage.getItem('mf-lastbackup') || 0); }catch(e){ return 0; } }
function autoBackup(force){
  clearTimeout(abTimer);
  if(!abDirty && !force) return;
  if(!NATIVE || !NATIVE.saveFileReplace || S.settings.autoBackup === 'off') return;
  if(!Object.keys(S.coll).length && !S.decks.length && !S.bundles.length && !S.partners.length) return;
  abDirty = false;
  const json = backupJSON();
  const r = NATIVE.saveFileReplace('foxering-backup-aktuell.json', 'application/json', json);
  NATIVE.saveFileReplace('foxering-backup-' + WDAYS[new Date().getDay()] + '.json', 'application/json', json);
  if(!String(r).startsWith('ERR:')){ try{ localStorage.setItem('mf-lastbackup', String(Date.now())); }catch(e){} }
  return r;
}
A['backup-now'] = () => { abDirty = true; const r = autoBackup(true); if(!NATIVE){ A['backup-export'](); return; } if(!r){ toast('Nichts zu sichern – Sammlung ist leer'); return; } toast(String(r).startsWith('ERR:') ? 'Fehler: ' + r.slice(4) : 'Backup gespeichert in ' + r, 3500); renderMore(); };
function pickFile(accept){
  return new Promise(res => {
    const f = $('#file-in'); f.value = ''; f.accept = accept || '';
    f.onchange = () => { const file = f.files && f.files[0]; if(!file) return res(null); const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => res(null); r.readAsText(file); };
    f.click();
  });
}
A['backup-import'] = async () => {
  const t = await pickFile('.json,application/json'); if(!t) return;
  let j; try{ j = JSON.parse(t); }catch(e){ toast('Keine gültige Backup-Datei'); return; }
  if(j.app !== 'foxering' || !j.coll){ toast('Keine Foxering-Backup-Datei'); return; }
  const ok = await ask('Backup laden?', 'Deine aktuelle Sammlung und Decks werden durch das Backup ersetzt.', [{l:'Abbrechen', v:false, c:'ghost'}, {l:'Ersetzen', v:true}]);
  if(!ok) return;
  await safeAdd(JSON.stringify(userData()), userSize(userData()));
  S.coll = j.coll; S.decks = j.decks || []; S.bundles = j.bundles || []; S.partners = j.partners || []; if(j.settings) Object.assign(S.settings, j.settings);
  ALLOW_EMPTY = true; await saveNow(); toast('Backup geladen ✓'); render();
};
A['coll-clear'] = async () => {
  const ok = await ask('Sammlung leeren?', 'Alle Karten werden aus deiner Sammlung entfernt. Decks bleiben erhalten. Tipp: vorher ein Backup speichern.', [{l:'Abbrechen', v:false, c:'ghost'}, {l:'Leeren', v:true, c:'danger'}]);
  if(ok){ await safeAdd(JSON.stringify(userData()), userSize(userData())); S.coll = {}; ALLOW_EMPTY = true; await saveNow(); toast('Sammlung geleert – über Mehr → Sicherheitskopien wiederherstellbar', 3500); render(); }
};
/* Kartenliste aus einer Datei lesen: CSV von Moxfield, Manabox, Archidekt, Deckbox, Dragon Shield, Foxering & Co. –
   oder eine Textliste („4 Lightning Bolt“, „1 Sol Ring (CMM) 400 *F*“). Rückgabe: {out:[{c, lang, foil, n}], bad:[Zeilen]} */
function parseCardFile(t){
  const rows = ENGINE.parseCSV(t);
  const head = rows[0] || [];
  if(head.length < 2){
    const {ok, bad} = ENGINE.parseDecklist(t);
    return {out: ok.map(x => ({c: x.c || bestPrint(x.o), exact: !!x.c, lang: S.settings.defaultLang, foil: !!x.foil, n: x.n})).filter(x => x.c), bad};
  }
  const H = head.map(h => ENGINE.norm(h));
  const find = (...res) => { for(const re of res){ const i = H.findIndex(h => re.test(h)); if(i >= 0) return i; } return -1; };
  const iSid = find(/^SCRYFALL ID$/);
  const iSet = find(/^(SET CODE|EDITION CODE|SET|EXPANSION CODE|EDITION)$/, /^SET$/);
  const iSetName = find(/^(SET NAME|EDITION NAME|EXPANSION)$/);
  const iNum = find(/^(COLLECTOR NUMBER|CARD NUMBER|NUMBER|NR|NUMMER|CN)$/, /NUMBER/);
  const iFoilCount = find(/^FOIL (COUNT|QUANTITY|QTY|ANZAHL|AMOUNT)$/, /^(COUNT|QUANTITY|QTY|AMOUNT) FOIL$/);
  const iCount = find(/^(COUNT|QUANTITY|QTY|ANZAHL|AMOUNT|MENGE|OWNED|HAVE|TOTAL QTY)$/, /^(NORMAL|REGULAR|NON FOIL|NONFOIL)( COUNT| QUANTITY| QTY)?$/, /COUNT|QUANTITY|QTY/);
  const iFoil = find(/^(FOIL|PRINTING|FINISH|IS FOIL|AUSFUHRUNG|TREATMENT)$/);
  const iLang = find(/^(LANGUAGE|LANG|SPRACHE)$/);
  const iName = find(/^(NAME|CARD NAME|CARDNAME|CARD|KARTE|KARTENNAME|FULL NAME)$/, /NAME/);
  let sidMap = null;
  const setByName = new Map(Object.values(S.sets).map(s => [ENGINE.norm(s.name), s.code]));
  const out = [], bad = [];
  for(const r of rows.slice(1)){
    let c = null;
    if(iSid >= 0 && r[iSid]){ if(!sidMap) sidMap = new Map(S.cards.flatMap(x => x.de ? [[x.sid, x], [x.de, x]] : [[x.sid, x]])); c = sidMap.get(String(r[iSid]).trim()) || null; }
    if(!c && iNum >= 0){
      let setv = iSet >= 0 ? String(r[iSet] || '').trim().toLowerCase() : '';
      if(!S.sets[setv]){ const byN = setByName.get(ENGINE.norm(setv)) || (iSetName >= 0 ? setByName.get(ENGINE.norm(r[iSetName])) : null); if(byN) setv = byN; }
      const numv = String(r[iNum] || '').trim().replace(/^0+(?=\d)/, '');
      if(setv && numv) c = S.byId.get(setv + ':' + numv) || S.byId.get(setv + ':' + numv.toLowerCase()) || null;
    }
    const exact = !!c;
    if(!c && iName >= 0){ const o = ENGINE.findByName(r[iName]); if(o) c = bestPrint(o); }
    if(!c){ if(r.some(x => String(x).trim())) bad.push(r.join(', ')); continue; }
    const lv = iLang >= 0 ? ENGINE.norm(r[iLang]) : '';
    const lang = /^(DE|GER|DEUTSCH)/.test(lv) ? 'de' : /^(EN|ENG)/.test(lv) ? 'en' : /^(FR|FRE)/.test(lv) ? 'fr' : /^(IT|ITA)/.test(lv) ? 'it' : /^(ES|SPA)/.test(lv) ? 'es' : /^(JA|JP|JAP)/.test(lv) ? 'ja' : lv ? lv.toLowerCase().slice(0, 3) : S.settings.defaultLang;
    const cntRaw = iCount >= 0 ? parseInt(r[iCount], 10) : 1;
    const cnt = isNaN(cntRaw) ? (iCount >= 0 ? 0 : 1) : cntRaw;
    const vv = iFoil >= 0 ? ENGINE.norm(r[iFoil]) : '';
    const isFoil = !!vv && !/NON|NORMAL|REGULAR|FALSE|^NO$|NEIN|^0$/.test(vv) && /FOIL|ETCHED|TRUE|YES|JA|^1$/.test(vv);
    if(iFoilCount >= 0){
      const fc = parseInt(r[iFoilCount], 10) || 0;
      if(cnt > 0) out.push({c, exact, lang, foil:false, n:cnt});
      if(fc > 0) out.push({c, exact, lang, foil:true, n:fc});
    } else if(cnt > 0) out.push({c, exact, lang, foil:isFoil, n:cnt});
  }
  return {out, bad};
}
A['csv-import'] = async () => {
  const t = await pickFile('.csv,.txt,text/csv,text/plain'); if(!t) return;
  const {out, bad} = parseCardFile(t);
  if(!out.length){ toast('Keine Karten erkannt – Format unbekannt', 4000); return; }
  const total = out.reduce((s, x) => s + x.n, 0);
  const mode = await ask('CSV importieren', `${total} Karten erkannt${bad.length ? `, ${bad.length} Zeile(n) nicht zugeordnet` : ''}. Wie soll ich sie übernehmen?`,
    [{l:'Zur Sammlung hinzufügen', v:'add'}, {l:'Sammlung ersetzen', v:'replace', c:'ghost'}, {l:'Abbrechen', v:null, c:'ghost'}]);
  if(!mode) return;
  if(mode === 'replace'){ await safeAdd(JSON.stringify(userData()), userSize(userData())); S.coll = {}; }
  for(const x of out) addCard(x.c.id, x.lang, x.foil, x.n);
  await saveNow(); toast(`${total} Karten importiert ✓`, 3000); render();
};

/* =========================================================
   Scanner (freihändig)
   ========================================================= */
const ROTS = [0, 90, 270, 180];
const SC = {on:false, paused:false, stream:null, busy:false, state:'search', last:null, lastN:0, lockSig:null, lastAdded:null, emptyRun:0, sawEmpty:true,
  rot:0, goodRot:null, fail:0, session:[], torch:false, timer:null, target:null};
const vid = $('#vid');

/* Wohin gescannte Karten gehen: Sammlung (null) oder ein Bundle-Event */
function scanTarget(){ return SC.target ? bundleById(SC.target) : null; }
function putCard(item, n){ const b = item.target ? bundleById(item.target) : null; if(b) bundleAdd(b, item.c.id, item.lang, item.foil, n); else addCard(item.c.id, item.lang, item.foil, n); }
function scanPrefer(){ const b = scanTarget(); if(!b || !b.prod || !b.prod.set) return null; const code = b.prod.set; const set = new Set([code, ...Object.values(S.sets).filter(s => s.parent === code).map(s => s.code)]); set.main = code; return set; }
function scanStatus(t, cls){ $('#scan-status').textContent = t; const f = $('#frame'); f.classList.toggle('ok', cls === 'ok'); f.classList.toggle('read', cls === 'read'); }
function scanOptsUI(){
  const s = S.settings;
  $('#opt-lang').textContent = 'Sprache: ' + ({auto:'Auto', de:'Deutsch', en:'Englisch'})[s.scanLang];
  $('#opt-foil').textContent = s.foil ? '✦ Foil' : 'Normal';
  $('#opt-foil').classList.toggle('on', !!s.foil);
  $('#opt-rot').textContent = '↻ ' + (s.rotation === 'auto' ? 'Auto' + (SC.goodRot != null ? ' ' + SC.goodRot + '°' : '') : s.rotation + '°');
  $('#opt-pause').textContent = SC.paused ? '▶ Weiter' : '⏸ Pause';
  $('#opt-size').textContent = '▢ Rahmen ' + ({s:'klein', m:'mittel', l:'groß'})[s.frame || 'm'];
  $('#frame').className = 'frame size-' + (s.frame || 'm');
  $('#btn-torch').classList.toggle('on', SC.torch);
  const v = SC.session.reduce((sum, x) => sum + (priceEUR(x.c, x.foil) || 0), 0);
  const b = scanTarget();
  const pb = $('#btn-photo'); if(pb) pb.hidden = !!NATIVE;
  $('#scan-sum').textContent = (b ? '🎁 ' + b.name + ' · ' : '') + `${SC.session.length} ${SC.session.length === 1 ? 'Karte' : 'Karten'} · ${money(v)}`;
}
A['scan-open'] = () => startScan(null);
async function startScan(target){
  if(!S.cards.length){ toast('Kartendaten fehlen noch'); return; }
  if(SC.target !== target){ SC.session = []; SC.target = target; }
  $('#scan').hidden = false; SC.on = true; SC.paused = false; SC.state = 'search'; SC.last = null; SC.sawEmpty = true; SC.lastAdded = null;
  SC.rot = S.settings.rotation === 'auto' ? (SC.goodRot ?? 0) : +S.settings.rotation;
  scanOptsUI(); renderLast();
  scanStatus('Bereite Erkennung vor …');
  await sleep(30); ENGINE.build();
  try{
    if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Kamera-Zugriff wird von diesem Browser nicht unterstützt');
    SC.stream = await navigator.mediaDevices.getUserMedia({audio:false, video: NATIVE ? {facingMode:{ideal:'environment'}, width:{ideal:1920}, height:{ideal:1080}} : {facingMode:{ideal:'environment'}, width:{ideal:1280}, height:{ideal:720}}});
    vid.srcObject = SC.stream; await vid.play().catch(() => {});
    try{ const tr = SC.stream.getVideoTracks()[0]; const caps = tr.getCapabilities ? tr.getCapabilities() : {};
      if(caps.focusMode && caps.focusMode.includes('continuous')) await tr.applyConstraints({advanced:[{focusMode:'continuous'}]}); }catch(e){}
    if(NATIVE) NATIVE.keepAwake(true);
    if(!NATIVE){ scanStatus('Texterkennung wird geladen …'); try{ await webOcrWorker(); }catch(e){ scanStatus('Texterkennung nicht geladen – nutze 📸 Foto'); toast('Texterkennung konnte nicht geladen werden: ' + (e && e.message || e), 5000); return; } }
    scanStatus('Lege eine Karte unter die Kamera'); scanLoop();
  }catch(e){
    scanStatus(NATIVE ? 'Kamera nicht verfügbar' : 'Kamera nicht verfügbar – nutze 📸 Foto');
    toast(NATIVE ? 'Bitte erlaube den Kamerazugriff für Foxering' : 'Kamera: ' + (e && (e.name === 'NotAllowedError' ? 'Zugriff verweigert – in den iPhone-Einstellungen → Safari → Kamera erlauben' : e.message) || e), 6000);
  }
}
function stopScanner(){
  SC.on = false; clearTimeout(SC.timer);
  if(SC.stream){ SC.stream.getTracks().forEach(t => t.stop()); SC.stream = null; }
  vid.srcObject = null; SC.torch = false;
  if(NATIVE) NATIVE.keepAwake(false);
}
A['scan-close'] = () => { stopScanner(); $('#scan').hidden = true; if(SC.session.length) toast(`${SC.session.length} Karten gescannt` + (scanTarget() ? ' – im Bundle „' + scanTarget().name + '“' : '')); render(); };
A['scan-size'] = () => { const o = ['s','m','l']; S.settings.frame = o[(o.indexOf(S.settings.frame || 'm') + 1) % 3]; persist(); scanOptsUI(); SC.state = 'search'; SC.last = null; };
A['scan-pause'] = () => { SC.paused = !SC.paused; scanStatus(SC.paused ? 'Pausiert' : 'Lege eine Karte unter die Kamera'); scanOptsUI(); };
A['scan-foil'] = () => { S.settings.foil = !S.settings.foil; persist(); scanOptsUI(); };
A['scan-lang'] = () => { const o = ['auto','de','en']; S.settings.scanLang = o[(o.indexOf(S.settings.scanLang) + 1) % 3]; persist(); scanOptsUI(); };
A['scan-rot'] = () => { const o = ['auto','0','90','180','270']; S.settings.rotation = o[(o.indexOf(String(S.settings.rotation)) + 1) % o.length]; if(S.settings.rotation !== 'auto') SC.rot = +S.settings.rotation; persist(); scanOptsUI(); };
A['scan-torch'] = async () => {
  try{ const tr = SC.stream && SC.stream.getVideoTracks()[0]; if(!tr) return; SC.torch = !SC.torch; await tr.applyConstraints({advanced:[{torch:SC.torch}]}); }
  catch(e){ SC.torch = false; toast('Licht wird hier nicht unterstützt'); }
  scanOptsUI();
};

const OCRP = new Map(); let ocrSeq = 0;
window.__ocrDone = (id, json) => { const f = OCRP.get(id); if(!f) return; OCRP.delete(id); try{ f(JSON.parse(json)); }catch(e){ f({error:String(e)}); } };
function runOcr(dataUrl, rot){
  return new Promise(res => { const id = 'o' + (++ocrSeq); OCRP.set(id, res); NATIVE.ocr(id, dataUrl, rot);
    setTimeout(() => { if(OCRP.has(id)){ OCRP.delete(id); res({error:'timeout'}); } }, 9000); });
}
/* Texterkennung im Browser (iPhone): Tesseract.js, wird beim ersten Scan geladen */
let TESS = null;
function loadScript(src){ return new Promise((res, rej) => { const s = document.createElement('script'); s.src = src; s.onload = res; s.onerror = () => rej(new Error('Script')); document.head.appendChild(s); }); }
async function webOcrWorker(){
  if(TESS) return TESS;
  if(!window.Tesseract){ scanStatus('Lade Texterkennung …'); await loadScript('https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js'); }
  // Nur Englisch: Kartennamen werden ohnehin ohne Umlaute verglichen – spart Download und Speicher
  const w = await Tesseract.createWorker('eng', 1, {logger: m => {
    if(m && m.status && /loading|initializ/i.test(m.status) && !TESS) scanStatus('Texterkennung: ' + Math.round((m.progress || 0) * 100) + ' % (einmalig)');
  }});
  try{ await w.setParameters({tessedit_pageseg_mode: '11'}); }catch(e){}
  TESS = w;
  return TESS;
}
/* Bild für die Browser-Texterkennung vorbereiten: drehen, nur Namenszeile, Typzeile und Sammlernummer ausschneiden,
   vergrößern, Graustufen + Kontrast. Kleineres Bild = deutlich schneller auf dem iPhone. */
function webPrep(canvas, rot, full){
  let src = canvas;
  if(rot){
    const t = document.createElement('canvas'), sw = rot % 180 ? canvas.height : canvas.width, sh = rot % 180 ? canvas.width : canvas.height;
    t.width = sw; t.height = sh; const x = t.getContext('2d');
    x.translate(sw / 2, sh / 2); x.rotate(rot * Math.PI / 180); x.drawImage(canvas, -canvas.width / 2, -canvas.height / 2); src = t;
  }
  const W = src.width, H = src.height;
  // Magic: Name ganz oben (~0–14 %), Typzeile in der Mitte (~54–64 %), Sammlernummer + Set unten links (~88–100 %)
  const bands = full ? [[0, 1]] : [[0, 0.14], [0.54, 0.64], [0.88, 1]];
  const outW = Math.min(1000, Math.max(700, W * 1.4));
  const k = outW / W;
  const hs = bands.map(([a, b]) => Math.round((b - a) * H * k));
  const out = document.createElement('canvas'); out.width = Math.round(outW); out.height = hs.reduce((s2, h) => s2 + h + 12, 0);
  const o = out.getContext('2d', {willReadFrequently:true}); o.fillStyle = '#fff'; o.fillRect(0, 0, out.width, out.height);
  let y = 0;
  bands.forEach(([a, b], i) => { o.drawImage(src, 0, a * H, W, (b - a) * H, 0, y, out.width, hs[i]); y += hs[i] + 12; });
  try{
    const img = o.getImageData(0, 0, out.width, out.height), d = img.data;
    let lo = 255, hi = 0; const g = new Uint8ClampedArray(d.length / 4);
    for(let i = 0, j = 0; i < d.length; i += 4, j++){ const v = (d[i] * 3 + d[i+1] * 6 + d[i+2]) / 10; g[j] = v; if(v < lo) lo = v; if(v > hi) hi = v; }
    const span = Math.max(40, hi - lo);
    let sum = 0; for(let j = 0; j < g.length; j++) sum += g[j];
    const inv = sum / g.length < (lo + hi) / 2;   // überwiegend dunkel → umdrehen: Texterkennung mag dunkle Schrift auf hell
    for(let i = 0, j = 0; i < d.length; i += 4, j++){ let v = (g[j] - lo) * 255 / span; if(inv) v = 255 - v; d[i] = d[i+1] = d[i+2] = v; }
    o.putImageData(img, 0, 0);
  }catch(e){}
  return out;
}
async function webOcr(canvas, rot, full){
  const w = await webOcrWorker();
  const src = webPrep(canvas, rot, full);
  try{
    try{ await w.setParameters({tessedit_pageseg_mode: full ? '11' : '6'}); }catch(e){}
    const {data} = await w.recognize(src);
    let lines = (data.lines || []).map(l => ({t: String(l.text || '').trim(), y: l.bbox ? l.bbox.y0 : null, x: l.bbox ? l.bbox.x0 : null}));
    if(!lines.length && data.text) lines = data.text.split('\n').map(t => ({t: t.trim()}));
    return {lines: lines.filter(l => l.t && /[A-Za-z0-9]{2}/.test(l.t)), w: src.width, h: src.height};
  }catch(e){ return {error: String(e)}; }
}
const sigCv = $('#cv-sig'), sigCtx = sigCv.getContext('2d', {willReadFrequently:true});
function guideCrop(){
  const vw = vid.videoWidth, vh = vid.videoHeight;
  const vr = vid.getBoundingClientRect(), fr = $('#frame').getBoundingClientRect();
  const s = Math.max(vr.width / vw, vr.height / vh);
  const offX = (vr.width - vw * s) / 2, offY = (vr.height - vh * s) / 2;
  const m = 0.05;
  let x = (fr.left - vr.left - offX - fr.width * m) / s, y = (fr.top - vr.top - offY - fr.height * m) / s;
  let w = fr.width * (1 + 2 * m) / s, h = fr.height * (1 + 2 * m) / s;
  x = Math.max(0, x); y = Math.max(0, y); w = Math.min(vw - x, w); h = Math.min(vh - y, h);
  if(!(w > 20 && h > 20)) return {x:0, y:0, w:vw, h:vh};
  return {x, y, w, h};
}
function frameSig(r){
  sigCtx.drawImage(vid, r.x, r.y, r.w, r.h, 0, 0, 24, 24);
  const d = sigCtx.getImageData(0, 0, 24, 24).data; const g = new Uint8Array(576);
  for(let i = 0; i < 576; i++) g[i] = (d[i*4] * 3 + d[i*4+1] * 6 + d[i*4+2]) / 10;
  return g;
}
function sigDiff(a, b){ if(!a || !b) return 255; let s = 0; for(let i = 0; i < a.length; i++) s += Math.abs(a[i] - b[i]); return s / a.length; }

function scanLoop(){
  if(!SC.on) return;
  clearTimeout(SC.timer);
  SC.timer = setTimeout(async () => {
    if(!SC.on) return;
    if(!SC.paused && !SC.busy && vid.videoWidth){ SC.busy = true; try{ await scanTick(); }catch(e){ console.warn(e); } SC.busy = false; }
    scanLoop();
  }, SC.state === 'lock' ? 160 : 90);
}
async function scanTick(){
  const crop = guideCrop();
  const sig = frameSig(crop);
  if(SC.state === 'lock'){
    if(sigDiff(sig, SC.lockSig) < 16) return;
    SC.state = 'search'; SC.last = null; SC.lastN = 0;
    scanStatus('Nächste Karte …');
  }
  const cv = $('#cv');
  const sc = NATIVE ? Math.min(2, Math.max(1, 1500 / Math.max(crop.w, crop.h))) : Math.min(2, 900 / Math.max(crop.w, crop.h));
  cv.width = Math.round(crop.w * sc); cv.height = Math.round(crop.h * sc);
  const cx = cv.getContext('2d'); cx.imageSmoothingQuality = 'high';
  cx.drawImage(vid, crop.x, crop.y, crop.w, crop.h, 0, 0, cv.width, cv.height);
  // Browser: meist nur Namen, Typzeile und Nummer lesen (schnell); jeder 3. Fehlversuch liest die ganze Karte
  const full = !NATIVE && (SC.webMiss || 0) % 3 === 2;
  const res = NATIVE ? await runOcr(cv.toDataURL('image/jpeg', 0.88), SC.rot) : await webOcr(cv, SC.rot, full);
  if(!SC.on || SC.paused) return;
  if(res.error){ scanStatus('Texterkennung: ' + res.error); return; }
  const nLines = (res.lines || []).length;
  const r = ENGINE.identify(res, {prefer: scanPrefer()});

  if(!r || r.empty){
    SC.last = null; SC.lastN = 0; SC.webMiss = (SC.webMiss || 0) + 1;
    if(r && r.empty){ SC.emptyRun++; if(SC.emptyRun >= 2) SC.sawEmpty = true; } else SC.emptyRun = 0;
    if(S.settings.rotation === 'auto'){
      if(nLines >= 2 || SC.goodRot == null) SC.fail++;
      if(SC.fail >= (SC.goodRot == null ? 2 : 6)){ SC.fail = 0; SC.rot = ROTS[(ROTS.indexOf(SC.rot) + 1) % ROTS.length]; scanOptsUI(); }
    }
    scanStatus(nLines >= 2 ? 'Lese Karte …' : 'Lege eine Karte unter die Kamera', nLines >= 2 ? 'read' : '');
    return;
  }
  SC.emptyRun = 0; SC.fail = 0; SC.webMiss = 0;
  if(S.settings.rotation === 'auto' && SC.goodRot !== SC.rot){ SC.goodRot = SC.rot; scanOptsUI(); }

  const need = !NATIVE && (r.strong || r.score >= 0.95) ? 1 : Math.max(1, +S.settings.confirm || 2);  // Browser ist langsamer: nur bei sehr sicherer Erkennung reicht 1 Bild
  // Gleiche Karte zählt als Bestätigung, auch wenn die Sammlernummer nur in manchen Bildern lesbar war.
  // Behalten wird das genaueste Ergebnis (mit gelesenem Set/Nummer bzw. Sprache).
  const detail = x => (x.strong ? 4 : 0) + (x.col && x.col.num ? 2 : 0) + (x.col && x.col.lang ? 1 : 0);
  if(SC.last && SC.last.c.o === r.c.o){ SC.lastN++; if(detail(r) >= detail(SC.last)) SC.last = r; }
  else { SC.last = r; SC.lastN = 1; }
  if(r.strong || SC.lastN >= need){
    const best = SC.last;
    if(SC.lastAdded && SC.lastAdded.c.o === best.c.o && !SC.sawEmpty){ SC.state = 'lock'; SC.lockSig = sig; scanStatus('✓ ' + cName(best.c) + ' – nächste Karte', 'ok'); return; }
    // Bild hat sich kaum verändert, aber eine andere Karte wurde erkannt: Das ist dieselbe Karte, die vorher falsch gelesen wurde.
    const prev = SC.lastAdded;
    if(prev && !SC.sawEmpty && prev.sig && sigDiff(sig, prev.sig) < 28 && Date.now() - prev.t < 15000 && SC.session[0] === prev){
      const was = cName(prev.c, prev.lang);
      changeItem(prev, {c: best.c, lang: best.lang, ambiguous: best.ambiguous}); prev.sig = sig;
      SC.state = 'lock'; SC.lockSig = sig; SC.last = null; SC.lastN = 0;
      scanStatus('✓ korrigiert: ' + cName(best.c, best.lang) + ' (statt ' + was + ')', 'ok');
      return;
    }
    confirmScan(best, sig);
  } else scanStatus('Erkenne: ' + cName(r.c, r.lang), 'read');
}
function confirmScan(r, sig){
  const foil = !!S.settings.foil;
  const item = {sid: 'x' + Date.now() + Math.random(), c: r.c, lang: r.lang, foil, ambiguous: r.ambiguous, t: Date.now(), target: SC.target, sig};
  putCard(item, 1);
  SC.session.unshift(item); SC.lastAdded = item; SC.sawEmpty = false;
  SC.state = 'lock'; SC.lockSig = sig; SC.last = null; SC.lastN = 0;
  if(NATIVE){ if(S.settings.sound) NATIVE.beep(); if(S.settings.vibrate) NATIVE.vibrate(60); }
  const fl = $('#flash'); fl.classList.add('on'); setTimeout(() => fl.classList.remove('on'), 60);
  scanStatus('✓ ' + cName(r.c, r.lang) + ' – nächste Karte', 'ok');
  renderLast(); scanOptsUI();
}
function renderLast(){
  const x = SC.session[0];
  $('#scan-last').innerHTML = x ? `<div class="last-card" data-sid="${x.sid}">
    ${cardImg(x.c, x.lang, 'small')}<div class="grow"><b class="ell">${esc(cName(x.c, x.lang))}</b>
    <div class="tiny muted ell">${esc(setName(x.c.s))} #${esc(x.c.n)}</div>
    <div class="tiny"><span class="gold">${money(priceEUR(x.c, x.foil))}</span> · ${x.lang.toUpperCase()}${x.foil ? ' · ✦ Foil' : ''}${x.ambiguous ? ' · <span style="color:var(--gold2)">Druck prüfen</span>' : ''}</div></div>
    <button class="round" style="width:38px;height:38px" data-act="scan-edit" data-sid="${x.sid}">✎</button>
    <button class="round" style="width:38px;height:38px" data-act="scan-undo" data-sid="${x.sid}">↶</button></div>` : '';
}
function sessionItem(sid){ return SC.session.find(x => x.sid === sid); }
A['scan-undo'] = el => {
  const x = sessionItem(el.dataset.sid); if(!x) return;
  putCard(x, -1); SC.session = SC.session.filter(y => y !== x);
  if(SC.lastAdded === x) SC.lastAdded = null;
  renderLast(); scanOptsUI(); if(sheetOpen()) A['scan-list'](); toast('Entfernt: ' + cName(x.c));
};
function changeItem(x, patch){
  putCard(x, -1); Object.assign(x, patch); putCard(x, 1);
  renderLast(); scanOptsUI();
}
let SE_Q = '';
A['scan-edit'] = el => {
  const x = sessionItem(el.dataset.sid); if(!x) return;
  const pref = scanPrefer();
  const all = ENGINE.printings(x.c).sort((a, b) => (pref ? (pref.has(b.s) ? 1 : 0) - (pref.has(a.s) ? 1 : 0) : 0) || cmpNum(a, b));
  const q = ENGINE.norm(SE_Q);
  const prints = all.filter(p => !q || ENGINE.norm(p.s + ' ' + setName(p.s) + ' ' + p.n).includes(q)).slice(0, 40);
  openSheet(`<h2>${esc(cName(x.c, x.lang))}</h2><div class="muted small">${esc(cType(x.c, x.lang))}</div>
    <label class="lbl">Sprache</label><div class="seg">${['de','en'].map(L => `<button class="${x.lang===L?'on':''}" data-act="se-set" data-sid="${x.sid}" data-k="lang" data-v="${L}">${L === 'de' ? 'Deutsch' : 'Englisch'}</button>`).join('')}</div>
    <label class="lbl">Ausführung</label><div class="seg"><button class="${!x.foil?'on':''}" data-act="se-set" data-sid="${x.sid}" data-k="foil" data-v="0">Normal</button><button class="${x.foil?'on':''}" data-act="se-set" data-sid="${x.sid}" data-k="foil" data-v="1">✦ Foil</button></div>
    ${all.length > 1 ? `<label class="lbl">Druck / Set (${all.length})</label>${all.length > 8 ? `<div class="search">${ICON_SEARCH}<input id="se-q" placeholder="Set oder Nummer" value="${esc(SE_Q)}"></div>` : ''}<div class="list">${prints.map(p => `<button class="item" style="width:100%;text-align:left" data-act="se-set" data-sid="${x.sid}" data-k="c" data-v="${esc(p.id)}">${cardImg(p, x.lang, 'small', 'style="width:34px;height:47px;border-radius:4px;object-fit:cover"')}<div class="grow">${setIcon(p.s)} ${esc(setName(p.s))} #${esc(p.n)}<div class="tiny muted">${esc(RAR_DE[p.r])} · ${money(priceEUR(p, x.foil))}</div></div>${p.id === x.c.id ? '✓' : ''}</button>`).join('')}</div>` : ''}
    <div class="actions"><button class="btn danger" data-act="scan-undo" data-sid="${x.sid}">Entfernen</button><button class="btn" data-act="sheet-close">Fertig</button></div>`);
  const inp = $('#se-q'); if(inp){ let t = null; inp.oninput = () => { clearTimeout(t); t = setTimeout(() => { SE_Q = inp.value; A['scan-edit']({dataset:{sid:x.sid}}); const n = $('#se-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); }, 300); }; }
};
A['se-set'] = el => {
  const x = sessionItem(el.dataset.sid); if(!x) return;
  const k = el.dataset.k, v = el.dataset.v;
  changeItem(x, k === 'lang' ? {lang:v} : k === 'foil' ? {foil: v === '1'} : {c: S.byId.get(v) || x.c, ambiguous:false});
  A['scan-edit']({dataset:{sid:x.sid}});
};
A['scan-list'] = () => {
  const v = SC.session.reduce((s, x) => s + (priceEUR(x.c, x.foil) || 0), 0);
  openSheet(`<h2>Diese Scan-Runde</h2><p class="muted small">${SC.session.length} Karten · ${money(v)}</p><div class="list">${SC.session.map(x => `<div class="item">
      ${cardImg(x.c, x.lang, 'small', 'style="width:38px;height:53px;border-radius:5px;object-fit:cover"')}
      <div class="grow"><b class="ell" style="display:block">${esc(cName(x.c, x.lang))}</b><div class="tiny muted ell">${esc(x.c.s.toUpperCase())} #${esc(x.c.n)} · ${x.lang.toUpperCase()}${x.foil ? ' · Foil' : ''}${x.ambiguous ? ' · <span class="gold">Druck prüfen</span>' : ''}</div></div>
      <span class="gold small">${money(priceEUR(x.c, x.foil))}</span><button class="chip" data-act="scan-edit" data-sid="${x.sid}">✎</button></div>`).join('') || '<div class="empty">Noch nichts gescannt.</div>'}</div>`);
};
/* Foto statt Live-Kamera (vor allem iPhone): Foto aufnehmen → erkennen → hinzufügen */
A['scan-photo'] = () => {
  const f = $('#file-in'); f.value = ''; f.accept = 'image/*'; f.setAttribute('capture', 'environment');
  f.onchange = async () => {
    f.removeAttribute('capture');
    const file = f.files && f.files[0]; if(!file) return;
    SC.paused = true; scanStatus('Lese Foto …', 'read');
    try{
      const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = URL.createObjectURL(file); });
      const cv = document.createElement('canvas'), k = Math.min(1, 1400 / Math.max(img.width, img.height));
      cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k); cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height);
      let r = null;
      for(const rot of [SC.goodRot ?? 0, ...ROTS.filter(x => x !== (SC.goodRot ?? 0))]){
        scanStatus('Lese Foto … (' + rot + '°)', 'read');
        const res = NATIVE ? await runOcr(cv.toDataURL('image/jpeg', 0.9), rot) : await webOcr(cv, rot, true);
        r = res && !res.error ? ENGINE.identify(res, {prefer: scanPrefer()}) : null;
        if(r && !r.empty){ SC.goodRot = rot; break; }
        r = null;
      }
      if(r){ confirmScan(r, null); SC.state = 'search'; }
      else { scanStatus('Karte nicht erkannt – Foto näher und gerade aufnehmen'); toast('Nicht erkannt. Tipp: Karte formatfüllend und gut beleuchtet fotografieren, oder „+ Manuell“.', 4500); }
    }catch(e){ scanStatus('Foto konnte nicht gelesen werden'); }
    SC.paused = false;
  };
  f.click();
};
A['scan-manual'] = () => openSearch('Karte manuell hinzufügen', o => {
  const c = bestPrint(o); if(!c) return;
  const lang = S.settings.scanLang === 'auto' ? S.settings.defaultLang : S.settings.scanLang;
  const item = {sid:'x' + Date.now(), c, lang, foil: !!S.settings.foil, ambiguous:true, t:Date.now(), target: SC.target};
  putCard(item, 1);
  SC.session.unshift(item); closeSheet(); renderLast(); scanOptsUI(); toast('Hinzugefügt: ' + oName(o) + ' – Druck mit ✎ wählen');
});

/* =========================================================
   Globale Ereignisse & Start
   ========================================================= */
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]'); if(!el) return;
  const f = A[el.dataset.act]; if(!f) return;
  e.preventDefault(); f(el, e);
});
window.__androidBack = () => {
  if(sheetOpen()){ closeSheet(); return true; }
  if(SEL){ selEnd(); return true; }
  if(!$('#scan').hidden){ A['scan-close'](); return true; }
  if(goBack()) return true;
  if(S.ui.tab !== 'collection' || S.ui.deck || S.ui.assist || S.ui.bundle || S.ui.partner){ Object.assign(S.ui, {tab:'collection', deck:null, assist:null, bundle:null, partner:null, duel:false, pick:false}); render(); return true; }
  return false;
};
window.__appPause = () => { saveNow(); try{ autoBackup(); }catch(e){} if(SC.on){ SC.paused = true; scanOptsUI(); scanStatus('Pausiert'); } };
// Bild fehlt: erst das englische Bild versuchen, sonst ausblenden
document.addEventListener('error', e => { const t = e.target; if(t && t.tagName === 'IMG'){ if(t.dataset.fb){ const f = t.dataset.fb; delete t.dataset.fb; t.src = f; } else t.style.visibility = 'hidden'; } }, true);
document.addEventListener('visibilitychange', () => { if(document.hidden) saveNow(); else if(S.cards.length && Date.now() - lastRefresh > 3 * HOUR) backgroundRefresh(); });

function bootScreen(msg, err){
  view.innerHTML = `<div class="boot"><div class="logo" style="margin-bottom:20px">${LOGO}<h1 style="margin:0">Magic the Foxering</h1></div>
    ${err ? `<div class="warn" style="max-width:360px">${esc(err)}</div><button class="btn" style="margin-top:16px" data-act="retry-boot">Nochmal versuchen</button>`
      : `<div class="loader"></div><b>${esc(msg)}</b><p class="muted small" style="max-width:320px">Beim ersten Start richtet die App alle Magic-Karten (Deutsch & Englisch) mit Preisen ein. Das dauert einen Moment – danach geht es schnell.</p>`}</div>`;
}
A['retry-boot'] = () => firstRun();
async function firstRun(){
  try{ await loadCards(LOCAL, m => bootScreen(m)); }
  catch(e){
    try{ await loadCards(REMOTE, m => bootScreen(m)); }
    catch(e2){ bootScreen('', 'Die Kartendaten konnten nicht geladen werden (' + e2.message + '). Bitte prüfe deine Internetverbindung.'); return; }
  }
  try{ await updateRates(LOCAL); }catch(e){ try{ await updateRates(); }catch(e2){} }
  try{ await updateMeta(LOCAL); }catch(e){ try{ await updateMeta(); }catch(e2){} }
  try{ await updateProducts(LOCAL); }catch(e){ try{ await updateProducts(); }catch(e2){} }
  render(); backgroundRefresh();
}
/* Beim Start (und nach längerer Pause) alles aktualisieren: Karten, Preise, Kurse, Meta */
let refreshing = false, lastRefresh = 0;
function setSync(t){ S.syncMsg = t; const el = $('#sync'); if(el) el.textContent = t; }
function softRender(){ const a = document.activeElement; if(a && (a.tagName === 'INPUT' || a.tagName === 'TEXTAREA' || a.tagName === 'SELECT')) return; if(sheetOpen()){ refreshBehindSheet(); return; } if(!$('#scan').hidden) return; render(); }
async function backgroundRefresh(){
  if(refreshing) return; refreshing = true; lastRefresh = Date.now();
  let errs = 0, changed = false; setSync('⟳ Aktualisiere Preise …');
  try{ const r = await updateData(false); changed = r !== 'same'; }catch(e){ errs++; console.warn(e); }
  try{ await updateRates(); }catch(e){ errs++; console.warn(e); }
  try{ await updateMeta(); }catch(e){ errs++; console.warn(e); }
  try{ await updateProducts(); }catch(e){ console.warn(e); }
  refreshing = false;
  setSync(errs ? 'Offline – zeige gespeicherte Daten' : '✓ Alles aktuell');
  if(changed) softRender(); else setSync(S.syncMsg);
}
async function boot(){
  try{ await DB.open(); }catch(e){ console.warn('IndexedDB', e); }
  if(WEB && navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
  await loadUser();
  if(!userSize(userData())){ try{ const l = await safeList(); if(l.length) S.ui.safeOffer = l.reduce((a, b) => b.n > a.n ? b : a); }catch(e){} }
  const cd = await DB.get('cards');
  if(cd && cd.o && cd.p){ applyCards(cd); applyPrices(await DB.get('prices')); }
  const fx = await DB.get('rates'); if(fx){ S.rates = Object.assign({EUR:1}, fx.rates || {}); S.ratesDate = fx.date; }
  const mt = await DB.get('meta'); if(mt) S.meta = mt;
  applyProducts(await DB.get('products'));
  if(!S.cards.length){ bootScreen('Starte …'); await firstRun(); }
  else { render(); backgroundRefresh(); }
}
boot();
