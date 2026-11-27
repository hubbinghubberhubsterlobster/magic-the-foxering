'use strict';
/* =========================================================
   Magic the Foxering – Koop / Duelle
   Sammlung einer anderen Person importieren (Foxering-Backup oder CSV/Textliste) und
   ausgeglichene Decks finden, die gegeneinander Spaß machen – je eins pro Person.
   Diese Decks erscheinen nur hier, nicht unter "Decks".
   ========================================================= */
const COOP_FMTS = ['casual', 'commander', 'standard', 'pioneer', 'modern', 'pauper'];
function partnerById(id){ return S.partners.find(p => p.id === id); }
function partnerEntries(p){
  const out = [];
  for(const [k, e] of Object.entries(p.coll || {})){ const [id, lang, f] = k.split('|'); const c = S.byId.get(id); if(c) out.push({c, lang, foil: f === '1', q: e.q, k}); }
  return out;
}
function partnerByKey(p){ const m = new Map(); for(const e of partnerEntries(p)){ const k = gkey(e.c); m.set(k, (m.get(k) || 0) + e.q); } return m; }
function partnerOwned(p){ const m = new Map(); for(const e of partnerEntries(p)) m.set(e.c.o.i, (m.get(e.c.o.i) || 0) + e.q); return m; }
function partnerStats(p){ let total = 0, value = 0; for(const e of partnerEntries(p)){ total += e.q; value += (priceEUR(e.c, e.foil) || 0) * e.q; } return {total, value}; }

/* ---------- Übersicht ---------- */
function renderCoop(){
  view.innerHTML = `<div class="row">${backBtn()}<h1 class="grow">🤝 Koop-Decks</h1></div>
    <p class="muted small" style="margin-top:-4px">Lade die Sammlung von jemand anderem und Foxering sucht je ein Deck für euch beide, die gut gegeneinander funktionieren – ausgeglichen und mit Spaß. Diese Decks erscheinen nur hier.</p>
    <button class="btn block" data-act="coop-new" style="margin-bottom:14px">➕ Mitspieler hinzufügen</button>
    ${S.partners.map(p => { const st = partnerStats(p), n = S.decks.filter(d => d.coop === p.id && d.who === 'me').length; return `<button class="deck-item" data-act="coop-open" data-id="${p.id}">
      <div style="font-size:28px">🧑</div><div class="grow"><b style="display:block">${esc(p.name)}</b>
      <div class="tiny muted">${st.total} Karten · ${n} ${n === 1 ? 'Duell' : 'Duelle'} gespeichert · Stand ${fmtDate(new Date(p.updated || p.created).toISOString()).split(',')[0]}</div></div>
      <div class="gold small">${money(st.value)}</div></button>`; }).join('')
      || `<div class="empty"><div class="icon">🤝</div><b>Noch keine Mitspieler</b><p>Dein Mitspieler speichert in seiner Foxering-App unter <b>Mehr → Backup jetzt speichern</b> (oder „Als CSV exportieren“) eine Datei und schickt sie dir. Auch ein CSV-Export aus Moxfield, Manabox oder Archidekt funktioniert.</p></div>`}`;
}
A['coop-open'] = el => go({tab:'coop', partner: el.dataset.id, deck:null, assist:null, duel:false});

/* ---------- Mitspieler anlegen / Datei laden ---------- */
function collFromFile(text){
  try{
    const j = JSON.parse(text);
    if(j && j.coll && typeof j.coll === 'object'){
      const coll = {}; for(const [k, e] of Object.entries(j.coll)){ const id = k.split('|')[0]; if(S.byId.get(id) && e && e.q > 0) coll[k] = {q: e.q}; }
      return {coll, bad: 0};
    }
  }catch(e){ /* keine JSON-Datei → CSV/Text */ }
  const {out, bad} = parseCardFile(text);
  const coll = {}; for(const x of out){ const k = ckey(x.c.id, x.lang, x.foil); coll[k] = {q: (coll[k] ? coll[k].q : 0) + x.n}; }
  return {coll, bad: bad.length};
}
async function loadPartnerFile(p){
  const t = await pickFile('.json,.csv,.txt,application/json,text/csv,text/plain'); if(!t) return false;
  const {coll, bad} = collFromFile(t);
  const n = Object.values(coll).reduce((s2, e) => s2 + e.q, 0);
  if(!n){ await ask('Nichts erkannt', 'In der Datei habe ich keine Karten gefunden. Nimm ein <b>Foxering-Backup</b> (Mehr → Backup jetzt speichern) oder einen <b>CSV-Export</b> (Foxering, Moxfield, Manabox …).', [{l:'OK', v:true}]); return false; }
  p.coll = coll; p.updated = Date.now(); persist();
  toast(`${n} Karten von ${p.name} geladen${bad ? ` · ${bad} Zeilen nicht erkannt` : ''} ✓`, 3500);
  return true;
}
A['coop-new'] = async () => {
  const name = await promptText('Wie heißt dein Mitspieler?', '', 'z. B. Marius'); if(!name) return;
  const p = {id:'p' + Date.now(), name, created: Date.now(), coll:{}, fmt:'casual', tourney:false};
  if(!await loadPartnerFile(p)) return;
  S.partners.unshift(p); persist();
  go({tab:'coop', partner: p.id, deck:null, assist:null, duel:false});
};
A['coop-reload'] = async () => { const p = currentPartner(); closeSheet(); if(p && await loadPartnerFile(p)){ COOP_CACHE = null; renderPartner(); } };

/* ---------- Duelle finden ---------- */
let COOP_CACHE = null, COOP_BUSY = null;
function currentPartner(){ return partnerById(S.ui.partner); }
function duelKey(p){ return [p.id, p.fmt || 'casual', p.tourney ? 1 : 0, p.updated, Object.values(S.coll).reduce((s2, e) => s2 + e.q, 0), S.cv].join(':'); }
async function computeDuels(p){
  const fmt = p.fmt || 'casual', tourney = fmt !== 'casual' && !!p.tourney;
  const mine = (await ASSIST.recsForColl(null, fmt, tourney)).slice(0, 10);
  const theirs = (await ASSIST.recsForColl(partnerOwned(p), fmt, tourney)).slice(0, 10);
  const duels = [];
  for(const a of mine) for(const b of theirs){
    const diff = Math.abs(a.rt.score - b.rt.score);
    if(diff > 12) continue;
    const shared = a.cols.filter(k => b.cols.includes(k)).length;
    const avg = (a.rt.score + b.rt.score) / 2;
    const fun = avg - diff * 1.6 + (a.style !== b.style ? 3 : 0) + (shared === 0 ? 3 : shared === 1 ? 1 : -3);
    duels.push({a, b, diff, fun, shared});
  }
  duels.sort((x, y) => y.fun - x.fun);
  const key = r => r.cmd ? r.cmd.o.name : r.cols.join('');
  const usedA = new Map(), usedB = new Map(), pick = [];
  for(const d of duels){ const ka = key(d.a), kb = key(d.b); if((usedA.get(ka) || 0) >= 2 || (usedB.get(kb) || 0) >= 2) continue; usedA.set(ka, (usedA.get(ka) || 0) + 1); usedB.set(kb, (usedB.get(kb) || 0) + 1); pick.push(d); if(pick.length >= 6) break; }
  return {key: duelKey(p), fmt, mine, theirs, duels: pick};
}
function balanceLabel(diff){ return diff <= 3 ? '<span style="color:var(--good)">⚖️ sehr ausgeglichen</span>' : diff <= 7 ? '<span style="color:var(--gold)">⚖️ ausgeglichen</span>' : '<span style="color:var(--bad)">⚖️ leicht unausgeglichen</span>'; }
function deckLabel(r){ return r.cmd ? cName(r.cmd) : ASSIST.comboLabel(r.cols); }
function sideHtml(who, r){
  return `<div class="row" style="gap:8px;align-items:flex-start"><div style="min-width:30px;text-align:center"><b style="font-size:18px;color:${TIER_COL[r.rt.tier]}">${r.rt.tier}</b><div class="tiny muted">${r.rt.score}</div></div>
    <div class="grow"><div class="tiny muted">${esc(who)}</div><div class="row" style="gap:6px">${colDots(r.cols)}<b class="small ell">${esc(deckLabel(r))}</b></div>
    <div class="tiny muted">${ASSIST.styleTag[r.style] || ''} · ${esc((r.feat || []).slice(0, 2).join(' · '))}</div></div></div>`;
}
function renderPartner(){
  const p = currentPartner(); if(!p){ S.ui.partner = null; return renderCoop(); }
  syncAlloc();
  const st = partnerStats(p), fmt = p.fmt || 'casual';
  const saved = S.decks.filter(d => d.coop === p.id && d.who === 'me');
  const ready = COOP_CACHE && COOP_CACHE.key === duelKey(p);
  view.innerHTML = `<div class="row" style="margin-bottom:8px">${backBtn()}<h1 class="grow ell" style="margin:0">🤝 Du & ${esc(p.name)}</h1><button class="chip" data-act="coop-menu">⋯</button></div>
    <div class="hero"><div class="row between"><div><div class="lbl">Sammlung von ${esc(p.name)}</div><div class="big">${st.total} <span style="font-size:16px">Karten</span></div></div><div class="gold">${money(st.value)}</div></div>
      <div class="tiny" style="color:#d8d4f2;margin-top:6px">Stand ${fmtDate(new Date(p.updated || p.created).toISOString())} · deine Sammlung: ${collectionStats().total} Karten</div></div>
    <label class="lbl">Format</label><div class="chips" style="flex-wrap:wrap">${COOP_FMTS.map(f => `<button class="chip ${fmt === f ? 'on' : ''}" data-act="coop-fmt" data-f="${f}">${esc(FORMAT_DE[f])}</button>`).join('')}</div>
    ${fmt === 'casual' ? '' : `<label class="switch-row" style="margin-top:10px"><input type="checkbox" data-act="coop-tourney" ${p.tourney ? 'checked' : ''}><span class="switch"></span><span class="small"><b>Turnierspielbar</b> <span class="tiny muted">${p.tourney ? '– nur in ' + esc(FORMAT_DE[fmt]) + ' erlaubte Karten' : '– aus: alle Karten, einfach zum Spaß'}</span></span></label>`}
    ${saved.length ? `<h3>Gespeicherte Duelle</h3>` + saved.map(d => { const o = S.decks.find(x => x.duel === d.duel && x.who === 'them'); const ra = ASSIST.rateDeck(d), rb = o ? ASSIST.rateDeck(o) : null;
      return `<div class="card" style="margin-bottom:8px"><div class="row between"><b class="small">${esc(d.duelName || 'Duell')}</b><button class="chip mini" data-act="duel-delete" data-duel="${d.duel}">🗑</button></div>
        <button class="deck-item" style="margin:8px 0 6px" data-act="deck-open" data-id="${d.id}">${tierBadge(ra)}<div class="grow"><div class="tiny muted">Du</div><b class="ell" style="display:block">${esc(d.name)}</b>${deckStats(d).missing ? `<div class="miss">${deckStats(d).missing} fehlen</div>` : '<div class="tiny" style="color:var(--good)">✓ spielbereit</div>'}</div></button>
        ${o ? `<button class="deck-item" style="margin:0" data-act="deck-open" data-id="${o.id}">${tierBadge(rb)}<div class="grow"><div class="tiny muted">${esc(p.name)}</div><b class="ell" style="display:block">${esc(o.name)}</b>${deckStats(o).missing ? `<div class="miss">${deckStats(o).missing} fehlen bei ${esc(p.name)}</div>` : '<div class="tiny" style="color:var(--good)">✓ spielbereit</div>'}</div></button>` : ''}</div>`; }).join('') : ''}
    <h2>⚔️ Vorschläge für ein Duell</h2>
    <p class="tiny muted" style="margin-top:-6px">Je ein Deck pro Person, nur aus den eigenen Karten. Möglichst gleich stark, unterschiedliche Farben und Spielstile – damit es spannend bleibt.</p>
    <div id="duels">${ready ? duelsHtml(p) : '<div class="boot" style="min-height:100px"><div class="loader" style="width:28px;height:28px"></div><span class="small muted">Vergleiche eure Sammlungen …</span></div>'}</div>`;
  if(!ready && COOP_BUSY !== duelKey(p)){
    const k = duelKey(p); COOP_BUSY = k;
    setTimeout(async () => {
      try{ const c = await computeDuels(p); if(duelKey(p) === k) COOP_CACHE = c; }
      catch(e){ console.warn(e); COOP_CACHE = {key:k, mine:[], theirs:[], duels:[]}; }
      COOP_BUSY = null;
      const el = $('#duels'); if(el && currentPartner() === p && !S.ui.duel) el.innerHTML = duelsHtml(p);
    }, 60);
  }
}
function duelsHtml(p){
  const c = COOP_CACHE; if(!c) return '';
  const size = (c.fmt || 'casual') === 'commander' ? '100-Karten-Commander-Deck' : 'vollständiges 60-Karten-Deck';
  if(!c.mine.length || !c.theirs.length) return `<div class="empty">${!c.mine.length ? 'Du hast' : esc(p.name) + ' hat'} noch keine Farbkombination${c.fmt === 'commander' ? ' bzw. keinen Commander' : ''} mit genug Karten für ein ${size}.</div>`;
  if(!c.duels.length) return `<div class="empty">Eure stärksten Decks liegen zu weit auseinander für ein faires Duell. Mehr Karten helfen – oder schaltet „Turnierspielbar“ aus.</div>`;
  return c.duels.map((d, i) => `<button class="deck-item" style="display:block;text-align:left" data-act="duel-open" data-i="${i}">
    ${sideHtml('Du', d.a)}<div class="tiny" style="text-align:center;margin:6px 0;color:var(--muted)">— gegen —</div>${sideHtml(p.name, d.b)}
    <div class="row between" style="margin-top:8px"><span class="tiny">${balanceLabel(d.diff)} · Unterschied ${d.diff}</span><span class="muted">›</span></div></button>`).join('');
}
A['coop-tourney'] = () => { const p = currentPartner(); p.tourney = !p.tourney; persist(); COOP_CACHE = null; renderPartner(); };
A['coop-fmt'] = el => { const p = currentPartner(); p.fmt = el.dataset.f; persist(); COOP_CACHE = null; renderPartner(); };

/* ---------- Ein Duell ansehen / speichern ---------- */
let DUEL = null;
A['duel-open'] = el => { DUEL = COOP_CACHE.duels[+el.dataset.i]; go({tab:'coop', partner: S.ui.partner, duel:true}); };
function duelCards(r, own){ return ASSIST.deckFromResult(r, own); }
function duelList(r){
  const lines = [...r.lines].sort((a, b) => (a.o.cmc - b.o.cmc) || oName(a.o).localeCompare(oName(b.o), 'de'));
  return lines.map(x => { const c = ENGINE.preferPrinting(S.byOracle.get(x.o.i) || []); return `<div class="deck-line"><span class="cost">${manaHtml(x.o.mana) || '–'}</span>${c ? cardImg(c, dl(), 'small', `data-act="card" data-id="${esc(c.id)}"`) : ''}<div class="grow ell"><b>${x.n}× ${esc(oName(x.o))}</b>${x.cmd ? ' 👑' : ''}</div></div>`; }).join('');
}
function renderDuel(){
  const p = currentPartner(); if(!p || !DUEL){ S.ui.duel = false; return renderPartner(); }
  const d = DUEL;
  const half = (who, r, own) => { const cards = duelCards(r, own); return `<div class="card" style="margin-bottom:12px">${sideHtml(who, r)}
    <div class="row wrap" style="gap:4px;margin-top:8px">${(r.feat || []).map(f => `<span class="tag">${esc(f)}</span>`).join('')}</div>
    <details class="guide-box" style="margin:10px 0 0"><summary>📖 So spielt ${who === 'Du' ? 'du' : esc(who)} dieses Deck</summary>${ASSIST.guide({cards, fmt: r.fmt, cmd: null})}</details>
    <details class="guide-box" style="margin:8px 0 0"><summary>🃏 Deckliste (${r.total} Karten)</summary>${duelList(r)}</details></div>`; };
  view.innerHTML = `<div class="row">${backBtn()}<h1 class="grow ell">⚔️ Duell</h1></div>
    <div class="card" style="margin-bottom:12px;text-align:center">${balanceLabel(d.diff)}<div class="tiny muted" style="margin-top:4px">Stärke ${d.a.rt.score} gegen ${d.b.rt.score}${d.shared === 0 ? ' · komplett unterschiedliche Farben' : ''}${d.a.style !== d.b.style ? ' · unterschiedliche Spielstile' : ''}</div></div>
    ${half('Du', d.a, null)}${half(p.name, d.b, partnerOwned(p))}
    <button class="btn block" data-act="duel-save">💾 Beide Decks speichern</button>`;
}
A['duel-save'] = async () => {
  const p = currentPartner(), d = DUEL; if(!p || !d) return;
  const name = await promptText('Name für dieses Duell', `${deckLabel(d.a)} gegen ${deckLabel(d.b)}`); if(!name) return;
  const duel = 'u' + Date.now(), now = Date.now();
  const fmt = d.a.fmt || p.fmt || 'casual';
  const mk = (r, who, own) => {
    const cards = duelCards(r, own), cmdLine = r.lines.find(x => x.cmd);
    let cmd = null; if(cmdLine) cmd = Object.keys(cards).find(id => S.byId.get(id).o === cmdLine.o) || null;
    return {id:'d' + now + who, name: `${deckLabel(r)} ${(ASSIST.styleTag[r.style] || '').replace(/^\S+ /, '')}`.trim(), fmt, cards, side:{}, cmd, src:'coop', created: now, coop: p.id, who, duel, duelName: name, casual: fmt === 'casual' || !p.tourney};
  };
  S.decks.unshift(mk(d.a, 'me', null), mk(d.b, 'them', partnerOwned(p)));
  persist(); toast('Duell gespeichert ✓'); NAV.length = 0;
  Object.assign(S.ui, {tab:'coop', partner: p.id, duel:false, deck:null}); render();
};
A['duel-delete'] = async el => {
  const ok = await ask('Duell löschen?', 'Beide Decks dieses Duells werden gelöscht. Die Karten bleiben, wo sie sind.', [{l:'Abbrechen', v:false, c:'ghost'}, {l:'Löschen', v:true, c:'danger'}]);
  if(ok){ S.decks = S.decks.filter(d => d.duel !== el.dataset.duel); persist(); renderPartner(); }
};
A['coop-menu'] = () => openSheet(`<h2>${esc(currentPartner().name)}</h2><div class="list">
  <button class="item" style="width:100%" data-act="coop-reload">📥 Neue Sammlungsdatei laden</button>
  <button class="item" style="width:100%" data-act="coop-rename">✎ Umbenennen</button>
  <button class="item" style="width:100%;color:var(--bad)" data-act="coop-delete">🗑️ Mitspieler löschen</button></div>`);
A['coop-rename'] = async () => { const p = currentPartner(); closeSheet(); const n = await promptText('Umbenennen', p.name); if(n){ p.name = n; persist(); renderPartner(); } };
A['coop-delete'] = async () => {
  const p = currentPartner(); closeSheet();
  const ok = await ask(`${esc(p.name)} löschen?`, 'Die importierte Sammlung und alle Duell-Decks mit dieser Person werden gelöscht. Deine eigene Sammlung bleibt unverändert.', [{l:'Abbrechen', v:false, c:'ghost'}, {l:'Löschen', v:true, c:'danger'}]);
  if(!ok) return;
  S.decks = S.decks.filter(d => d.coop !== p.id); S.partners = S.partners.filter(x => x !== p);
  S.ui.partner = null; NAV.length = 0; persist(); render();
};
