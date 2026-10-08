(() => {
 window.vpnTelegramLink = async ({api, settings, home, accountId}) => {
  let state, url = '', busy = false, checking = false, timer, deadline = 0, error = '';
  const notifyError = e => { error = e.message; render(); };
  const views = [];
  const deferKey = accountId ? 'family-vpn-telegram-later:'+accountId : '';
  let deferred = false;
  try { deferred = Boolean(deferKey && window.sessionStorage.getItem(deferKey)); } catch { /* The settings card stays usable when browser storage is blocked. */ }
  const node = (tag, text, cls) => { const e = document.createElement(tag); if (text) e.textContent = text; if (cls) e.className = cls; return e; };
  function stop() { clearInterval(timer); timer = undefined; }
  function render() {
   for (const v of views) {
    v.card.hidden = v.overview && Boolean(deferred || state?.linked && state?.enabled && !state?.pending);
    v.status.textContent = error || (!state?.available ? 'Telegram временно недоступен. Попробуй позже.' : state.pending ? `Подтверди, что ${state.candidate} — твой Telegram-аккаунт.` : state.linked && state.enabled ? 'Telegram подключён. В боте доступны подписка, срок действия и напоминания.' : url ? 'Нажми «Старт» в Telegram и вернись сюда. Кабинет сам проверит привязку.' : 'Подписка и срок действия — в боте. Напоминания помогут вовремя продлить доступ.');
    v.start.hidden = Boolean(state?.pending || state?.linked && state?.enabled);
    v.start.disabled = busy || !state?.available;
    v.start.textContent = busy ? 'Открываем Telegram…' : url ? 'Открыть Telegram снова' : 'Подключить Telegram';
    v.fallback.hidden = !url || Boolean(state?.pending || state?.linked && state?.enabled);
    v.fallback.href = url || '#';
    v.confirm.hidden = !state?.pending; v.confirm.disabled = busy;
    v.unlink.hidden = !state?.linked && !state?.pending; v.unlink.disabled = busy;
    v.cancel.hidden = !url || Boolean(state?.pending || state?.linked && state?.enabled); v.cancel.disabled = busy;
   }
  }
  async function refresh() {
   if (checking) return;
   if (url && deadline && Date.now() >= deadline) { url = ''; deadline = 0; stop(); }
   checking = true;
   try { state = await api('telegram'); error = '';  if (state.linked && state.enabled && !state.pending) { url = ''; stop(); } render(); }
   catch (e) { notifyError(e); }
   finally { checking = false; }
  }
  function watch() {
   stop();
   timer = setInterval(() => { if (Date.now() >= deadline) { url = ''; stop(); error = 'Ссылка истекла. Нажми «Подключить Telegram» ещё раз.'; render(); } else if (!document.hidden) refresh(); }, 2500);
  }
  async function start() {
   if (busy) return;
   if (url && Date.now() >= deadline) { url = ''; stop(); }
   // Open synchronously during the click so mobile browsers permit the new tab.
   let popup = window.open('about:blank', '_blank');
   if (popup) popup.opener = null;
   busy = true; error = ''; render();
   try {
    if (!url) {
     const data = await api('telegram/link', 'POST', {}), parsed = new URL(data.url);
     if (parsed.origin !== 'https://t.me' || !/^\/[A-Za-z0-9_]{5,32}$/.test(parsed.pathname) || !/^bind_[A-Za-z0-9_-]{43}$/.test(parsed.searchParams.get('start') || '')) throw new Error('Не удалось открыть Telegram. Попробуй ещё раз.');
     url = parsed.href; deadline = Date.now() + 600000; watch();
    }
    if (popup && !popup.closed) popup.location.href = url;
    render();
   } catch (e) { popup?.close(); notifyError(e); }
   finally { busy = false; render(); }
  }
  async function confirm() {
   if (busy) return; busy = true; error = ''; render();
   try { await api('telegram/confirm', 'POST', {}); url = ''; stop(); await refresh(); }
   catch (e) { notifyError(e); }
   finally { busy = false; render(); }
  }
  async function disconnect() {
   if (busy) return; busy = true; error = ''; render();
   try { await api('telegram', 'DELETE', {}); url = ''; stop(); await refresh(); }
   catch (e) { notifyError(e); }
   finally { busy = false; render(); }
  }
  for (const [container, overview] of [[home, true], [settings, false]]) {
   if (!container) continue;
   const card = node('section', '', 'panel cab-section telegram-link'); card.dataset.telegramLink = '';
   card.append(node('h2', 'Подписка в Telegram'));
   const status = node('p', 'Проверяем Telegram…', 'muted'); status.setAttribute('aria-live', 'polite');
   const actions = node('div', '', 'telegram-actions');
   const startButton = node('button', 'Подключить Telegram', 'btn'), confirmButton = node('button', 'Это мой Telegram — подключить', 'btn'), unlink = node('button', 'Отключить Telegram', 'btn secondary'), cancel = node('button', 'Отменить привязку', 'btn secondary'), fallback = node('a', 'Открыть бота', 'btn secondary');
   for (const b of [startButton, confirmButton, unlink, cancel]) b.type = 'button';
   fallback.target = '_blank'; fallback.rel = 'noopener noreferrer';
   startButton.addEventListener('click', start); confirmButton.addEventListener('click', confirm); unlink.addEventListener('click', disconnect); cancel.addEventListener('click', disconnect);
   for (const e of [confirmButton, unlink, cancel, fallback]) e.hidden = true;
   actions.append(startButton, confirmButton, fallback, cancel, unlink); card.append(status, actions);
   if (overview) { const later = node('button', 'Позже', 'btn secondary'); later.type = 'button'; later.addEventListener('click', () => { deferred = true; try { if (deferKey) window.sessionStorage.setItem(deferKey, '1'); } catch { /* Keep dismissal for this render if storage is unavailable. */ } card.remove(); views.splice(views.indexOf(view), 1); }); actions.append(later); }
   const view = {card, overview, status, start: startButton, confirm: confirmButton, unlink, cancel, fallback}; views.push(view); container.append(card);
  }
  window.addEventListener('focus', refresh);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) refresh(); });
  window.addEventListener('pagehide', stop);
  window.addEventListener('pageshow', () => { if (url) watch(); refresh(); });
  await refresh();
 };
})();
