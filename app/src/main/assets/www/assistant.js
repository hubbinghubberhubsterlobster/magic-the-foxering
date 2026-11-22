'use strict';
/* =========================================================
   Magic the Foxering – Deck-Assistent
   - baut die stärksten Decks aus deinen Karten (Commander & Turnierformate)
   - zeigt die aktuelle Meta (MTGGoldfish) und beliebte Commander (EDHREC)
   - schlägt fehlende starke Karten mit Preis vor
   - bewertet deine Decks (Stufe S–D) und erklärt, wie man sie spielt
   ========================================================= */
const ASSIST = (() => {
  const st = {fmt:'commander', mode:'owned', cols:[], style:'midrange', cmd:null, results:null, sel:0, title:'', meta:null, metaFmt:null};
  const STYLES = {aggro:'Aggro (schnell)', midrange:'Midrange (ausgewogen)', control:'Control (kontrollierend)'};
  const FMTS = ['commander','standard','pioneer','modern','pauper','legacy'];
  const RX = {
    removal: /destroy target|exile target|deals? (\d+|x) damage to (any target|target creature|target player or planeswalker|target attacking)|counter target (spell|creature|noncreature)|return target (creature|nonland permanent) to its owner'?s hand|target creature gets -\d|fights? target/i,
    wipe: /destroy all (creatures|nonland)|exile all (creatures|nonland)|all creatures get -|deals? \d+ damage to each creature|each player sacrifices/i,
    draw: /draws? (a|two|three|four|x|\w+) cards?|draw cards equal|investigate/i,
    ramp: /add \{|add (one|two|three) mana|add mana|search your library for (a|up to \w+) (basic )?lands?|put (a|up to \w+) lands? card/i,
    counter: /counter target/i
  };
  const role = (o, r) => RX[r].test(o.txt);

  /* ---------- Bewertung einzelner Karten ---------- */
  function power(o){ return o.edh ? Math.max(0, Math.min(1, 1.15 - Math.log10(o.edh) / 4.4)) : 0.12; }
  let MF = {}, NAMES = null, MEMO = new Map(), ER = new Map();
  function byName(n){
    if(!NAMES){ NAMES = new Map(); for(const o of S.oracle){ NAMES.set(o.name, o); const f = o.name.split(' // ')[0]; if(!NAMES.has(f)) NAMES.set(f, o); } }
    return NAMES.get(n) || NAMES.get(String(n).split(' // ')[0]) || (window.ENGINE ? ENGINE.findByName(n) : null);
  }
  /* Wie stark ist eine Karte in der aktuellen Turnier-Meta? 0..1 */
  function metaFreq(fmt){
    if(MF[fmt]) return MF[fmt];
    const m = new Map(), list = (S.meta && S.meta.formats && S.meta.formats[fmt]) || [];
    for(const a of list){ const w = Math.max(1, a.share || 1); for(const [n, k] of a.cards || []){ const o = byName(n); if(o) m.set(o.i, (m.get(o.i) || 0) + w * Math.min(4, k) / 4); } }
    const mx = Math.max(1, ...m.values()); for(const [k, v] of m) m.set(k, Math.min(1, v / mx * 1.6));
    return (MF[fmt] = m);
  }
  function cardScore(o, fmt){
    const p = power(o); if(fmt === 'commander') return p;
    const mf = metaFreq(fmt), hasMeta = mf.size > 0;
    return hasMeta ? p * 0.5 + (mf.get(o.i) || 0) * 0.6 : p;
  }
  function styleAdj(o, style){
    const cre = /\bCreature\b/.test(o.type), cmc = o.cmc || 0; let a = 0;
    if(style === 'aggro'){ if(cre && cmc <= 2) a += 0.22; else if(cre && cmc === 3) a += 0.08; if(cmc >= 5) a -= 0.35; if(role(o, 'removal') && cmc <= 2) a += 0.06; if(role(o, 'wipe')) a -= 0.3; }
    else if(style === 'control'){ if(role(o, 'removal')) a += 0.2; if(role(o, 'draw')) a += 0.15; if(role(o, 'wipe')) a += 0.25; if(role(o, 'counter')) a += 0.1; if(cre && cmc <= 2) a -= 0.1; }
    else { if(cmc >= 2 && cmc <= 4) a += 0.06; if(role(o, 'removal')) a += 0.1; if(cmc >= 6) a -= 0.15; }
    return a;
  }
  function pips(lines){
    const p = {W:0, U:0, B:0, R:0, G:0};
    for(const x of lines){ if(isLand(x.o)) continue; for(const m of (x.o.mana || '').matchAll(/\{([^}]+)\}/g)){ const s = m[1].split('/'); for(const k of s) if(p[k] != null) p[k] += x.n / s.length; } }
    return p;
  }
  function basics(cols, count, lines){
    const p = pips(lines), tot = cols.reduce((s, k) => s + p[k], 0) || cols.length;
    const out = []; let left = count;
    cols.forEach((k, i) => {
      const n = i === cols.length - 1 ? left : Math.max(cols.length > 1 ? 1 : 0, Math.round(count * (p[k] || (tot / cols.length)) / tot));
      const o = byName(COLORS[k].basic); const take = Math.min(left, n);
      if(o && take > 0){ out.push({o, n: take, basic: true}); left -= take; }
    });
    if(!cols.length && count){ const o = byName('Wastes'); if(o) out.push({o, n: count, basic: true}); }
    return out;
  }
  function finish(lines, mode, extra={}){
    const own = ownedByOracle();
    let total = 0, ownedCopies = 0, missCost = 0, q = 0, qn = 0;
    const missing = [];
    for(const x of lines){
      total += x.n;
      const have = x.basic ? x.n : Math.min(x.n, own.get(x.o.i) || 0);
      x.have = have; ownedCopies += have;
      if(have < x.n){ const pr = cheapest(x.o) || 0; missCost += pr * (x.n - have); missing.push({o:x.o, n:x.n - have, price: pr}); }
      if(!isLand(x.o)){ q += power(x.o) * x.n; qn += x.n; }
    }
    missing.sort((a, b) => b.price * b.n - a.price * a.n);
    return Object.assign({lines, total, ownedCopies, missCost, missing, quality: qn ? q / qn : 0, mode}, extra);
  }

  /* ---------- Turnierdeck (60 Karten) ---------- */
  function buildConstructed(cols, style, fmt, mode){
    const own = ownedByOracle(), best = mode === 'best';
    const ok = o => legalIn(o, fmt) && ciList(o).every(k => cols.includes(k)) && (best || own.get(o.i)) && !/\b(Conspiracy|Scheme|Plane|Phenomenon|Dungeon)\b/.test(o.type);
    const nonland = [], lands = [];
    for(const o of S.oracle){
      if(!ok(o) || isBasic(o)) continue;
      if(isLand(o)){ if(ciList(o).length) lands.push({o, s: cardScore(o, fmt)}); continue; }
      if(cols.length && !colList(o).length && power(o) < 0.5) continue;  // farblose Füller nur, wenn sie gut sind
      nonland.push({o, s: cardScore(o, fmt) + styleAdj(o, style)});
    }
    nonland.sort((a, b) => b.s - a.s); lands.sort((a, b) => b.s - a.s);
    const LANDS = {aggro:22, midrange:24, control:25}[style], NL = 60 - LANDS, CRE = {aggro:18, midrange:13, control:6}[style], BIG = {aggro:2, midrange:6, control:8}[style];
    const lines = []; let n = 0, cre = 0, big = 0;
    const take = (x, creOnly) => {
      if(n >= NL) return;
      const isCre = /\bCreature\b/.test(x.o.type);
      if(creOnly && !isCre) return;
      if(!creOnly && style === 'control' && isCre && cre >= CRE + 4) return;
      if((x.o.cmc || 0) >= 5 && big >= BIG) return;
      if(lines.some(l => l.o === x.o)) return;
      let k = x.s > 0.75 ? 4 : x.s > 0.55 ? 3 : 2;
      if(isLegendary(x.o)) k = Math.min(k, 2);
      k = Math.min(k, maxCopies(x.o, fmt), NL - n);
      if(!best) k = Math.min(k, own.get(x.o.i) || 0);
      if(k <= 0) return;
      lines.push({o:x.o, n:k}); n += k; if(isCre) cre += k; if((x.o.cmc || 0) >= 5) big += k;
    };
    for(const x of nonland){ if(cre >= CRE) break; take(x, true); }
    for(const x of nonland) take(x, false);
    const nbCap = cols.length <= 1 ? 4 : cols.length === 2 ? 10 : 14;
    let nb = 0;
    for(const x of lands){
      if(nb >= Math.min(nbCap, LANDS)) break;
      if(ciList(x.o).length < 2 && cols.length > 1 && x.s < 0.6) continue;
      let k = Math.min(4, nbCap - nb, best ? 4 : own.get(x.o.i) || 0); if(k <= 0) continue;
      lines.push({o:x.o, n:k}); nb += k;
    }
    lines.push(...basics(cols, LANDS - nb, lines));
    const r = finish(lines, mode, {cols, style, fmt});
    r.short = Math.max(0, 60 - r.total);
    return r;
  }

  /* ---------- Commander (100 Karten) ---------- */
  async function recsFor(name){
    const m = S.meta && (S.meta.commanders || []).find(c => c.name === name);
    if(m && m.recs && m.recs.length) return new Map(m.recs.map(r => [r[0], {rate:r[1] / 100, syn:r[2] / 100, tag:r[3]}]));
    if(ER.has(name)) return ER.get(name);
    let map = new Map();
    try{
      const j = await getJSON('https://json.edhrec.com/pages/commanders/' + edhSlug(name) + '.json');
      map = new Map(parseEdhrec(j).filter(x => x.name !== name).map(x => [x.name, {rate:x.rate, syn:x.syn, tag:x.tag}]));
    }catch(e){ console.warn('EDHREC', e); }
    ER.set(name, map);
    return map;
  }
  async function buildCommander(cmdPrint, mode){
    const cmd = cmdPrint.o, ci = ciList(cmd), best = mode === 'best';
    const own = ownedByOracle();
    const recs = await recsFor(cmd.name);
    const sc = o => { const r = recs.get(o.name) || recs.get(o.name.split(' // ')[0]); return r ? 0.35 + r.rate * 0.6 + Math.max(0, r.syn) * 0.5 : power(o) * 0.55; };
    const ok = o => o !== cmd && legalIn(o, 'commander') && ciList(o).every(k => ci.includes(k)) && !isBasic(o) && (best || own.get(o.i))
      && !/\b(Conspiracy|Scheme|Plane|Phenomenon|Dungeon)\b/.test(o.type);
    const nonland = [], lands = [];
    for(const o of S.oracle){ if(!ok(o)) continue; (isLand(o) ? lands : nonland).push({o, s: sc(o)}); }
    nonland.sort((a, b) => b.s - a.s); lands.sort((a, b) => b.s - a.s);
    const chosen = new Set(), lines = [{o:cmd, n:1, cmd:true}];
    const NL = 63, mins = {ramp:10, draw:9, removal:8, wipe:2};
    for(const [r, k] of Object.entries(mins)){
      let got = 0;
      for(const x of nonland){ if(got >= k) break; if(!chosen.has(x.o) && role(x.o, r)){ chosen.add(x.o); lines.push({o:x.o, n:1}); got++; } }
    }
    for(const x of nonland){ if(chosen.size >= NL) break; if(!chosen.has(x.o)){ chosen.add(x.o); lines.push({o:x.o, n:1}); } }
    const nlCount = chosen.size;
    const landTarget = 99 - nlCount;                     // fehlen Zauber, kommen mehr Länder rein (max. 40)
    const LANDS = Math.min(Math.max(36, landTarget), 40);
    const nbCap = ci.length <= 1 ? 10 : ci.length === 2 ? 18 : 24;
    let nb = 0;
    for(const x of lands){ if(nb >= Math.min(nbCap, LANDS)) break; lines.push({o:x.o, n:1}); nb++; }
    lines.push(...basics(ci, LANDS - nb, lines));
    const r = finish(lines, mode, {cmd: cmdPrint, fmt:'commander', cols: ci});
    r.short = Math.max(0, 100 - r.total);
    // Kaufvorschläge: Top-Empfehlungen, die dir fehlen
    const upgrades = [];
    for(const [name, v] of [...recs.entries()].sort((a, b) => (b[1].rate + b[1].syn) - (a[1].rate + a[1].syn))){
      const o = byName(name); if(!o || own.get(o.i) || !legalIn(o, 'commander')) continue;
      upgrades.push({o, rate: v.rate, syn: v.syn, price: cheapest(o) || 0}); if(upgrades.length >= 25) break;
    }
    r.upgrades = upgrades; r.hasRecs = recs.size > 0;
    return r;
  }

  /* ---------- Meta-Decks ---------- */
  function metaDecks(fmt){
    const list = (S.meta && S.meta.formats && S.meta.formats[fmt]) || [];
    const own = ownedByOracle();
    return list.map(a => {
      const lines = []; let unknown = 0;
      for(const [n, k] of a.cards || []){ const o = byName(n); if(o){ const ex = lines.find(l => l.o === o); if(ex) ex.n += k; else lines.push({o, n:k, basic: isBasic(o)}); } else unknown += k; }
      const side = []; for(const [n, k] of a.side || []){ const o = byName(n); if(o) side.push({o, n:k}); }
      const r = finish(lines, 'meta', {name: a.name, share: a.share, side, fmt, unknown});
      const cs = new Set(); for(const l of lines) if(!l.basic) colList(l.o).forEach(k => cs.add(k));
      r.cols = COLOR_KEYS.filter(k => cs.has(k));
      r.cover = r.total ? r.ownedCopies / r.total : 0;
      return r;
    });
  }
  function tierOf(share){ return share >= 10 ? 'S' : share >= 5 ? 'A' : share >= 2.5 ? 'B' : 'C'; }

  /* ---------- Bewertung eigener Decks ---------- */
  function rateDeck(d){
    const sig = JSON.stringify([d.cards, d.cmd, d.fmt, S.meta && S.meta.date, S.cv]);
    const m = MEMO.get(d.id); if(m && m.sig === sig) return m.r;
    const per = new Map(); let n = 0;
    for(const [id, k] of Object.entries(d.cards)){ const c = S.byId.get(id); if(!c) continue; per.set(c.o, (per.get(c.o) || 0) + k); n += k; }
    if(!n){ MEMO.set(d.id, {sig, r:null}); return null; }
    let q = 0, qn = 0;
    for(const [o, k] of per) if(!isLand(o)){ q += cardScore(o, d.fmt) * k; qn += k; }
    const quality = Math.min(1, qn ? q / qn : 0);
    let metaScore = 0.35, arche = null, note = '';
    if(d.fmt === 'commander' || d.fmt === 'brawl'){
      const cmd = d.cmd && S.byId.get(d.cmd);
      const mc = cmd && S.meta && (S.meta.commanders || []).find(c => c.name === cmd.o.name);
      if(mc && mc.recs.length){
        const names = new Set(mc.recs.map(r => r[0])); let hit = 0, tot = 0;
        for(const [o] of per){ if(isLand(o) && isBasic(o)) continue; tot++; if(names.has(o.name)) hit++; }
        metaScore = Math.min(1, (tot ? hit / tot : 0) * 1.6);
        note = `${hit} Karten aus den EDHREC-Empfehlungen für ${oName(cmd.o)}`;
      } else note = cmd ? 'Commander-Deck' : 'Kein Commander festgelegt';
    } else {
      const list = (S.meta && S.meta.formats && S.meta.formats[d.fmt]) || [];
      let bestSim = 0;
      for(const a of list){
        let inter = 0, tot = 0;
        for(const [nm, k] of a.cards || []){ const o = byName(nm); tot += k; if(o && !isBasic(o)) inter += Math.min(k, per.get(o) || 0); else if(o) inter += Math.min(k, per.get(o) || 0) * 0.3; }
        const s = tot ? inter / tot : 0;
        if(s > bestSim){ bestSim = s; arche = a; }
      }
      if(bestSim < 0.4) arche = null;
      metaScore = arche ? bestSim * ({S:1, A:0.9, B:0.8, C:0.7})[tierOf(arche.share || 0)] : 0.3;
    }
    const st = deckStats(d), warn = deckWarnings(d, st).length;
    const landShare = st.count ? st.lands / st.count : 0.4;
    const manaPen = landShare > 0.5 || landShare < 0.28 ? 15 : 0;   // viel zu viele oder zu wenige Länder
    const score = Math.max(0, Math.min(100, Math.round(100 * (0.62 * quality + 0.38 * metaScore)) - Math.min(20, warn * 6) - manaPen));
    const tier = score >= 78 ? 'S' : score >= 64 ? 'A' : score >= 50 ? 'B' : score >= 36 ? 'C' : 'D';
    const r = {score, tier, quality, arche: arche ? {name: arche.name, share: arche.share} : null, note, metaDate: S.meta && S.meta.date};
    MEMO.set(d.id, {sig, r});
    return r;
  }

  /* ---------- Spielanleitung ---------- */
  function analyze(d){
    const a = {n:0, lands:0, cre:0, removal:0, wipe:0, draw:0, ramp:0, counter:0, cmc:0, nl:0, kw:{}, top:[]};
    const list = [];
    for(const [id, k] of Object.entries(d.cards)){
      const c = S.byId.get(id); if(!c) continue; const o = c.o;
      a.n += k;
      if(isLand(o)){ a.lands += k; continue; }
      a.nl += k; a.cmc += (o.cmc || 0) * k;
      if(/\bCreature\b/.test(o.type)) a.cre += k;
      for(const r of ['removal','wipe','draw','ramp','counter']) if(role(o, r)) a[r] += k;
      for(const w of o.kw) a.kw[w] = (a.kw[w] || 0) + k;
      list.push(o);
    }
    a.avg = a.nl ? a.cmc / a.nl : 0;
    a.top = [...new Set(list)].sort((x, y) => cardScore(y, d.fmt) - cardScore(x, d.fmt)).slice(0, 5);
    a.style = a.avg <= 2.6 && a.cre >= a.nl * 0.45 ? 'aggro' : (a.removal + a.draw + a.counter + a.wipe) >= a.nl * 0.45 && a.cre <= a.nl * 0.35 ? 'control' : 'midrange';
    return a;
  }
  function guide(d){
    const a = analyze(d), cmdF = d.fmt === 'commander';
    const rec = cmdF ? {lands:[35, 38], ramp:10, draw:10, removal:8, wipe:2} : {lands:[a.style === 'aggro' ? 20 : 22, a.style === 'control' ? 27 : 25], ramp:0, draw:a.style === 'aggro' ? 2 : 4, removal:a.style === 'aggro' ? 4 : 6, wipe:a.style === 'control' ? 2 : 0};
    const plan = {
      aggro:'Schnell Druck machen: früh günstige Kreaturen ausspielen, jede Runde angreifen und den Gegner unter Zugzwang setzen, bevor er seine starken Karten spielt. Entfernungszauber nutzt du, um Blocker aus dem Weg zu räumen.',
      midrange:'Flexibel spielen: in den ersten Zügen auf effiziente Karten setzen, die gegnerischen Drohungen entfernen und dann mit deinen stärkeren Karten die Kontrolle übernehmen. Gegen schnelle Decks verteidigen, gegen langsame angreifen.',
      control:'Überleben und kontern: wichtige gegnerische Karten entfernen oder neutralisieren, Karten ziehen und erst spät mit wenigen, aber mächtigen Siegbedingungen gewinnen. Mana für Spontanzauber im gegnerischen Zug offen lassen.'
    }[a.style];
    const chk = (have, want, label) => want ? `<li>${have >= want ? '✅' : '⚠️'} <b>${label}:</b> ${have}${have < want ? ` – empfohlen mind. ${want}` : ''}</li>` : '';
    return `<div class="small" style="padding:4px 2px">
      <p><b>Spielstil: ${esc(STYLES[a.style])}</b><br>${plan}</p>
      ${cmdF && d.cmd && S.byId.get(d.cmd) ? `<p><b>Commander:</b> ${esc(cName(S.byId.get(d.cmd)))} liegt in der Kommandozone – jedes Mal, wenn du ihn von dort wirkst, kostet er {2} mehr. Baue dein Spiel um seine Fähigkeit herum.</p>` : ''}
      <p><b>Mana:</b> ${a.lands} Länder, durchschnittlicher Manawert ${a.avg.toFixed(2)}. Empfehlung: ${rec.lands[0]}–${rec.lands[1]} Länder. ${cmdF ? 'Behalte Starthände mit 3–5 Ländern oder 2 Ländern + Manastein.' : 'Behalte Starthände mit 2–4 Ländern; bei 0–1 oder 6–7 Ländern lieber Mulligan.'}</p>
      <ul style="padding-left:18px;margin:6px 0">${chk(a.ramp, rec.ramp, 'Mana-Beschleunigung')}${chk(a.draw, rec.draw, 'Kartenziehen')}${chk(a.removal, rec.removal, 'Entfernung (Removal)')}${chk(a.wipe, rec.wipe, 'Massenvernichtung')}<li>🧍 <b>Kreaturen:</b> ${a.cre}</li></ul>
      ${a.top.length ? `<p><b>Deine Schlüsselkarten:</b> ${a.top.map(o => esc(oName(o))).join(', ')} – diese Karten möglichst früh suchen und gut schützen.</p>` : ''}
      ${Object.keys(a.kw).length ? `<p class="muted tiny">Häufige Fähigkeiten: ${Object.entries(a.kw).sort((x, y) => y[1] - x[1]).slice(0, 6).map(([k, v]) => esc(k) + ' (' + v + ')').join(', ')}</p>` : ''}
    </div>`;
  }

  /* ---------- Oberfläche ---------- */
  function chips(name, opts, cur){ return `<div class="chips" style="flex-wrap:wrap">${opts.map(([v, l]) => `<button class="chip ${cur === v ? 'on' : ''}" data-act="as-set" data-k="${name}" data-v="${esc(v)}">${esc(l)}</button>`).join('')}</div>`; }
  function stars(q){ const n = Math.max(1, Math.min(5, Math.round(q * 6 - 0.4))); return '★'.repeat(n) + '☆'.repeat(5 - n); }
  function busy(text){ view.innerHTML = `<div class="boot" style="min-height:50vh"><div class="loader"></div>${esc(text)}</div>`; }
  function ownCommanders(){
    const own = ownedByOracle(), pop = new Map(((S.meta && S.meta.commanders) || []).map((c, i) => [c.name, i]));
    return [...own.keys()].map(i => S.oracle[i]).filter(canCommand).sort((a, b) => (pop.has(a.name) ? pop.get(a.name) : 999) - (pop.has(b.name) ? pop.get(b.name) : 999) || (a.edh || 1e6) - (b.edh || 1e6));
  }
  function render(){
    if(S.ui.assist === 'deck' && st.results) return renderDeckView();
    const own = ownedByOracle(), isCmd = st.fmt === 'commander';
    const cmd = st.cmd && S.byId.get(st.cmd);
    let body = '';
    if(isCmd){
      const mine = ownCommanders().slice(0, 14);
      body = `<label class="lbl">Commander</label>
        ${cmd ? `<div class="item">${cardImg(cmd, dl(), 'small', 'style="width:44px;height:61px;border-radius:5px;object-fit:cover"')}<div class="grow"><b>${esc(cName(cmd))}</b><div class="tiny muted">${colDots(ciList(cmd.o))} ${esc(cType(cmd))}</div></div><button class="chip" data-act="as-cmd">Ändern</button></div>`
          : `<button class="btn ghost block" data-act="as-cmd">👑 Commander wählen</button>`}
        ${mine.length ? `<label class="lbl">Legendäre Kreaturen aus deiner Sammlung</label><div class="chips" style="flex-wrap:wrap">${mine.map(o => `<button class="chip ${cmd && cmd.o === o ? 'on' : ''}" data-act="as-cmd-pick" data-o="${o.i}">${colDots(ciList(o))} ${esc(oName(o))}</button>`).join('')}</div>` : ''}
        <button class="btn block" style="margin-top:14px" data-act="as-run" ${cmd ? '' : 'disabled'}>✨ Deck bauen</button>`;
    } else {
      body = `<label class="lbl">Farben (leer = alle Kombinationen durchprobieren)</label><div class="chips">${colorButtons(st.cols, 'as-col', false)}</div>
        <label class="lbl">Spielstil</label>${chips('style', Object.entries(STYLES), st.style)}
        <button class="btn block" style="margin-top:14px" data-act="as-run">✨ ${st.cols.length ? 'Deck bauen' : 'Meine stärksten Decks finden'}</button>`;
    }
    view.innerHTML = `<div class="row">${backBtn()}<h1 class="grow">Deck-Assistent</h1></div>
      <div class="card"><label class="lbl" style="margin-top:0">Format</label>${chips('fmt', FMTS.map(f => [f, FORMAT_DE[f]]), st.fmt)}
        <label class="lbl">Karten</label>${chips('mode', [['owned','Nur meine Karten'],['best','Bestes Deck + Kaufvorschläge']], st.mode)}
        ${body}</div>
      <div id="as-meta"></div>`;
    renderMetaBox(own);
  }
  function renderMetaBox(own){
    const box = $('#as-meta'); if(!box) return;
    const date = S.meta && S.meta.date ? ' · Stand ' + fmtDate(S.meta.date) : '';
    if(st.fmt === 'commander'){
      const list = ((S.meta && S.meta.commanders) || []).slice(0, 25);
      if(!list.length){ box.innerHTML = `<div class="empty small">Noch keine Commander-Daten – unter „Mehr“ → Meta aktualisieren.</div>`; return; }
      box.innerHTML = `<h3>🔥 Beliebteste Commander (EDHREC${date})</h3><div class="list">${list.map((c, i) => {
        const o = byName(c.name); if(!o) return '';
        const top = c.recs.slice(0, 60); let have = 0; for(const r of top){ const x = byName(r[0]); if(x && own.get(x.i)) have++; }
        const pct = top.length ? Math.round(have / top.length * 100) : 0;
        const p = bestPrint(o);
        return `<button class="item" style="width:100%;text-align:left" data-act="as-cmd-pick" data-o="${o.i}" data-run="1">${p ? cardImg(p, dl(), 'small', 'style="width:40px;height:56px;border-radius:5px;object-fit:cover"') : ''}
          <div class="grow"><b class="ell" style="display:block">${i + 1}. ${esc(oName(o))}</b><div class="tiny muted">${colDots(ciList(o))} ${c.decks.toLocaleString('de-DE')} Decks · du hast ${pct}% der Top-Karten${own.get(o.i) ? ' · ✓ Commander im Besitz' : ''}</div>
          <div class="progress" style="margin-top:5px"><i style="width:${pct}%"></i></div></div><span class="muted">›</span></button>`; }).join('')}</div>`;
      return;
    }
    const md = metaDecks(st.fmt).sort((a, b) => (b.share || 0) - (a.share || 0));
    if(!md.length){ box.innerHTML = `<div class="empty small">Für ${esc(FORMAT_DE[st.fmt])} gibt es gerade keine Meta-Daten.</div>`; return; }
    st.meta = md; st.metaFmt = st.fmt;
    box.innerHTML = `<h3>🏆 Meta jetzt: ${esc(FORMAT_DE[st.fmt])} (MTGGoldfish${date})</h3><p class="tiny muted" style="margin-top:-4px">Die meistgespielten Turnierdecks – und wie viel davon du schon besitzt.</p><div class="list">${md.map((r, i) => `
      <button class="item" style="width:100%;text-align:left" data-act="as-meta" data-i="${i}"><div style="text-align:center;min-width:34px"><div style="font-weight:800;color:${TIER_COL[tierOf(r.share || 0)]}">${tierOf(r.share || 0)}</div><div class="tiny muted">${r.share != null ? r.share + '%' : ''}</div></div>
      <div class="grow"><b class="ell" style="display:block">${esc(r.name)}</b><div class="tiny muted">${colDots(r.cols)} du hast ${Math.round(r.cover * 100)}% · fehlt ca. ${money(r.missCost)}</div>
      <div class="progress" style="margin-top:5px"><i style="width:${Math.round(r.cover * 100)}%"></i></div></div><span class="muted">›</span></button>`).join('')}</div>`;
  }
  function renderDeckView(){
    const R = st.results, r = R[st.sel] || R[0]; if(!r){ S.ui.assist = 'wizard'; return render(); }
    const groups = {};
    for(const x of r.lines){ const g = x.cmd ? 'Commander' : mainType(x.o); (groups[g] = groups[g] || []).push(x); }
    const order = ['Commander', ...GROUP_ORDER].filter(g => groups[g]);
    const value = r.lines.reduce((s, x) => s + (x.basic ? 0 : (priceEUR(bestPrint(x.o), false) || cheapest(x.o) || 0) * x.n), 0);
    view.innerHTML = `<div class="row">${backBtn()}<h1 class="grow ell">${esc(st.title)}</h1></div>
      ${R.length > 1 ? `<div class="chips" style="flex-wrap:wrap;margin-bottom:10px">${R.map((x, i) => `<button class="chip ${i === st.sel ? 'on' : ''}" data-act="as-pick" data-i="${i}">${colDots(x.cols)} ${esc(x.name || x.cols.map(k => COLORS[k].de).join('/') || 'Farblos')}</button>`).join('')}</div>` : ''}
      <div class="hero"><div class="row between"><div><div class="lbl">${esc(r.name || (r.cmd ? cName(r.cmd) : FORMAT_DE[r.fmt] + ' · ' + STYLES[r.style]))}</div><div class="big" style="font-size:26px">${stars(r.quality)}</div></div><div class="deck-inks" style="flex-direction:row">${colDots(r.cols)}</div></div>
        <div class="stats"><div><b>${r.total}</b>Karten</div><div><b style="color:var(--good)">${r.ownedCopies}</b>im Besitz</div><div><b style="color:${r.missing.length ? 'var(--bad)' : 'var(--good)'}">${r.total - r.ownedCopies}</b>fehlen</div></div>
        <div class="tiny" style="color:#d8d4f2;margin-top:8px">Deckwert ca. ${money(value)}${r.missCost ? ` · fehlende Karten ca. ${money(r.missCost)}` : ''}${r.share ? ` · ${r.share}% der Turnierdecks` : ''}</div></div>
      ${r.short ? `<div class="warn" style="margin-bottom:10px">Mit deinen Karten komme ich auf ${r.total} von ${r.cmd ? 100 : 60}${r.cmd ? ' – unten stehen Vorschläge, was du ergänzen kannst' : ' – stell auf „Bestes Deck + Kaufvorschläge“, dann ergänze ich, was fehlt'}.</div>` : ''}
      ${r.cmd && !r.hasRecs ? `<div class="tiny muted" style="margin-bottom:8px">Keine EDHREC-Empfehlungen geladen – Auswahl nach allgemeiner Kartenstärke.</div>` : ''}
      <div class="row" style="gap:8px;margin-bottom:10px"><button class="btn grow" data-act="as-save">💾 Als Deck speichern</button>${r.missing.length ? '<button class="btn ghost" data-act="as-copy-miss">🛒 Fehlende kopieren</button>' : ''}</div>
      ${order.map(g => `<h3>${esc(g === 'Commander' ? 'Commander' : GROUP_DE[g])} <span class="muted">(${groups[g].reduce((s, x) => s + x.n, 0)})</span></h3>` + groups[g].map(x => { const c = bestPrint(x.o); return `<div class="deck-line"><b style="width:26px">${x.n}×</b>${c ? cardImg(c, dl(), 'small', `data-act="card" data-id="${esc(c.id)}"`) : ''}
        <div class="grow"><div class="ell" ${c ? `data-act="card" data-id="${esc(c.id)}"` : ''}>${esc(oName(x.o))} <span class="manacost sm">${manaHtml(x.o.mana)}</span></div>
        <div class="tiny">${x.basic ? '<span class="muted">Standardland</span>' : x.have >= x.n ? '<span style="color:var(--good)">✓ im Besitz</span>' : `<span class="miss">${x.n - x.have} fehlt</span> <span class="muted">· ${money((cheapest(x.o) || 0) * (x.n - x.have))}</span>`}</div></div></div>`; }).join('')).join('')}
      ${r.side && r.side.length ? `<h3>Sideboard</h3>` + r.side.map(x => `<div class="deck-line"><b style="width:26px">${x.n}×</b><div class="grow ell">${esc(oName(x.o))}</div><span class="gold small">${money(cheapest(x.o))}</span></div>`).join('') : ''}
      ${r.upgrades && r.upgrades.length ? `<h3>🛒 Top-Empfehlungen, die dir fehlen</h3><p class="tiny muted" style="margin-top:-4px">Laut EDHREC in vielen ${esc(cName(r.cmd))}-Decks.</p>` + r.upgrades.map(u => { const c = bestPrint(u.o); return `<div class="deck-line">${c ? cardImg(c, dl(), 'small', `data-act="card" data-id="${esc(c.id)}"`) : ''}<div class="grow"><div class="ell">${esc(oName(u.o))}</div><div class="tiny muted">in ${Math.round(u.rate * 100)}% der Decks${u.syn > 0.05 ? ` · Synergie +${Math.round(u.syn * 100)}%` : ''}</div></div><span class="gold small">${money(u.price)}</span></div>`; }).join('') : ''}`;
  }

  /* ---------- Aktionen ---------- */
  A['assist-open'] = () => { st.results = null; go({tab:'decks', deck:null, assist:'wizard'}); };
  A['as-set'] = el => { st[el.dataset.k] = el.dataset.v; render(); };
  A['as-col'] = el => { const k = el.dataset.col; st.cols = st.cols.includes(k) ? st.cols.filter(x => x !== k) : [...st.cols, k].slice(-3); render(); };
  A['as-cmd'] = () => {
    const own = ownedByOracle();
    openSearch('Commander wählen', o => { const c = bestPrint(o); if(!c) return; st.cmd = c.id; closeSheet(); render(); }, o => canCommand(o) && legalIn(o, 'commander'),
      `<p class="tiny muted" style="margin-top:-6px">Ohne Suche siehst du deine eigenen legendären Kreaturen.</p>`);
  };
  A['as-cmd-pick'] = el => { const o = S.oracle[+el.dataset.o]; const c = o && bestPrint(o); if(!c) return; st.cmd = c.id; st.fmt = 'commander'; if(el.dataset.run) A['as-run'](); else render(); };
  A['as-cmd-from'] = el => { const c = S.byId.get(el.dataset.id); if(!c) return; closeSheet(); st.cmd = c.id; st.fmt = 'commander'; S.ui.tab = 'decks'; A['as-run'](); };
  A['as-run'] = async () => {
    busy(st.fmt === 'commander' ? 'Suche die besten Karten für deinen Commander …' : 'Baue Decks aus deinen Karten …');
    await sleep(40);
    try{
      if(st.fmt === 'commander'){
        const cmd = S.byId.get(st.cmd); if(!cmd){ render(); return; }
        st.results = [await buildCommander(cmd, st.mode)]; st.title = (st.mode === 'owned' ? 'Dein Deck: ' : 'Bestes Deck: ') + cName(cmd);
      } else if(st.cols.length){
        st.results = [buildConstructed(st.cols, st.style, st.fmt, st.mode)]; st.title = FORMAT_DE[st.fmt] + ' · ' + st.cols.map(k => COLORS[k].de).join('/');
      } else {
        const combos = [];
        for(let i = 0; i < 5; i++){ combos.push([COLOR_KEYS[i]]); for(let j = i + 1; j < 5; j++) combos.push([COLOR_KEYS[i], COLOR_KEYS[j]]); }
        const res = [];
        for(const cols of combos){ res.push(buildConstructed(cols, st.style, st.fmt, st.mode)); await sleep(0); }
        const rank = r => st.mode === 'owned' ? r.quality * 0.55 + (r.ownedCopies / 60) * 0.45 : r.quality;
        st.results = res.sort((a, b) => rank(b) - rank(a)).slice(0, 5); st.title = 'Deine stärksten ' + FORMAT_DE[st.fmt] + '-Decks';
      }
      st.sel = 0;
      if(S.ui.assist === 'deck'){ render(); window.scrollTo(0, 0); } else go({tab:'decks', deck:null, assist:'deck'});
    }catch(e){ console.warn(e); toast('Fehler: ' + e.message, 4000); S.ui.assist = 'wizard'; render(); }
  };
  A['as-pick'] = el => { st.sel = +el.dataset.i; render(); };
  A['as-meta'] = el => {
    const r = st.meta && st.meta[+el.dataset.i]; if(!r) return;
    st.results = [r]; st.sel = 0; st.title = r.name; go({assist:'deck'});
  };
  A['as-save'] = async () => {
    const r = st.results[st.sel]; if(!r) return;
    const name = await promptText('Deck speichern', r.name || st.title.replace(/^(Dein|Bestes) Deck: /, '')); if(!name) return;
    const d = newDeck(name, r.fmt || st.fmt); d.src = 'assist';
    for(const x of r.lines){ const c = bestPrint(x.o); if(!c) continue; d.cards[c.id] = (d.cards[c.id] || 0) + x.n; if(x.cmd) d.cmd = c.id; }
    for(const x of r.side || []){ const c = bestPrint(x.o); if(c) d.side[c.id] = (d.side[c.id] || 0) + x.n; }
    persist(); toast('Deck gespeichert ✓'); go({tab:'decks', deck:d.id, assist:null});
  };
  A['as-copy-miss'] = () => {
    const r = st.results[st.sel]; if(!r) return;
    const t = r.missing.map(m => `${m.n} ${m.o.name}`).join('\n');
    if(NATIVE) NATIVE.copyText(t); else navigator.clipboard && navigator.clipboard.writeText(t);
    toast('Kopiert – auf Cardmarket unter „Wants“ einfügen');
  };
  /* Verbesserungen für ein bestehendes Deck */
  A['deck-improve'] = async () => {
    const d = currentDeck(); if(!d) return;
    openSheet(`<div class="boot" style="min-height:200px"><div class="loader"></div>Suche Verbesserungen …</div>`);
    const own = ownedByOracle(), inDeck = new Set(Object.keys(d.cards).map(id => S.byId.get(id)).filter(Boolean).map(c => c.o));
    const filt = deckFilter(d), cmd = d.cmd && S.byId.get(d.cmd);
    let sugg = [];
    if((d.fmt === 'commander' || d.fmt === 'brawl') && cmd){
      const recs = await recsFor(cmd.o.name);
      for(const [name, v] of recs){ const o = byName(name); if(!o || inDeck.has(o) || !filt(o) || isBasic(o)) continue; sugg.push({o, s: 0.35 + v.rate * 0.6 + Math.max(0, v.syn) * 0.5, why: `in ${Math.round(v.rate * 100)}% der ${oName(cmd.o)}-Decks`}); }
    } else {
      const cols = deckStats(d).cols;
      const metaArch = (rateDeck(d) || {}).arche;
      const a = metaArch && ((S.meta.formats || {})[d.fmt] || []).find(x => x.name === metaArch.name);
      const inArch = new Map(); if(a) for(const [n, k] of a.cards) { const o = byName(n); if(o) inArch.set(o, k); }
      for(const o of S.oracle){
        if(inDeck.has(o) || isBasic(o) || !filt(o) || (cols.length && !ciList(o).every(k => cols.includes(k)))) continue;
        const s = cardScore(o, d.fmt) + (inArch.has(o) ? 0.5 : 0);
        if(s > 0.45) sugg.push({o, s, why: inArch.has(o) ? `steht in ${metaArch.name}` : 'starke Karte in deinen Farben'});
      }
    }
    sugg.sort((x, y) => (own.get(y.o.i) ? 0.3 : 0) + y.s - ((own.get(x.o.i) ? 0.3 : 0) + x.s));
    sugg = sugg.slice(0, 30);
    openSheet(`<h2>✨ Verbesserungen für „${esc(d.name)}“</h2><p class="muted small">Karten mit ✓ hast du schon – die kannst du direkt einbauen.</p>
      <div class="list">${sugg.map(x => { const c = bestPrint(x.o); return `<div class="item">${c ? cardImg(c, dl(), 'small', `style="width:38px;height:53px;border-radius:5px;object-fit:cover" data-act="card" data-id="${esc(c.id)}"`) : ''}
        <div class="grow"><b class="ell" style="display:block">${own.get(x.o.i) ? '✓ ' : ''}${esc(oName(x.o))}</b><div class="tiny muted ell">${esc(x.why)} · ${own.get(x.o.i) ? 'im Besitz' : money(cheapest(x.o))}</div></div>
        <button class="chip" data-act="as-add" data-o="${x.o.i}">＋</button></div>`; }).join('') || '<div class="empty">Keine Vorschläge gefunden.</div>'}</div>`);
  };
  A['as-add'] = el => {
    const d = currentDeck(), o = S.oracle[+el.dataset.o]; if(!d || !o) return;
    const c = bestPrint(o); if(!c) return;
    if(deckCount(d, o) >= maxCopies(o, d.fmt)){ toast('Schon so oft im Deck wie erlaubt'); return; }
    d.cards[c.id] = (d.cards[c.id] || 0) + 1; persist(); el.textContent = '✓'; el.disabled = true; toast(oName(o) + ' hinzugefügt'); refreshBehindSheet();
  };

  return {render, rateDeck, guide, analyze, state: st, reset(){ MF = {}; NAMES = null; MEMO = new Map(); st.meta = null; }};
})();
window.ASSIST = ASSIST;
