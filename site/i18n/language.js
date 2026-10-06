/* Shared RU/EN preference. Only pages marked data-fp-translate use the copy map.
   Native bilingual pages keep their own renderers and use this language API. */
(() => {
  'use strict';
  const valid = value => value === 'ru' || value === 'en';
  const query = new URLSearchParams(location.search).get('lang');
  const fragment = new URLSearchParams(location.hash.slice(1)).get('lang');
  let saved;
  try { saved = localStorage.getItem('fp_lang'); } catch { /* In-memory preference still works. */ }
  let lang = [fragment, query, saved].find(valid) || ((navigator.language || 'ru').startsWith('en') ? 'en' : 'ru');
  const dictionary = window.FP_EN || {};
  const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = (window.FP_PATTERNS || []).map(([source, target, nested]) => {
    const names = [];
    const parts = source.split(/(\{\w+\})/).map(part => {
      if (/^\{\w+\}$/.test(part)) { names.push(part.slice(1,-1)); return '(.+?)'; }
      return escape(part);
    });
    return { regex: new RegExp('^' + parts.join('') + '$'), target, names, nested };
  });
  function translate(text, depth = 0) {
    if (lang !== 'en') return text;
    const key = text.trim();
    let result = dictionary[key];
    if (result === undefined && depth < 2) {
      for (const pattern of patterns) {
        const match = key.match(pattern.regex);
        if (!match) continue;
        const values = Object.fromEntries(pattern.names.map((name, index) => [name,
          pattern.nested.includes(name) ? translate(match[index+1], depth+1) : match[index+1]]));
        result = pattern.target.replace(/\{(\w+)\}/g, (_, name) => values[name]);
        break;
      }
    }
    if (result === undefined) return text;
    return text.slice(0, text.indexOf(key)) + result + text.slice(text.indexOf(key) + key.length);
  }
  const records = new WeakMap();
  const attributes = ['aria-label', 'alt', 'placeholder', 'title', 'content'];
  function update(node, key, current, write) {
    let slots = records.get(node);
    const previous = slots?.[key];
    const source = previous && previous.last === current ? previous.source : current;
    const next = translate(source);
    if (next === source && !previous) return;
    if (!slots) { slots = {}; records.set(node, slots); }
    slots[key] = {source, last: next};
    if (current !== next) write(next);
  }
  function visit(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (node.parentElement?.closest('script, style, noscript, [data-fp-no-i18n]')) return;
      update(node, 'text', node.data, value => { node.data = value; });
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.matches('script, style, noscript, [data-fp-no-i18n]')) return;
      for (const attr of attributes) {
        if (node.hasAttribute(attr)) update(node, attr, node.getAttribute(attr), value => node.setAttribute(attr, value));
      }
      node.childNodes.forEach(visit);
    }
  }
  function persist() { try { localStorage.setItem('fp_lang', lang); } catch { /* Optional storage. */ } }
  function buttons() {
    document.querySelectorAll('[data-fp-lang]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.fpLang === lang)));
    document.querySelectorAll('.fp-language').forEach(group => group.setAttribute('aria-label', lang === 'en' ? 'Language' : 'Язык'));
  }
  function set(value) {
    if (!valid(value)) return;
    lang = value; persist(); document.documentElement.lang = lang;
    if (new URLSearchParams(location.search).has('lang')) {
      const url = new URL(location.href); url.searchParams.set('lang', lang);
      history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
    if (document.documentElement.hasAttribute('data-fp-translate')) visit(document.documentElement);
    buttons(); window.dispatchEvent(new CustomEvent('fp-languagechange', {detail: lang}));
  }
  window.FPi18n = {get lang() { return lang; }, set, t: translate};
  document.documentElement.lang = lang;
  if (valid(query) || valid(fragment)) persist();
  document.addEventListener('DOMContentLoaded', () => {
    if (!document.querySelector('.langtoggle')) {
      const group = document.createElement('div'); group.className = 'fp-language'; group.setAttribute('role', 'group');
      for (const value of ['ru','en']) {
        const button = document.createElement('button'); button.type = 'button'; button.dataset.fpLang = value; button.textContent = value.toUpperCase();
        button.addEventListener('click', () => set(value)); group.append(button);
      }
      const host = document.querySelector('.nav-actions') || document.querySelector('.header-inner nav') || document.querySelector('.nav-in') || document.querySelector('header.wrap') || document.querySelector('header');
      if (host) host.append(group);
      else { group.classList.add('fp-language-standalone'); document.body.prepend(group); }
    }
    if (document.documentElement.hasAttribute('data-fp-translate')) {
      visit(document.documentElement);
      const observer = new MutationObserver(mutations => {
        for (const mutation of mutations) {
          if (mutation.type === 'childList') mutation.addedNodes.forEach(visit);
          else visit(mutation.target);
        }
      });
      observer.observe(document.documentElement, {subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: attributes});
    }
    buttons();
  });
})();
