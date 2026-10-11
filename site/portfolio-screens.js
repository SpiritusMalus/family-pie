/* Compare real captures without changing the language of the page. */
(() => {
  'use strict';
  function savedLanguage(image) {
    try {
      const value = sessionStorage.getItem('fp_screen_lang:' + image?.dataset.screenRuSrc);
      return value === 'ru' || value === 'en' ? value : null;
    } catch { return null; }
  }
  const pairs = [...document.querySelectorAll('[data-screen-pair]')].map(figure => ({
    figure,
    image: figure.querySelector('[data-screen-ru-src][data-screen-en-src]'),
    link: figure.querySelector('[data-screen-link]'),
    buttons: [...figure.querySelectorAll('[data-screen-language]')],
    status: figure.querySelector('[data-screen-status]'),
    preference: savedLanguage(figure.querySelector('[data-screen-ru-src]')),
    shown: figure.dataset.screenLang || 'ru',
    request: 0
  })).filter(pair => pair.image && pair.link);

  function finish(pair, lang) {
    pair.shown = lang;
    pair.figure.dataset.screenLang = lang;
    pair.figure.removeAttribute('aria-busy');
    pair.buttons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.screenLanguage === lang)));
    pair.status.textContent = '';
    if (pair.preference) {
      try { sessionStorage.setItem('fp_screen_lang:' + pair.image.dataset.screenRuSrc, lang); } catch { /* Switching also works without storage. */ }
    }
  }

  function show(pair, lang) {
    const src = pair.image.dataset[lang === 'en' ? 'screenEnSrc' : 'screenRuSrc'];
    const request = ++pair.request;
    if (pair.image.getAttribute('src') === src && pair.image.complete && pair.image.naturalWidth) {
      pair.link.href = src;
      finish(pair, lang);
      return;
    }
    pair.figure.setAttribute('aria-busy', 'true');
    pair.status.textContent = '';
    const capture = new Image();
    const timeout = setTimeout(() => fail(), 15000);
    function fail() {
      clearTimeout(timeout);
      if (request !== pair.request) return;
      pair.request++;
      pair.preference = pair.shown;
      pair.figure.removeAttribute('aria-busy');
      pair.status.textContent = window.FPi18n?.lang === 'en'
        ? 'Couldn’t load this screenshot. Try the language button again.'
        : 'Не удалось загрузить скриншот. Нажмите кнопку языка ещё раз.';
    }
    capture.onerror = fail;
    capture.onload = () => {
      clearTimeout(timeout);
      if (request !== pair.request) return;
      pair.image.src = src;
      pair.image.width = capture.naturalWidth;
      pair.image.height = capture.naturalHeight;
      pair.link.href = src;
      finish(pair, lang);
    };
    capture.src = src;
  }

  pairs.forEach(pair => pair.buttons.forEach(button => {
    button.addEventListener('click', () => {
      pair.preference = button.dataset.screenLanguage;
      show(pair, pair.preference);
    });
  }));
  const render = () => pairs.forEach(pair => show(pair, pair.preference || window.FPi18n?.lang || 'ru'));
  window.addEventListener('fp-languagechange', render);
  render();
})();
