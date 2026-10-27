(() => {
  'use strict';
  const params = new URLSearchParams(location.hash.slice(1));
  const purpose = document.documentElement.dataset.telegramEntry;
  const token = params.get(purpose === 'import' ? 'token' : 'telegram');
  if (!token && purpose !== 'import') return;
  // Remove the one-use credential before any network request or other deferred script.
  history.replaceState(null, '', location.pathname + location.search);
  const devices = ['android', 'ios', 'windows', 'macos', 'linux', 'tv'];
  const requested = params.get('device');
  const device = devices.includes(requested) ? requested : 'android';
  const text = value => window.FPi18n?.t(value) || value;
  const message = document.querySelector('#telegram-entry-message') || document.querySelector('#account-message');
  const setMessage = (value, error = false) => {
    if (!message) return;
    message.textContent = text(value);
    message.dataset.tone = error ? 'error' : 'info';
  };
  function normalLoginURL() {
    const previous = new URLSearchParams(location.search), query = new URLSearchParams();
    for (const key of ['lang', 'next', 'period']) if (previous.has(key)) query.set(key, previous.get(key));
    if (!query.has('lang') && ['ru', 'en'].includes(window.FPi18n?.lang)) query.set('lang', window.FPi18n.lang);
    query.set('reauth', '1');query.set('mode', 'login');
    // The normal auth controller validates next/period. This link itself never leaves the auth path.
    return location.pathname + '?' + query;
  }
  function restoreNormalLogin() {
    if (purpose === 'import') return true;
    const confirmation = document.querySelector('#telegram-login-confirm');
    if (confirmation) confirmation.hidden = true;
    const recovery = document.querySelector('#password-recovery');
    if (recovery && !recovery.hidden) return false; // A later network response must not close an active reset form.
    for (const selector of ['#login-form', '#auth-title', '.auth-methods', '.demo-label']) {
      const element = document.querySelector(selector);if (element) element.hidden = false;
    }
    history.replaceState(null, '', normalLoginURL());
    window.dispatchEvent?.(new CustomEvent('vpn-auth-login-view'));
    return true;
  }
  const failureMessage = error => ['TimeoutError', 'TypeError', 'SyntaxError'].includes(error.name)
    ? purpose === 'import' ? 'Не удалось получить подписку. Открой новую ссылку в боте или напиши на почту ниже.' : 'Сервис временно недоступен. Повтори позже или напиши в поддержку.'
    : error.message;
  if (purpose !== 'import') {
    const cancel = document.querySelector('#telegram-login-confirm')?.querySelector('[data-telegram-cancel]');
    if (cancel) cancel.href = normalLoginURL();
  }
  const showImportRecovery = () => {
    if (purpose !== 'import') return;
    const recovery = document.querySelector('#telegram-entry-recovery');
    if (recovery) recovery.hidden = false;
  };
  // Same official application sources as the authenticated device guide. No personal URL goes to a store.
  const installs = {
    ios: ['iPhone и iPad', [['App Store', 'https://apps.apple.com/us/app/happ-proxy-utility/id6504287215']]],
    android: ['Android', [['Google Play', 'https://play.google.com/store/apps/details?id=com.happproxy'], ['Скачать APK', 'https://github.com/Happ-proxy/happ-android/releases/latest/download/Happ.apk']]],
    windows: ['Windows', [['Windows x64', 'https://github.com/Happ-proxy/happ-desktop/releases/latest/download/setup-Happ.x64.exe'], ['Windows ARM64', 'https://github.com/Happ-proxy/happ-desktop/releases/latest/download/setup-Happ.arm64.exe']]],
    macos: ['macOS', [['Скачать для Mac', 'https://github.com/Happ-proxy/happ-desktop/releases/latest/download/Happ.macOS.universal.dmg'], ['App Store', 'https://apps.apple.com/us/app/happ-proxy-utility/id6504287215']]],
    linux: ['Linux', [['Linux DEB · x64', 'https://github.com/Happ-proxy/happ-desktop/releases/latest/download/Happ.linux.x64.deb'], ['Linux RPM · x64', 'https://github.com/Happ-proxy/happ-desktop/releases/latest/download/Happ.linux.x64.rpm']]],
    tv: ['Smart TV', [['Android TV', 'https://play.google.com/store/apps/details?id=com.happproxy'], ['Apple TV', 'https://apps.apple.com/us/app/happ-proxy-utility-for-tv/id6748297274']]]
  };
  async function request(action) {
    const response = await fetch('/vpn/api/telegram/' + action, {
      method: 'POST', credentials: 'same-origin', cache: 'no-store', referrerPolicy: 'no-referrer',
      signal: AbortSignal.timeout(15000), headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({token})
    });
    const result = await response.json();
    if (!response.ok) throw new Error(response.status === 409
      ? 'В кабинете открыт другой аккаунт. Открой его или войди по логину и паролю.'
      : 'Ссылка устарела. Открой новую в боте или напиши в поддержку по почте ниже.');
    return result;
  }
  window.vpnTelegramEntry = (async () => {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token || '')) {
      const restored = restoreNormalLogin();
      if (restored !== false) setMessage('Ссылка устарела. Открой новую в боте или напиши в поддержку по почте ниже.', true);
      showImportRecovery();
      return false;
    }
    setMessage(purpose === 'import' ? 'Готовим твою подписку…' : 'Входим через Telegram…');
    try {
      if (purpose !== 'import') {
        const confirmation = document.querySelector('#telegram-login-confirm');
        const login = document.querySelector('#login-form');
        const methods = document.querySelector('.auth-methods');
        const title = document.querySelector('#auth-title');
        const confirm = confirmation.querySelector('[data-telegram-confirm]');
        confirmation.hidden = false;
        login.hidden = true;
        title.hidden = true;
        confirm.disabled = true;
        if (methods) methods.hidden = true;
        const identity = await request('login/preview');
        confirmation.querySelector('[data-telegram-account]').textContent =
          (window.FPi18n?.t('Аккаунт:') || 'Аккаунт:') + ' ' + identity.login;
        confirm.disabled = false;
        confirm.addEventListener('click', async () => {
          confirm.disabled = true;
          try {
            await request('login');
            location.replace('/vpn/cabinet/?lang=' + (window.FPi18n?.lang === 'en' ? 'en' : 'ru') + '#devices?platform=' + device);
          } catch (error) { setMessage(failureMessage(error), true); confirm.disabled = false; }
        });
        setMessage('Проверь аккаунт и подтверди вход через Telegram.');
        return true;
      }
      const result = await request('import');
      const url = new URL(result.profileUrl);
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Не удалось получить подписку. Открой новую ссылку в боте или напиши на почту ниже.');
      const box = document.querySelector('#telegram-import');
      const add = box.querySelector('[data-import-add]');
      const input = box.querySelector('textarea');
      add.href = 'happ://add/' + url.href;
      input.value = url.href;
      box.hidden = false;
      const platform = devices.includes(result.device) ? result.device : device;
      const [platformName, downloads] = installs[platform];
      const steps = [...box.querySelectorAll('[data-import-step]')];
      const progress = [...box.querySelectorAll('[data-import-progress]')];
      const label = box.querySelector('[data-import-step-label]');
      const heading = box.querySelector('[data-import-device]');
      let step = 'install';
      const stepLabels = {
        install: 'Шаг 1 из 3. Установи приложение',
        import: 'Шаг 2 из 3. Добавь подписку',
        enable: 'Шаг 3 из 3. Включи VPN'
      };
      function renderStep(focus = false) {
        if (heading) heading.textContent = text('Устройство:') + ' ' + text(platformName);
        if (label) label.textContent = text(stepLabels[step]);
        for (const section of steps) section.hidden = section.dataset.importStep !== step;
        for (const item of progress) {
          if (item.dataset.importProgress === step) item.setAttribute('aria-current', 'step');
          else item.removeAttribute('aria-current');
        }
        if (focus) {
          const section = steps.find(item => item.dataset.importStep === step);
          const title = section?.querySelector('h2');
          if (title) { title.tabIndex = -1; title.focus({preventScroll: true}); }
          section?.scrollIntoView?.({block: 'start'});
        }
      }
      function advance(value) { step = value; renderStep(true); }
      const downloadTarget = box.querySelector('[data-import-downloads]');
      for (const [label, href] of downloads) {
        const link = document.createElement('a');
        link.className = 'btn secondary';link.textContent = label;link.href = href;
        link.target = '_blank';link.rel = 'noopener noreferrer';link.referrerPolicy = 'no-referrer';
        downloadTarget?.append(link);
      }
      box.querySelector('[data-import-installed]')?.addEventListener('click', () => advance('import'));
      box.querySelector('[data-import-added]')?.addEventListener('click', () => advance('enable'));
      box.querySelector('[data-import-back-install]')?.addEventListener('click', () => advance('install'));
      box.querySelector('[data-import-back-add]')?.addEventListener('click', () => advance('import'));
      add.addEventListener('click', () => setMessage('Если подписка появилась в Happ, вернись сюда и нажми «Я добавил подписку — дальше».'));
      window.addEventListener?.('fp-languagechange', () => renderStep());
      renderStep();
      setMessage('Личная ссылка готова. Осталось настроить приложение.');
      box.querySelector('[data-import-copy]').addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(url.href);
          setMessage('Ссылка скопирована. Открой Happ и добавь её из буфера обмена.');
        } catch {
          input.focus(); input.select();
          setMessage('Браузер не разрешил копирование. Выделенная ссылка доступна для копирования вручную.');
        }
      });
      return true;
    } catch (error) {
      if (restoreNormalLogin() !== false) setMessage(failureMessage(error), true);
      showImportRecovery();
      return false;
    }
  })();
})();
