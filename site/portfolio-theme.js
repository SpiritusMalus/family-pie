/* Portfolio appearance shares the site's stored preference, not its artwork. */
(() => {
  'use strict';
  const key = 'family-vpn-theme-v3';
  const root = document.documentElement;
  const system = matchMedia('(prefers-color-scheme: dark)');
  const read = () => {
    try { const value = localStorage.getItem(key); return ['light', 'dark'].includes(value) ? value : null; }
    catch { return null; }
  };
  let preference = read();
  function apply() {
    const light = preference ? preference === 'light' : !system.matches;
    root.classList.toggle('light', light);
    root.style.colorScheme = light ? 'light' : 'dark';
    document.body?.classList.toggle('light', light);
    document.querySelector('.theme-toggle')?.setAttribute('aria-pressed', String(light));
  }
  root.classList.add('js');
  apply();
  document.addEventListener('DOMContentLoaded', () => {
    apply();
    document.querySelector('.theme-toggle')?.addEventListener('click', () => {
      preference = root.classList.contains('light') ? 'dark' : 'light';
      apply();
      try { localStorage.setItem(key, preference); } catch { /* Works without storage. */ }
      window.dispatchEvent(new Event('family-themechange'));
    });
  });
  window.addEventListener('pageshow', () => { const stored = read(); if (stored) preference = stored; apply(); });
  window.addEventListener('storage', event => { if (event.key === key) { preference = read(); apply(); } });
  system.addEventListener('change', apply);
})();
