(() => {
  'use strict';
  const address = 'support@family-pie.ru';
  const english = {'Почта скопирована': 'Email address copied', 'Выдели адрес и скопируй его вручную.': 'Select the address and copy it manually.'};
  const text = value => window.FPi18n?.lang === 'en' ? english[value] || value : value;
  const refresh = (root = document) => root.querySelectorAll('[data-copy-support-email]').forEach(button => { button.hidden = false; });
  document.addEventListener('click', async event => {
    const button = event.target.closest?.('[data-copy-support-email]');
    if (!button) return;
    event.preventDefault();
    const contact = button.closest('[data-email-support]');
    const result = contact?.querySelector('[data-email-copy-status]');
    button.disabled = true;
    let message;
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(address);
      message = 'Почта скопирована';
    } catch {
      message = 'Выдели адрес и скопируй его вручную.';
      const link = contact?.querySelector('a[href^="mailto:"]');
      const range = document.createRange?.(), selection = window.getSelection?.();
      if (link && range && selection) { range.selectNodeContents(link); selection.removeAllRanges(); selection.addRange(range); }
    } finally {
      button.disabled = false;
    }
    if (result) { result.dataset.emailCopyResult = message; result.textContent = text(message); }
  });
  window.addEventListener('fp-languagechange', () => document.querySelectorAll('[data-email-copy-result]').forEach(result => { result.textContent = text(result.dataset.emailCopyResult); }));
  window.vpnSupportEmail = {address, refresh};
  refresh();
})();
