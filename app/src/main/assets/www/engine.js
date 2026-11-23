'use strict';
/* =========================================================
   Magic the Foxering – Erkennung: Texterkennung → Karte (DE/EN)
   Liest den Kartennamen (oben) und unten links Sammlernummer,
   Set-Kürzel und Sprache, z. B. „0123 R“ + „MH3 • DE“ oder „123/274 R“.
   ========================================================= */
const ENGINE = (() => {
  let IDX = null;

  function norm(s){
    return String(s || '').toUpperCase()
      .replace(/Ä/g,'A').replace(/Ö/g,'O').replace(/Ü/g,'U').replace(/ß/g,'SS')
      .normalize('NFD').replace(/[̀-ͯ]/g,'')
      .replace(/[^A-Z0-9]+/g,' ').trim();
  }
  // Bigramme als sortierte Zahlenliste (spart Speicher bei ~60.000 Namen)
  function cc(ch){ const x = ch.charCodeAt(0); return x >= 65 && x <= 90 ? x - 64 : x >= 48 && x <= 57 ? x - 21 : 0; }
  function bg(s){
    const t = s.replace(/ /g, ''); const a = [];
    for(let i = 0; i < t.length - 1; i++) a.push(cc(t[i]) * 64 + cc(t[i + 1]));
    if(t.length === 1) a.push(cc(t));
    return Int32Array.from(a.sort((x, y) => x - y));
  }
  function dice(A, B){
    if(!A.length || !B.length) return 0;
    let i = 0, j = 0, inter = 0;
    while(i < A.length && j < B.length){ if(A[i] === B[j]){ inter++; i++; j++; } else if(A[i] < B[j]) i++; else j++; }
    return 2 * inter / (A.length + B.length);
  }
  function sim(e, line){
    if(line.n === e.n) return 1;
    if(line.n.length > e.n.length + 1 && e.n.length >= 5 && (' ' + line.n + ' ').includes(' ' + e.n + ' ')) return 0.94;
    return dice(e.bg, line.bg);
  }

  function build(){
    const names = new Map(), full = new Map(), byKey = new Map();
    const addName = (txt, oi, L) => {
      const nn = norm(txt); if(nn.length < 2) return;
      let e = names.get(nn);
      if(!e){ e = {n:nn, bg:bg(nn), os:new Set(), langs:new Set()}; names.set(nn, e); }
      e.os.add(oi); e.langs.add(L);
      if(!full.has(nn)) full.set(nn, new Set()); full.get(nn).add(oi);
    };
    for(const o of S.oracle){
      for(const [txt, L] of [[o.name, 'en'], [o.de, 'de']]){
        if(!txt) continue;
        addName(txt, o.i, L);
        if(txt.includes(' // ')) for(const part of txt.split(' // ')) addName(part, o.i, L);
      }
    }
    for(const c of S.cards) byKey.set(c.s + ':' + String(c.n).toLowerCase(), c);
    const list = [...names.values()];
    IDX = {names:list, full, byKey};
    return IDX;
  }
  function idx(){ return IDX || build(); }

  /* Unten links: Sammlernummer, Seltenheit, Set-Kürzel und Sprache */
  const LANGS = {EN:'en', DE:'de', FR:'fr', IT:'it', ES:'es', SP:'es', PT:'pt', JA:'ja', JP:'ja', KO:'ko', RU:'ru', CS:'zhs', CT:'zht', ZHS:'zhs', ZHT:'zht', PH:'ph'};
  function parseCollector(lines, h){
    const bottom = lines.filter(l => !h || l.y == null || l.y > h * 0.72);
    const pool = bottom.length ? bottom : lines;
    let set = '', lang = '', num = '';
    for(const l of pool){
      const t = ' ' + String(l.t || '').toUpperCase().replace(/[•·∙●◆*|]/g, ' • ') + ' ';
      // Set + Sprache: "MH3 • DE", "M20 * EN", "DMU-EN"
      const sm = t.match(/[\s(]([A-Z0-9]{3,5})\s*(?:•|\.|,|-|\+|:)?\s*(EN|DE|FR|IT|ES|SP|PT|JA|JP|KO|RU|CS|CT|ZHS|ZHT|PH)\b/);
      if(sm && S.sets[sm[1].toLowerCase()] && !set){ set = sm[1].toLowerCase(); lang = LANGS[sm[2]] || ''; }
      if(!num){
        // Alt: "123/274 R"  ·  Neu: "0123 R" oder "R 0123"
        const fix = t.replace(/(\d)O/g, '$10').replace(/O(\d)/g, '0$1');
        let m = fix.match(/\b(\d{1,4}[A-Z★]?)\s*[\/⁄]\s*\d{2,4}\b/)
          || fix.match(/\b(\d{3,4}[A-Z]?)\s+[CURMLSTPB]\b/) || fix.match(/\b[CURMLSTPB]\s+(\d{3,4}[A-Z]?)\b/);
        if(m) num = m[1].replace(/^0+(?=\d)/, '').toLowerCase();
      }
    }
    if(!set && !num) return null;
    return {set, lang, num};
  }

  /* Die besten Namens-Treffer für die oberen Zeilen der Karte */
  function nameCandidates(nameLines){
    const I = idx(), cand = new Map();
    for(const l of nameLines){
      const len = l.n.replace(/ /g, '').length;
      for(const e of I.names){
        const el = e.n.length;
        if(l.n !== e.n && (el > len + Math.max(4, len * 0.45) + 2 || el < len - Math.max(4, len * 0.45))) continue;
        const s = sim(e, l);
        if(s < 0.62) continue;
        for(const oi of e.os){
          const prev = cand.get(oi);
          if(!prev || s > prev.s) cand.set(oi, {o:S.oracle[oi], s, langs:e.langs, n:e.n});
        }
      }
    }
    return [...cand.values()].sort((a, b) => b.s - a.s);
  }

  function preferPrinting(cards){
    const good = t => /^(expansion|core|masters|draft_innovation|commander|starter|duel_deck|planechase|archenemy|from_the_vault|spellbook|premium_deck)$/.test(t);
    return [...cards].sort((a, b) => {
      const sa = (a.fl & 3 ? 1 : 0) + (good((S.sets[a.s] || {}).type) ? 0 : 2) + (a.fin & 1 ? 0 : 1);
      const sb = (b.fl & 3 ? 1 : 0) + (good((S.sets[b.s] || {}).type) ? 0 : 2) + (b.fin & 1 ? 0 : 1);
      if(sa !== sb) return sa - sb;
      return ((S.sets[b.s] || {}).release || '').localeCompare((S.sets[a.s] || {}).release || '');
    })[0];
  }
  function printings(c){ return (S.byOracle.get(c.o.i) || []).slice(); }

  /**
   * res: {lines:[{t,x,y,w,h}], w, h} aus der Texterkennung
   * Rückgabe: null | {empty:true} | {c, lang, strong, ambiguous, score}
   */
  function identify(res, opts={}){
    const I = idx();
    const raw = ((res && res.lines) || []).filter(l => String(l.t || '').trim());
    if(raw.length < 2) return {empty:true};
    const H = res.h || 0;
    const lines = raw.map(l => {
      // Manasymbole werden oft als Zeichen am Zeilenende gelesen: kurze Reste abschneiden
      let n = norm(l.t).replace(/^\d{1,2}\s+/, '');
      n = n.replace(/(\s+[A-Z0-9]{1,2})+$/, '') || n;
      return {n, bg: bg(n), y: l.y, t: l.t};
    }).filter(l => l.n.length >= 3);
    if(!lines.length) return {empty:true};

    // Name steht oben: nach Höhe sortieren und die obersten Zeilen nehmen
    const withY = lines.filter(l => l.y != null);
    let nameLines = withY.length >= lines.length * 0.7 && H
      ? withY.filter(l => l.y < H * 0.22).sort((a, b) => a.y - b.y).slice(0, 3)
      : lines.slice(0, 3);
    if(!nameLines.length) nameLines = lines.slice(0, 3);

    const col = parseCollector(raw, H);
    const cand = nameCandidates(nameLines);
    const top = cand[0];
    let pick = null, strong = false, ambiguous = false, L = null;

    // 1) Set + Nummer gelesen → genauer Druck
    if(col && col.set && col.num){
      const p = I.byKey.get(col.set + ':' + col.num);
      if(p){
        const hit = cand.find(x => x.o === p.o);
        if(hit && hit.s >= 0.62){ pick = p; strong = hit.s >= 0.75; L = hit; }
        else if(!top || top.s < 0.7){
          // Name unleserlich (z. B. Spiegelung) – Nummer passt zu einer Karte, prüfe grob alle Zeilen
          const n2 = norm(p.o.name), d2 = norm(p.o.de), b2 = bg(n2), b3 = d2 ? bg(d2) : null;
          const s = Math.max(...lines.map(l => Math.max(dice(b2, l.bg), b3 ? dice(b3, l.bg) : 0)));
          // oder: ein markantes Wort des Namens steht irgendwo im Text
          const all = ' ' + lines.map(l => l.n).join(' ') + ' ';
          const word = (n2 + ' ' + d2).split(' ').some(w => w.length >= 5 && all.includes(' ' + w + ' '));
          if(s >= 0.55 || word){ pick = p; strong = false; }
        }
      }
    }
    // 2) Nur das Set gelesen → Druck dieser Karte im Set
    if(!pick && top && top.s >= 0.78 && col && col.set){
      const inSet = (S.byOracle.get(top.o.i) || []).filter(c => c.s === col.set);
      if(inSet.length){
        const byNum = col.num ? inSet.find(c => String(c.n).toLowerCase() === col.num) : null;
        pick = byNum || preferPrinting(inSet); L = top;
        strong = !!byNum || (inSet.length === 1 && top.s >= 0.9);
        ambiguous = !byNum && inSet.length > 1;
      }
    }
    // 3) Nur über den Namen
    if(!pick && top){
      if(top.s < 0.78) return null;
      const rival = cand.find(x => x.o !== top.o && x.s > top.s - 0.06);
      if(rival) return null;
      const prints = S.byOracle.get(top.o.i) || [];
      if(!prints.length) return null;
      pick = preferPrinting(prints); L = top; ambiguous = prints.length > 1;
      strong = false;
    }
    if(!pick) return null;
    // Bundle-Scan: gleichen Namen bevorzugt im Set des Bundles suchen (nicht wenn Set+Nummer gelesen wurden)
    const pref = opts && opts.prefer;
    if(pref && pick.s !== pref.main && !(col && col.set && col.num && pick.s === col.set)){
      const all = S.byOracle.get(pick.o.i) || [], main = pref.main;
      const inMain = main ? all.filter(c => c.s === main) : [];
      const inPref = inMain.length ? inMain : all.filter(c => pref.has(c.s));
      if(inPref.length){ pick = preferPrinting(inPref); ambiguous = inPref.length > 1; }
    }

    // Sprache
    let lang = '';
    if(col && col.lang) lang = col.lang;
    else if(L && pick.o.de && norm(pick.o.de) !== norm(pick.o.name)){
      const deN = norm(pick.o.de), deF = norm(pick.o.de.split(' // ')[0]);
      lang = L.n === deN || L.n === deF ? 'de' : 'en';
    }
    const sl = S.settings.scanLang;
    if(sl !== 'auto') lang = sl;
    if(!lang) lang = S.settings.defaultLang;
    return {c: pick, lang, strong, ambiguous, score: L ? L.s : 0.6, col};
  }

  /* Name → Karte (für Decklisten und CSV). Rückgabe: Oracle-Objekt oder null */
  function findByName(text){
    const I = idx();
    const k = norm(String(text).replace(/\s*\(.*$/, ''));
    if(!k) return null;
    const ex = I.full.get(k);
    if(ex) return S.oracle[[...ex][0]];
    const tb = bg(k); let best = null, bs = 0;
    for(const e of I.names){ if(Math.abs(e.n.length - k.length) > 6) continue; const s = dice(tb, e.bg); if(s > bs){ bs = s; best = e; } }
    return bs >= 0.86 ? S.oracle[[...best.os][0]] : null;
  }

  /* Deckliste: "4 Lightning Bolt", "4x Blitzschlag", MTG-Arena/Moxfield: "1 Sol Ring (CMM) 400 *F*" */
  function parseDecklist(text){
    const ok = [], bad = []; let sec = 'main';
    for(const raw of String(text || '').split(/\r?\n/)){
      const line = raw.trim();
      if(!line){ if(ok.length && sec === 'main') sec = 'side'; continue; }
      if(/^(#|\/\/)/.test(line)) continue;
      const hd = line.replace(/:$/, '').toLowerCase();
      if(/^(deck|main ?deck|mainboard|maybeboard)$/.test(hd)){ sec = 'main'; continue; }
      if(/^(sideboard|side)$/.test(hd)){ sec = 'side'; continue; }
      if(/^(commander|kommandeur)$/.test(hd)){ sec = 'cmd'; continue; }
      if(/^(companion|begleiter)$/.test(hd)){ sec = 'side'; continue; }
      let m = line.match(/^(\d+)\s*[x×]?\s+(.+)$/i);
      const n = m ? +m[1] : 1; let rest = m ? m[2] : line;
      const foil = /\*F\*|\(F\)|\bfoil\b/i.test(rest);
      rest = rest.replace(/\*[A-Z]+\*/gi, '').trim();
      let print = null;
      const pm = rest.match(/^(.+?)\s+\(([A-Za-z0-9]{2,6})\)\s+([A-Za-z0-9★\-]+)\s*$/) || rest.match(/^(.+?)\s+\[([A-Za-z0-9]{2,6})(?::([A-Za-z0-9★\-]+))?\]\s*$/);
      if(pm){ rest = pm[1]; if(pm[3]) print = S.byId.get(pm[2].toLowerCase() + ':' + pm[3].toLowerCase()) || S.byId.get(pm[2].toLowerCase() + ':' + pm[3]); }
      const o = print ? print.o : findByName(rest);
      if(!o){ bad.push(line); continue; }
      if(print && print.o !== o) print = null;
      ok.push({o, c: print, n, foil, sec});
    }
    return {ok, bad};
  }

  /* CSV lesen (Komma, Semikolon oder Tab) */
  function parseCSV(text){
    const first = text.split(/\r?\n/)[0] || '';
    const sep = (first.match(/;/g) || []).length > (first.match(/,/g) || []).length ? ';' : (first.includes('\t') ? '\t' : ',');
    const rows = []; let row = [], cur = '', q = false;
    for(let i = 0; i < text.length; i++){
      const ch = text[i];
      if(q){
        if(ch === '"'){ if(text[i+1] === '"'){ cur += '"'; i++; } else q = false; }
        else cur += ch;
      } else if(ch === '"') q = true;
      else if(ch === sep){ row.push(cur); cur = ''; }
      else if(ch === '\n'){ row.push(cur); rows.push(row); row = []; cur = ''; }
      else if(ch !== '\r') cur += ch;
    }
    if(cur || row.length){ row.push(cur); rows.push(row); }
    return rows.filter(r => r.some(x => String(x).trim()));
  }

  return { norm, identify, printings, findByName, parseDecklist, parseCSV, preferPrinting, parseCollector, reset(){ IDX = null; }, build };
})();
window.ENGINE = ENGINE;
