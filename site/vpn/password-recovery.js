(() => {
  'use strict';
  const $ = selector => document.querySelector(selector);
  const panel = $('#password-recovery');
  if (!panel) return;
  const text = value => window.FPi18n?.t(value) || value;
  const copy = new Map();
  const write = (element, value) => { copy.set(element, value); element.textContent = text(value); };
  let accountLabel;
  let active = false, challengeId, token, identifier, recoveredLogin, retryAt = 0, version = 0;
  const fragments = new URLSearchParams(location.hash.slice(1));
  if (fragments.has('recovery')) {
    token = fragments.get('recovery');
    history.replaceState(null, '', location.pathname + location.search);
    window.vpnRecoveryEntry = true;
  }
  const message = (value, error = false) => {
    write($('#recovery-message'), value);
    $('#recovery-message').dataset.tone = error ? 'error' : 'info';
  };
  async function api(path, body) {
    let response;
    try {
      response = await fetch('/vpn/api/' + path, {method: 'POST', credentials: 'same-origin', cache: 'no-store', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(15000), headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
    } catch {
      throw new Error('Сервис не ответил. Проверь соединение и повтори попытку.');
    }
    let data;
    try { data = await response.json(); } catch { throw new Error('Сервис временно недоступен. Повтори позже или напиши в поддержку.'); }
    if (!response.ok) throw new Error(data.error || 'Не удалось восстановить доступ. Повтори попытку или напиши в поддержку.');
    return data;
  }
  function hideAuth() {
    for (const selector of ['#login-form', '#password-form', '.auth-methods', '#auth-title', '.demo-label']) {
      const element = $(selector);
      if (element && !element.hidden) element.hidden = true;
    }
    $('#account-message').textContent = '';
    panel.hidden = false;
  }
  function open() {
    active = true;
    hideAuth();
    $('#recovery-start').hidden = false;
    $('#recovery-reset').hidden = $('#recovery-success').hidden = true;
    $('#recovery-identifier').value = $('#login').value || '';
    write($('#recovery-title'), 'Восстановить доступ');
    const intro = $('.auth-layout > div > p');
    if (intro) write(intro, 'Восстанови доступ, чтобы вернуться к своей подписке.');
    message('');
    $('#recovery-title').focus();
  }
  function close() {
    version++;
    active = false;
    token = challengeId = undefined;
    for (const selector of ['#recovery-code', '#recovery-password', '#recovery-repeat']) $(selector).value = '';
    panel.hidden = true;
    $('#auth-title').hidden = false;
    $('.demo-label').hidden = false;
    $('#password').value = '';
    if (recoveredLogin) $('#login').value = recoveredLogin;
    copy.delete($('.auth-layout > div > p'));
    window.dispatchEvent(new CustomEvent('vpn-auth-login-view'));
    $('#password').focus();
  }
  function resetForm(isToken) {
    $('#recovery-start').hidden = true;
    $('#recovery-reset').hidden = false;
    $('#recovery-success').hidden = true;
    $('#recovery-code-row').hidden = isToken;
    $('#recovery-code').required = !isToken;
    $('#recovery-resend').hidden = isToken;
    write($('#recovery-title'), 'Задай новый пароль');
    write($('#recovery-instructions'), isToken ? 'Одноразовая ссылка подтверждена. Придумай новый пароль для этого аккаунта.' : 'Если у аккаунта есть подтверждённая почта, мы отправили код. Введи его и новый пароль. Код действует 10 минут.');
    $(isToken ? '#recovery-password' : '#recovery-code').focus();
  }
  async function request() {
    if (Date.now() < retryAt) throw new Error('Код уже запрошен. Повтори через минуту или проверь папку «Спам».');
    identifier = $('#recovery-identifier').value.trim();
    if (!identifier) throw new Error('Укажи логин или подтверждённую почту.');
    const current = version, data = await api('recovery/request', {identifier, ...(challengeId ? {challengeId} : {})});
    if (current !== version || !active) return;
    challengeId = data.challengeId;
    retryAt = Date.now() + Math.min(300, Math.max(1, Number(data.retryAfter) || 60)) * 1000;
    resetForm(false);
    message('Проверь входящие и папку «Спам». Если почта не подключена, напиши в поддержку по почте ниже.');
  }
  function action(element, event, operation) {
    element.addEventListener(event, async value => {
      value.preventDefault();
      const button = value.submitter || element;
      button.disabled = true;
      try { await operation(); } catch (error) { message(error.message, true); }
      finally { button.disabled = false; }
    });
  }
  action($('#forgot-password'), 'click', open);
  action($('#recovery-back'), 'click', close);
  action($('#recovery-sign-in'), 'click', close);
  action($('#recovery-request'), 'submit', request);
  action($('#recovery-resend'), 'click', request);
  action($('#recovery-reset'), 'submit', async () => {
    const password = $('#recovery-password').value;
    if (password.length < 12 || password.length > 128) throw new Error('Выбери пароль от 12 до 128 символов.');
    if (password !== $('#recovery-repeat').value) throw new Error('Новые пароли не совпадают');
    const current = version;
    const data = await api(token ? 'recovery/reset' : 'recovery/confirm', token ? {token, password} : {challengeId, code: $('#recovery-code').value, password});
    if (current !== version || !active) return;
    recoveredLogin = data.login;
    token = challengeId = undefined;
    $('#recovery-reset').hidden = $('#recovery-start').hidden = true;
    $('#recovery-success').hidden = false;
    write($('#recovery-title'), 'Доступ восстановлен');
    for (const selector of ['#recovery-code', '#recovery-password', '#recovery-repeat']) $(selector).value = '';
    message('');
    $('#recovery-sign-in').focus();
  });
  window.vpnPasswordRecovery = {
    get active() { return active; },
    setAuthMode(mode, changing) {
      $('#forgot-password').hidden = mode === 'register' || changing;
      if (active) hideAuth();
    }
  };
  window.addEventListener('fp-languagechange', () => {
    for (const [element, source] of copy) element.textContent = text(source);
    if (accountLabel && token) $('#recovery-instructions').append(accountLabel);
  });
  fetch('/vpn/api/auth-options', {credentials: 'same-origin', signal: AbortSignal.timeout(15000)}).then(response => {
    if (!response.ok) throw new Error('unavailable');
    return response.json();
  }).then(options => {
    $('#recovery-request').hidden = !options.recoveryEmail;
    $('#recovery-email-unavailable').hidden = Boolean(options.recoveryEmail);
    $('#recovery-telegram').hidden = $('#recovery-telegram-hint').hidden = !options.recoveryTelegram;
  }).catch(() => {
    $('#recovery-request').hidden = true;
    $('#recovery-email-unavailable').hidden = false;
  });
  if (fragments.has('recovery')) {
    // The fragment was scrubbed before even loading the available recovery methods.
    open();
    $('#recovery-start').hidden = true;
    if (!/^[A-Za-z0-9_-]{43}$/.test(token || '')) {
      token = undefined;
      $('#recovery-start').hidden = false;
      message('Ссылка устарела или не подходит. Запроси новую в Telegram или у поддержки.', true);
    } else {
      message('Проверяем ссылку…');
      const entryVersion = version;
      api('recovery/preview', {token}).then(data => {
        if (!active || version !== entryVersion) return;
        recoveredLogin = data.login;
        resetForm(true);
        message('');
        const account = document.createElement('code');
        account.className = 'recovery-account';
        account.dataset.fpNoI18n = '';
        account.textContent = data.login;
        accountLabel = account;
        $('#recovery-instructions').append(account);
      }).catch(error => {
        if (!active || version !== entryVersion) return;
        token = undefined;
        $('#recovery-start').hidden = false;
        message(error.message, true);
      });
    }
  }
})();
