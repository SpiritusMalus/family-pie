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
  const message = document.querySelector('#telegram-entry-message') || document.querySelector('#account-message');
  const setMessage = (value, error = false) => {
    if (!message) return;
    message.textContent = window.FPi18n?.t(value) || value;
    message.dataset.tone = error ? 'error' : 'info';
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
      : 'Ссылка устарела. Вернись в Telegram и открой новую.');
    return result;
  }
  window.vpnTelegramEntry = (async () => {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token || '')) {
      setMessage('Ссылка устарела. Вернись в Telegram и открой новую.', true);
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
          } catch (error) { setMessage(error.message, true); confirm.disabled = false; }
        });
        setMessage('Проверь аккаунт и подтверди вход через Telegram.');
        return true;
      }
      const result = await request('import');
      const url = new URL(result.profileUrl);
      if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Не удалось получить подписку. Открой новую ссылку в боте.');
      const box = document.querySelector('#telegram-import');
      const add = box.querySelector('[data-import-add]');
      const input = box.querySelector('textarea');
      add.href = 'happ://add/' + url.href;
      input.value = url.href;
      box.hidden = false;
      setMessage('Добавь подписку в приложение. Логин от сайта не нужен.');
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
      setMessage(error.name === 'TimeoutError' ? 'Не удалось получить подписку. Открой новую ссылку в боте.' : error.message, true);
      return false;
    }
  })();
})();
