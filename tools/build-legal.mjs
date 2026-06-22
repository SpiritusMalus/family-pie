#!/usr/bin/env node
/**
 * build-legal.mjs — generate the static legal pages for family-pie.ru.
 *
 * DEV TOOL ONLY — never deployed. Reads data/products.json + content/<dir>/*.md
 * (the legal canon mirrored from the app repos) and writes, per product:
 *   site/<id>/legal.html    (entry; Terms tab active)
 *   site/<id>/terms.html     (Terms tab active)
 *   site/<id>/privacy.html   (Privacy tab active)
 *   site/<id>/<MD files>      (raw markdown, for the <noscript> fallback)
 *
 * One page holds BOTH documents (client-side tabs) × BOTH languages (RU/EN
 * toggle, persisted in localStorage 'fp_lang' — same key as the landing).
 * The three entry files differ only in the initially-active tab + <title>/
 * canonical, so deep-links /terms and /privacy are real URLs while switching
 * stays instant and reload-free. No build step ships: the OUTPUT is static.
 *
 * Run:  node tools/build-legal.mjs        (from repo root)
 */
import { readFileSync, writeFileSync, mkdirSync, copyFileSync, existsSync } from 'node:fs';
import { dirname, basename, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const r = (p) => resolve(ROOT, p);

const products = JSON.parse(readFileSync(r('data/products.json'), 'utf8')).products;

/* per-language UI strings for the legal pages */
const T = {
  ru: {
    terms: 'Оферта', privacy: 'Конфиденциальность',
    studio: 'family-pie', backToStudio: '← family-pie',
    onThisPage: 'На этой странице', pendingTitle: 'Перевод готовится',
    pendingBody: 'Русская версия этого документа ещё готовится. Пока доступна версия на другом языке — переключите язык в шапке.',
    disclaimerFallback: 'Черновик. Не является юридической консультацией.',
    rawText: 'Текст документа без оформления',
    langName: 'Русский'
  },
  en: {
    terms: 'Terms', privacy: 'Privacy',
    studio: 'family-pie', backToStudio: '← family-pie',
    onThisPage: 'On this page', pendingTitle: 'Translation in progress',
    pendingBody: 'The English version of this document is still being prepared. A version in the other language is available — switch the language in the header.',
    disclaimerFallback: 'Draft. This is not legal advice.',
    rawText: 'Plain-text version',
    langName: 'English'
  }
};

/* ---------- tiny, safe markdown subset → structured model ---------- */
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inline(s) {
  let h = esc(s);
  // links [text](url) first, so their brackets aren't flagged as placeholders
  h = h.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
    (_, t, u) => `<a href="${u.replace(/"/g, '&quot;')}" rel="noopener">${t}</a>`);
  h = h.replace(/`([^`]+)`/g, '<code>$1</code>');
  h = h.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // owner-fill placeholders: any remaining [...] (INSERT / ДАТА / 13 / 16 / Operator notes)
  h = h.replace(/\[([^\]]+)\]/g, '<mark class="ph">[$1]</mark>');
  return h;
}

/** strip a leading "N. " from a heading so we can apply our own mono numbering */
const stripNum = (s) => s.replace(/^\s*\d+\.\s+/, '');

function parse(md) {
  const lines = md.replace(/\r\n/g, '\n').split('\n');
  const model = { h1: '', meta: [], disclaimer: [], sections: [] };
  let i = 0;
  // H1
  while (i < lines.length && !lines[i].startsWith('# ')) i++;
  if (i < lines.length) { model.h1 = lines[i].slice(2).trim(); i++; }
  // skip blank lines after the H1
  while (i < lines.length && lines[i].trim() === '') i++;
  // meta block: the first contiguous non-blank block after H1 (the **key:** value header),
  // as long as it isn't the disclaimer (>) or a section (##)
  while (i < lines.length && lines[i].trim() && !lines[i].startsWith('>') && !lines[i].startsWith('## ')) {
    model.meta.push(inline(lines[i].trim())); i++;
  }
  // collect everything else into sections; lead text (before first ##) → synthetic "intro" section
  let cur = { id: 'intro', num: 0, title: '', blocks: [] };
  const flush = () => { if (cur.title || cur.blocks.length) model.sections.push(cur); };
  let para = [];
  let list = null;
  let disc = [];
  const flushPara = () => { if (para.length) { cur.blocks.push({ t: 'p', html: inline(para.join(' ')) }); para = []; } };
  const flushList = () => { if (list) { cur.blocks.push(list); list = null; } };
  // a blockquote disclaimer is one paragraph per contiguous run of `>` lines (blank `>` = new para)
  const flushDisc = () => { if (disc.length) { model.disclaimer.push(inline(disc.join(' '))); disc = []; } };

  for (; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (line.startsWith('## ')) {
      flushPara(); flushList(); flushDisc(); flush();
      cur = { id: '', num: model.sections.filter(s => s.num > 0).length + 1, title: stripNum(line.slice(3).trim()), blocks: [] };
      continue;
    }
    if (trimmed.startsWith('>')) {
      flushPara(); flushList();
      const qt = trimmed.replace(/^>\s?/, '');
      if (qt === '') flushDisc(); else disc.push(qt);
      continue;
    }
    if (trimmed === '') { flushPara(); flushList(); flushDisc(); continue; }
    if (/^[-*]\s+/.test(trimmed)) {
      flushPara();
      if (!list) list = { t: 'ul', items: [] };
      list.items.push(inline(trimmed.replace(/^[-*]\s+/, ''))); continue;
    }
    // continuation of a list item (indented wrap) or a paragraph
    if (list && /^\s+/.test(line)) { list.items[list.items.length - 1] += ' ' + inline(trimmed); continue; }
    flushList();
    para.push(trimmed);
  }
  flushPara(); flushList(); flushDisc(); flush();

  // assign ids to numbered sections
  model.sections.forEach((s) => { if (s.num > 0) s.id = 's' + s.num; });
  return model;
}

function sectionsHTML(model, docKey) {
  let out = '';
  for (const s of model.sections) {
    const body = s.blocks.map((b) => {
      if (b.t === 'ul') return '<ul>' + b.items.map((x) => `<li>${x}</li>`).join('') + '</ul>';
      return `<p>${b.html}</p>`;
    }).join('\n');
    if (s.num === 0) { out += `<div class="lead">${body}</div>\n`; continue; }
    out += `<section class="sec" id="${docKey}-${s.id}">` +
      `<h2><span class="sec-no">${String(s.num).padStart(2, '0')}</span>${esc(s.title)}</h2>${body}</section>\n`;
  }
  return out;
}

function tocHTML(model, docKey) {
  const items = model.sections.filter((s) => s.num > 0)
    .map((s) => `<a href="#${docKey}-${s.id}" data-spy="${docKey}-${s.id}"><span class="toc-no">${String(s.num).padStart(2, '0')}</span>${esc(s.title)}</a>`)
    .join('');
  return items;
}

/** a full document column (one doc, one lang) — or a pending placeholder */
function docColumn(model, docKey, lang) {
  const t = T[lang];
  if (!model) {
    return `<article class="doc" data-doc="${docKey}" data-lang="${lang}" hidden>` +
      `<div class="doc-main"><div class="pending"><h2>${t.pendingTitle}</h2><p>${t.pendingBody}</p></div></div></article>`;
  }
  const disc = model.disclaimer.length
    ? `<div class="disclaimer" role="note">${model.disclaimer.map((d) => `<p>${d}</p>`).join('')}</div>`
    : '';
  const meta = model.meta.length ? `<div class="meta">${model.meta.map((m) => `<p>${m}</p>`).join('')}</div>` : '';
  return `<article class="doc" data-doc="${docKey}" data-lang="${lang}" hidden>` +
    `<nav class="toc" aria-label="${t.onThisPage}"><div class="toc-h">${t.onThisPage}</div>${tocHTML(model, docKey)}</nav>` +
    `<div class="doc-main">` +
      `<h1>${esc(model.h1)}</h1>${meta}${disc}` +
      `<div class="doc-body">${sectionsHTML(model, docKey)}</div>` +
    `</div></article>`;
}

const PALETTE_BG = '#F4F1EA', INK = '#1B1A17';

function page(product, initialDoc, models, rawLinks) {
  const id = product.id, accent = product.accent, accentText = product.accentText || product.accent;
  const titleByDoc = { terms: { ru: 'Оферта', en: 'Terms of Use' }, privacy: { ru: 'Политика конфиденциальности', en: 'Privacy Policy' } };
  const defLang = product.appLanguage || 'ru';
  const pageTitleEn = `${product.name} — ${initialDoc === 'terms' ? 'Terms of Use' : initialDoc === 'privacy' ? 'Privacy Policy' : 'Legal'}`;

  // build all four columns
  const cols =
    docColumn(models.terms.ru, 'terms', 'ru') + docColumn(models.terms.en, 'terms', 'en') +
    docColumn(models.privacy.ru, 'privacy', 'ru') + docColumn(models.privacy.en, 'privacy', 'en');

  const rawNoscript = ['ru', 'en'].flatMap((lng) =>
    ['terms', 'privacy'].filter((d) => rawLinks[d] && rawLinks[d][lng]).map((d) =>
      `<a href="${rawLinks[d][lng]}">${titleByDoc[d][lng]} (${T[lng].langName})</a>`)).join(' · ');

  return `<!DOCTYPE html>
<html lang="${defLang}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(pageTitleEn)} — family-pie</title>
<meta name="description" content="${esc(product.name)} — ${initialDoc === 'privacy' ? 'privacy policy' : 'terms of use'} (draft). Central legal host for the family-pie app studio.">
<meta name="robots" content="index,follow">
<link rel="canonical" href="https://family-pie.ru/${id}/${initialDoc}">
<meta property="og:title" content="${esc(pageTitleEn)}">
<meta property="og:description" content="${esc(product.name)} — ${initialDoc === 'privacy' ? 'privacy policy' : 'terms of use'} (draft). Central legal host for the family-pie app studio.">
<meta property="og:type" content="article">
<meta property="og:url" content="https://family-pie.ru/${id}/${initialDoc}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Space+Mono:wght@400;700&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root{--accent:${accent};--accent-text:${accentText};--bg:${PALETTE_BG};--ink:${INK};--muted:#6b655c;--subtle:#736d5f;--line:#E4DDCE;--paper:#FBF9F4}
  *{box-sizing:border-box;margin:0;padding:0}
  html{scroll-behavior:smooth}
  body{background:var(--bg);color:var(--ink);font-family:'Manrope',sans-serif;-webkit-font-smoothing:antialiased;line-height:1.6}
  a{color:inherit}
  .topbar{position:sticky;top:0;z-index:40;background:rgba(244,241,234,.9);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}
  .topbar-in{max-width:1080px;margin:0 auto;display:flex;align-items:center;gap:22px;padding:16px 40px;flex-wrap:wrap}
  .home{display:flex;align-items:center;gap:11px;text-decoration:none;font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:17px}
  .home .dot{width:22px;height:22px;border-radius:7px;background:var(--accent);flex:none}
  .tabs{display:flex;gap:6px;background:#EAE4D7;border-radius:999px;padding:4px}
  .tab{font-family:'Space Mono',monospace;font-size:12px;letter-spacing:.06em;text-transform:uppercase;border:none;cursor:pointer;background:transparent;color:var(--muted);padding:8px 16px;border-radius:999px;transition:background .2s,color .2s}
  .tab[aria-selected="true"]{background:var(--accent);color:#fff}
  .spacer{flex:1}
  .langtoggle{display:flex;border:1px solid var(--ink);border-radius:999px;overflow:hidden;font-family:'Space Mono',monospace;font-size:12px}
  .langtoggle button{font-family:inherit;font-size:12px;letter-spacing:.08em;padding:7px 14px;border:none;cursor:pointer;background:transparent;color:var(--ink)}
  .langtoggle button.on{background:var(--ink);color:#fff}
  .wrap{max-width:1080px;margin:0 auto;padding:48px 40px 96px;display:grid;grid-template-columns:240px minmax(0,1fr);gap:56px;align-items:start}
  .doc{display:contents}
  .doc[hidden]{display:none}
  .toc{grid-column:1;position:sticky;top:90px;font-size:13.5px}
  .toc-h{font-family:'Space Mono',monospace;font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--subtle);margin-bottom:14px}
  .toc a{display:flex;gap:10px;text-decoration:none;color:var(--muted);padding:5px 0;line-height:1.35;transition:color .2s}
  .toc a:hover{color:var(--ink)}
  .toc a.active{color:var(--accent-text);font-weight:600}
  .toc-no{font-family:'Space Mono',monospace;font-size:11px;color:var(--subtle);flex:none;padding-top:1px}
  .toc a.active .toc-no{color:var(--accent-text)}
  .doc-main{grid-column:2;min-width:0;max-width:720px}
  .doc-body{background:var(--paper);border:1px solid var(--line);border-radius:18px;padding:14px 40px 40px}
  h1{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:38px;line-height:1.1;letter-spacing:-.02em;margin-bottom:18px}
  .meta{font-size:14px;color:var(--muted);margin-bottom:20px}
  .meta p{margin:2px 0}
  .disclaimer{background:#fff5e6;border:1px solid #f0d9a8;border-left:4px solid var(--accent);border-radius:12px;padding:16px 20px;margin-bottom:26px;font-size:14.5px;color:#6a5a36}
  .disclaimer p+p{margin-top:8px}
  .lead{padding-top:26px;font-size:17px;color:#3a382f}
  .lead p+p{margin-top:14px}
  .sec{padding-top:34px;scroll-margin-top:84px}
  .sec h2{font-family:'Space Grotesk',sans-serif;font-weight:700;font-size:21px;letter-spacing:-.01em;margin-bottom:12px;display:flex;gap:14px;align-items:baseline}
  .sec-no{font-family:'Space Mono',monospace;font-size:13px;color:var(--accent-text);flex:none}
  .sec p,.lead p{margin-bottom:0}
  .sec p+p{margin-top:13px}
  .sec ul{margin:13px 0 0;padding-left:22px}
  .sec li{margin:7px 0}
  .doc-body p,.doc-body li{font-size:15.5px;color:#33312b}
  code{font-family:'Space Mono',monospace;font-size:.92em;background:#ece6d8;padding:1px 5px;border-radius:5px}
  mark.ph{background:#ffe9a8;color:#6a5320;border-radius:4px;padding:0 4px;font-weight:600;font-size:.95em}
  .pending{background:var(--paper);border:1px dashed var(--line);border-radius:18px;padding:48px 40px;text-align:center;color:var(--muted)}
  .pending h2{font-family:'Space Grotesk',sans-serif;font-size:22px;color:var(--ink);margin-bottom:10px}
  .foot{max-width:1080px;margin:0 auto;padding:30px 40px;border-top:1px solid var(--line);font-family:'Space Mono',monospace;font-size:12px;color:var(--subtle);display:flex;justify-content:space-between;flex-wrap:wrap;gap:12px}
  .foot a{color:var(--ink)}
  @media (max-width:860px){
    .topbar-in,.wrap,.foot{padding-left:22px;padding-right:22px}
    .wrap{grid-template-columns:1fr;gap:0}
    .toc{display:none}
    .doc-main{grid-column:1}
    .doc-body{padding:14px 22px 30px}
    h1{font-size:30px}
  }
  @media print{
    .topbar,.toc,.foot{display:none}
    body{background:#fff}
    .doc-body{border:none;border-radius:0;padding:0;background:#fff}
    .wrap{display:block;padding:0}
    mark.ph{background:none;font-weight:700}
  }
</style>
</head>
<body>
<header class="topbar">
  <div class="topbar-in">
    <a class="home" href="/"><span class="dot"></span>family-pie</a>
    <div class="tabs" role="tablist" aria-label="Documents">
      <button class="tab" role="tab" data-tab="terms"   id="tab-terms"   aria-controls="panel" aria-selected="false">${T[defLang].terms}</button>
      <button class="tab" role="tab" data-tab="privacy" id="tab-privacy" aria-controls="panel" aria-selected="false">${T[defLang].privacy}</button>
    </div>
    <span class="spacer"></span>
    <div class="langtoggle" role="group" aria-label="Language">
      <button data-lang="ru">RU</button>
      <button data-lang="en">EN</button>
    </div>
  </div>
</header>

<main class="wrap" id="panel" role="tabpanel" aria-labelledby="tab-${initialDoc === 'privacy' ? 'privacy' : 'terms'}">
${cols}
</main>

<footer class="foot">
  <span>© 2026 family-pie · legal host</span>
  <a href="mailto:hello@family-pie.ru">hello@family-pie.ru</a>
</footer>

<noscript>
  <div style="max-width:720px;margin:0 auto;padding:24px 22px;font-family:Manrope,sans-serif">
    <p style="margin-bottom:10px;color:#6b655c">${T[defLang].rawText}:</p>
    <p style="line-height:2">${rawNoscript}</p>
  </div>
</noscript>

<script>
(function(){
  var DOC_PATH = { terms:'terms', privacy:'privacy' };
  var TAB_LABEL = {
    ru:{ terms:${JSON.stringify(T.ru.terms)}, privacy:${JSON.stringify(T.ru.privacy)} },
    en:{ terms:${JSON.stringify(T.en.terms)}, privacy:${JSON.stringify(T.en.privacy)} }
  };
  var PRODUCT_ID = ${JSON.stringify(id)};
  var DEF_LANG = ${JSON.stringify(defLang)};
  var doc = ${JSON.stringify(initialDoc === 'privacy' ? 'privacy' : 'terms')};
  var lang = DEF_LANG;
  try { var s = localStorage.getItem('fp_lang'); if (s === 'ru' || s === 'en') lang = s; } catch(e){}

  var cols = Array.prototype.slice.call(document.querySelectorAll('.doc'));
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tab'));
  var spy = null;

  function activeCol(){ return document.querySelector('.doc[data-doc="'+doc+'"][data-lang="'+lang+'"]'); }

  function buildSpy(){
    if (spy) spy.disconnect();
    var col = activeCol(); if (!col) return;
    var links = {};
    col.querySelectorAll('.toc a').forEach(function(a){ links[a.getAttribute('data-spy')] = a; });
    spy = new IntersectionObserver(function(entries){
      entries.forEach(function(en){
        if (en.isIntersecting){
          col.querySelectorAll('.toc a.active').forEach(function(a){ a.classList.remove('active'); });
          var a = links[en.target.id]; if (a) a.classList.add('active');
        }
      });
    }, { rootMargin:'-82px 0px -55% 0px', threshold:0 });
    col.querySelectorAll('.sec').forEach(function(sec){ spy.observe(sec); });
  }

  function render(updateUrl){
    cols.forEach(function(c){ c.hidden = !(c.getAttribute('data-doc')===doc && c.getAttribute('data-lang')===lang); });
    tabs.forEach(function(t){
      var on = t.getAttribute('data-tab')===doc;
      t.setAttribute('aria-selected', on?'true':'false');
      t.textContent = TAB_LABEL[lang][t.getAttribute('data-tab')];
    });
    document.querySelectorAll('.langtoggle button').forEach(function(b){ b.classList.toggle('on', b.getAttribute('data-lang')===lang); });
    document.documentElement.lang = lang;
    if (updateUrl){
      try { history.replaceState(null, '', '/'+PRODUCT_ID+'/'+DOC_PATH[doc]); } catch(e){}
    }
    buildSpy();
  }

  tabs.forEach(function(t){
    t.addEventListener('click', function(){ doc = t.getAttribute('data-tab'); render(true); });
  });
  document.querySelectorAll('.langtoggle button').forEach(function(b){
    b.addEventListener('click', function(){
      lang = b.getAttribute('data-lang');
      try { localStorage.setItem('fp_lang', lang); } catch(e){}
      render(false);
    });
  });
  // smooth-scroll TOC clicks (delegated; links live inside the active column)
  document.addEventListener('click', function(e){
    var a = e.target.closest && e.target.closest('.toc a'); if (!a) return;
    e.preventDefault();
    var el = document.getElementById(a.getAttribute('href').slice(1));
    if (el) el.scrollIntoView({ behavior:'smooth', block:'start' });
  });

  render(false);
})();
</script>
</body>
</html>
`;
}

/* ---------- drive: read content, parse, write files ---------- */
function loadModel(p, docKey, lang) {
  const rel = p.legal && p.legal[docKey] && p.legal[docKey][lang];
  if (!rel) return { model: null, raw: null };
  const abs = r(rel);
  if (!existsSync(abs)) { console.warn(`  ! missing file: ${rel}`); return { model: null, raw: null }; }
  return { model: parse(readFileSync(abs, 'utf8')), raw: rel };
}

let written = 0;
for (const p of products) {
  const id = p.id;
  const outDir = r(`site/${id}`);
  mkdirSync(outDir, { recursive: true });

  const models = { terms: {}, privacy: {} };
  const rawLinks = { terms: {}, privacy: {} };
  for (const docKey of ['terms', 'privacy']) {
    for (const lang of ['ru', 'en']) {
      const { model, raw } = loadModel(p, docKey, lang);
      models[docKey][lang] = model;
      if (raw) {
        const fname = basename(raw);
        copyFileSync(r(raw), resolve(outDir, fname)); // serve raw md for <noscript>
        rawLinks[docKey][lang] = fname;
      }
    }
  }

  for (const entry of ['legal', 'terms', 'privacy']) {
    const initialDoc = entry === 'privacy' ? 'privacy' : 'terms';
    writeFileSync(resolve(outDir, `${entry}.html`), page(p, initialDoc, models, rawLinks));
    written++;
  }
  console.log(`✓ ${id}: legal.html, terms.html, privacy.html`);
}

/* ---------- regenerate sitemap.xml from the catalog ---------- */
const today = new Date().toISOString().slice(0, 10);
const urls = [{ loc: 'https://family-pie.ru/', freq: 'monthly', pri: '1.0' }];
for (const p of products) {
  for (const e of ['legal', 'terms', 'privacy']) {
    urls.push({ loc: `https://family-pie.ru/${p.id}/${e}`, freq: 'yearly', pri: e === 'legal' ? '0.6' : '0.5' });
  }
}
const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<!-- Generated by tools/build-legal.mjs from data/products.json — do not edit by hand. -->
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>
    <loc>${u.loc}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${u.freq}</changefreq>
    <priority>${u.pri}</priority>
  </url>`).join('\n')}
</urlset>
`;
writeFileSync(r('site/sitemap.xml'), sitemap);
console.log(`✓ sitemap.xml — ${urls.length} URLs`);

console.log(`\nDone — ${written} HTML files across ${products.length} products.`);
