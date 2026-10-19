/* Keep real captures synchronized with the page language. */
(() => {
  'use strict';
  const pairs = [...document.querySelectorAll('[data-screen-pair]')].map(figure => ({
    figure,
    image: figure.querySelector('[data-screen-ru-src][data-screen-en-src]'),
    status: figure.querySelector('[data-screen-status]'),
    request: 0
  })).filter(pair => pair.image);

  function finish(pair, lang) {
    pair.figure.dataset.screenLang = lang;
    pair.figure.removeAttribute('aria-busy');
    pair.status.textContent = '';
  }

  function show(pair, lang) {
    const src = pair.image.dataset[lang === 'en' ? 'screenEnSrc' : 'screenRuSrc'];
    const request = ++pair.request;
    if (pair.image.getAttribute('src') === src && pair.image.complete && pair.image.naturalWidth) {
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
      pair.figure.removeAttribute('aria-busy');
      pair.status.textContent = lang === 'en'
        ? 'Couldn’t load the screenshot. Select RU or EN at the top of the page to try again.'
        : 'Не удалось загрузить скриншот. Нажмите RU или EN вверху страницы, чтобы повторить.';
    }
    capture.onerror = fail;
    capture.onload = () => {
      clearTimeout(timeout);
      if (request !== pair.request) return;
      pair.image.src = src;
      pair.image.width = capture.naturalWidth;
      pair.image.height = capture.naturalHeight;
      finish(pair, lang);
    };
    capture.src = src;
  }

  const render = () => pairs.forEach(pair => show(pair, window.FPi18n?.lang === 'ru' ? 'ru' : 'en'));
  window.addEventListener('fp-languagechange', render);
  window.addEventListener('pageshow', render);
  render();
})();
