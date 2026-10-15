/* One saved appearance for every page on this origin. */
(() => {
  'use strict';
  const key = 'family-vpn-theme-v3';
  const root = document.documentElement;
  const fixed = root.dataset.appearance === 'fixed-dark';
  let preference = 'dark';
  function read() {
    try { return localStorage.getItem(key) === 'light' ? 'light' : 'dark'; }
    catch { return preference; }
  }
  function apply() {
    const light = !fixed && preference === 'light';
    root.classList.toggle('light', light);
    root.style.colorScheme = light ? 'light' : 'dark';
    document.body?.classList.toggle('light', light);
    document.querySelectorAll('[data-theme], .theme-toggle').forEach(button => button.setAttribute('aria-pressed', String(light)));
    const select = document.querySelector('#appearance');
    if (select) select.value = light ? 'light' : 'dark';
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
      const css = getComputedStyle(document.body || root);
      meta.content = css.getPropertyValue('--bg').trim() || css.getPropertyValue('--paper').trim() || '#000000';
    }
    window.updatePortalLabel?.();
    window.dispatchEvent(new Event('family-themechange'));
  }
  function set(value) {
    if (!['light', 'dark'].includes(value)) return;
    preference = value;
    try { localStorage.setItem(key, value); } catch { /* Remains usable without storage. */ }
    apply();
  }
  preference = read();
  root.classList.add('js');
  apply();
  window.FamilyAppearance = {set, toggle: () => set(root.classList.contains('light') ? 'dark' : 'light')};
  document.addEventListener('DOMContentLoaded', apply);
  document.addEventListener('click', event => {
    if (event.target.closest?.('[data-theme], .theme-toggle')) window.FamilyAppearance.toggle();
  });
  document.addEventListener('change', event => {
    if (event.target.id === 'appearance') set(event.target.value);
  });
  window.addEventListener('pageshow', () => { preference = read(); apply(); });
  window.addEventListener('storage', event => {
    if (event.key === key || event.key === null) { preference = read(); apply(); }
  });
})();
