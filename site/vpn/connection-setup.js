(() => {
  'use strict';
  const node = (tag, text, className) => {
    const element = document.createElement(tag);
    if (text !== undefined) element.textContent = text;
    if (className) element.className = className;
    return element;
  };
  let current;
  const rendered = new WeakMap();
  const observed = new Set();
  function track(event) {
    if (!current?.api || !location.hash.startsWith('#devices')) return;
    const platform = window.vpnDevicePlatform?.() || 'android';
    const key = [current.accountId, platform, event].join(':');
    if (observed.has(key)) return;
    observed.add(key);
    current.api('onboarding/events', 'POST', {event, platform}).catch(() => {});
  }
  window.vpnOnboardingEvent = track;
  const text = value => window.FPi18n?.t(value) || value;
  function personalURL(value) {
    try {
      const url = new URL(value);
      return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
    } catch { return null; }
  }
  function link(label, href, secondary = false) {
    const element = node('a', text(label), 'btn' + (secondary ? ' secondary' : ''));
    element.href = href;
    element.referrerPolicy = 'no-referrer';
    return element;
  }
  function render() {
    const target = document.querySelector('[data-connection-slot]');
    if (!target || !current) return;
    const {subscription: sub, refresh, status} = current;
    track('setup_open');
    const url = personalURL(sub.profile_url);
    const ready = Boolean(sub.active && sub.sync_state === 'synced' && url);
    window.vpnSetupProgress?.update({accountId: current.accountId, ready});
    const signature = JSON.stringify([ready, url, sub.payment_confirmed, sub.sync_state, sub.active, sub.expires_at, window.FPi18n?.lang]);
    if (rendered.get(target) === signature) return;
    // The private URL lives only in this authenticated DOM, never in storage or events.
    rendered.set(target, signature);
    target.replaceChildren();
    if (!ready) {
      const preparing = sub.payment_confirmed && sub.sync_state !== 'synced';
      const expired = !preparing && !sub.active && sub.expires_at && sub.expires_at <= Date.now();
      const message = sub.sync_state === 'error'
        ? 'Оплата подтверждена, но подключение пока не готово. Напиши в поддержку.'
        : preparing ? 'Оплата подтверждена. Готовим подключение; повторно платить не нужно.'
          : expired ? 'Подписка закончилась. Продли её, чтобы добавить подключение.'
            : sub.payment_confirmed ? 'Доступ приостановлен. Напиши в поддержку.'
              : 'Личная ссылка появится после оплаты подписки.';
      target.append(node('p', text(message), 'setup-state'));
      if (preparing && sub.sync_state !== 'error') {
        const retry = node('button', text('Проверить подключение'), 'btn secondary');
        retry.type = 'button';
        retry.addEventListener('click', async () => {
          retry.disabled = true;
          try { await refresh(); } catch (error) { status(error.message, 'error'); }
          finally { retry.disabled = false; }
        });
        target.append(retry);
      } else target.append(link(sub.payment_confirmed && !expired ? 'Написать в поддержку' : 'Выбрать подписку', sub.payment_confirmed && !expired ? '#support' : '#plans'));
      return;
    }
    target.append(node('p', text('В приложении не нужен логин от сайта. Добавь подписку по личной ссылке.')));
    const actions = node('div', undefined, 'cab-actions setup-import-actions');
    const add = link('Добавить подписку в приложение', 'happ://add/' + url);
    add.addEventListener('click', () => track('import_click'));
    const copy = node('button', text('Скопировать ссылку'), 'btn secondary');
    copy.type = 'button';
    const manual = node('details', undefined, 'setup-manual');
    manual.append(node('summary', text('Не открылось приложение? Добавить вручную')));
    const label = node('label', text('Личная ссылка подписки'), 'form-row');
    const input = node('textarea');
    input.readOnly = true;
    input.rows = 2;
    input.value = url;
    input.setAttribute('aria-label', text('Личная ссылка подписки'));
    input.setAttribute('data-fp-no-i18n', '');
    input.spellcheck = false;
    input.addEventListener('copy', () => track('manual_copy'));
    label.append(input);
    manual.append(label, node('p', text('Скопируй эту ссылку. В Happ нажми «+» и добавь подписку из буфера обмена.'), 'muted'));
    const feedback = node('p', undefined, 'setup-feedback');
    feedback.setAttribute('role', 'status');
    copy.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(url);
        track('manual_copy');
        feedback.textContent = text('Ссылка скопирована. Открой Happ и добавь её из буфера обмена.');
      } catch {
        manual.open = true;
        input.focus();
        input.select();
        feedback.textContent = text('Браузер не разрешил копирование. Выделенная ссылка доступна для копирования вручную.');
      }
    });
    actions.append(add, copy);
    const next = node('button', text('Подписка добавлена. Дальше'), 'btn secondary setup-continue');
    next.type = 'button';
    next.addEventListener('click', () => window.vpnSetupProgress?.go(3));
    const qr = node('details', undefined, 'setup-qr');
    qr.append(node('summary', text('QR-код для другого устройства')));
    const image = node('img');
    image.src = '/vpn/api/subscription/qr';
    image.alt = text('Личный QR-код подключения');
    image.width = image.height = 224;
    image.loading = 'lazy';
    qr.append(image, node('p', text('Открой Happ на другом устройстве и отсканируй этот код.'), 'muted'));
    target.append(actions, feedback, manual, node('p', text('После добавления подписки вернись сюда и продолжи настройку.'), 'muted'), next, qr, node('p', text('Не передавай личную ссылку и QR-код другим людям.'), 'setup-privacy muted'));
  }
  window.vpnConnectionSetup = {update(value) { current = value; render(); }};
  window.addEventListener('vpn-platformchange', render);
  window.addEventListener('fp-languagechange', render);
})();
