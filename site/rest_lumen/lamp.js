// An illustrative page light; the desktop app controls actual display colors.
(() => {
  const button = document.querySelector('.lamp-switch');
  if (!button) return;
  button.addEventListener('click', () => {
    const on = button.getAttribute('aria-pressed') !== 'true';
    button.setAttribute('aria-pressed', String(on));
    document.body.dataset.lamp = on ? 'on' : 'off';
  });
})();
