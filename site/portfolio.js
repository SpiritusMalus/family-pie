/* Small native renderer: readable static HTML remains the no-JS fallback. */
(() => {
  'use strict';
  function render() {
    const lang = window.FPi18n?.lang || 'ru';
    for (const node of document.querySelectorAll('[data-ru][data-en]')) {
      const text = node.dataset[lang];
      const attribute = node.dataset.copyAttr;
      if (attribute) node.setAttribute(attribute, text);
      else node.textContent = text;
    }
    for (const image of document.querySelectorAll('img[data-ru-src][data-en-src]')) {
      image.src = image.dataset[lang + 'Src'];
      const height = image.dataset[lang + 'Height'];
      if (height) image.height = Number(height);
    }
    for (const button of document.querySelectorAll('[data-fp-lang]')) {
      button.setAttribute('aria-pressed', String(button.dataset.fpLang === lang));
    }
  }
  document.querySelectorAll('[data-fp-lang]').forEach(button => {
    button.addEventListener('click', () => window.FPi18n?.set(button.dataset.fpLang));
  });
  window.addEventListener('fp-languagechange', render);
  render();
})();
