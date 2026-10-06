/* Share the reference page's appearance preference across the Family site. */
(() => {
  const key = 'family-vpn-theme-v3';
  const button = document.querySelector('.theme-toggle');
  function apply(value) {
    const light = value === 'light';
    document.body.classList.toggle('light', light);
    button.setAttribute('aria-pressed', String(light));
    document.documentElement.style.colorScheme = light ? 'light' : 'dark';
    document.documentElement.style.backgroundColor = light ? '#f7f6f3' : '#090d13';
  }
  let saved;
  try { saved = localStorage.getItem(key); } catch { /* Optional preference. */ }
  apply(saved || 'dark');
  button.addEventListener('click', () => {
    const value = document.body.classList.contains('light') ? 'dark' : 'light';
    apply(value);
    try { localStorage.setItem(key, value); } catch { /* Toggle still works. */ }
  });
})();
