(() => {
  'use strict';
  const t = text => window.FPi18n.t(text);
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const read = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
  const store = (key, value) => { try { localStorage.setItem(key, value); } catch { /* Preferences remain usable without storage. */ } };
  let toastTimer;
  function toast(message) { const el = $('.toast'); if (!el) return; el.textContent = message; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 5500); }
  function theme(value) { document.body.classList.toggle('light', value === 'light'); store('family-vpn-theme-v3', value); const select = $('#appearance'); if (select) select.value = value; }
  theme(read('family-vpn-theme-v3') || 'dark');
  $$('[data-theme]').forEach(btn => btn.addEventListener('click', () => theme(document.body.classList.contains('light') ? 'dark' : 'light')));
  $('#appearance')?.addEventListener('change', e => theme(e.target.value));
  $('[data-menu]')?.addEventListener('click', e => { const button = e.currentTarget; const open = button.getAttribute('aria-expanded') !== 'true'; button.setAttribute('aria-expanded', String(open)); $('#navigation').classList.toggle('open', open); });
  $$('#navigation a').forEach(a => a.addEventListener('click', () => { $('#navigation').classList.remove('open'); $('[data-menu]').setAttribute('aria-expanded', 'false'); }));
  async function copy(text) { try { await navigator.clipboard.writeText(t(text)); toast('Скопировано'); } catch { toast('Не удалось скопировать. Разреши доступ к буферу обмена или скопируй вручную.'); } }
  $('[data-share]')?.addEventListener('click', () => copy('https://family-pie.ru/vpn/'));
  $('[data-copy-checklist]')?.addEventListener('click', () => copy('Устройство:\nВерсия VPN-приложения:\nПровайдер:\nВремя ошибки:\nМаршрут:\nТекст ошибки:\nНе добавляй личную ссылку подписки или QR-код.'));
  $$('[data-auth]').forEach(b => b.addEventListener('click', () => { $('#auth-message').textContent = `Вход через ${b.dataset.auth} ещё не подключён. Открой демонстрацию кабинета — регистрация не нужна.`; }));
  $('[data-promo]')?.addEventListener('click', () => { $('#promo-message').textContent = $('#promo').value.trim() ? 'Проверка промокодов ещё не подключена. Код не применён.' : 'Сначала введи код.'; });
  const draft = $('#support-draft');
  if (draft) draft.value = read('family-vpn-support-draft') || '';
  $('[data-draft]')?.addEventListener('click', () => { try { localStorage.setItem('family-vpn-support-draft', draft.value); toast('Черновик сохранён только в этом браузере'); } catch { toast('Браузер не разрешает сохранять черновик'); } });
  const newsPreference = $('#news-preference');
  if (newsPreference) { newsPreference.checked = read('family-vpn-show-news') !== 'false'; newsPreference.addEventListener('change', () => { store('family-vpn-show-news', String(newsPreference.checked)); const newsLink = $('[data-route="news"]'); newsLink.hidden = !newsPreference.checked; toast('Настройка сохранена'); }); $('[data-route="news"]').hidden = !newsPreference.checked; }
  $('[data-probe]')?.addEventListener('click', async e => { const button = e.currentTarget; button.disabled = true; button.textContent = 'Проверяю…'; $('#probe-message').textContent = 'Ожидаем ответ сайта…'; const started = performance.now(); const controller = new AbortController(); const timer = setTimeout(() => controller.abort(), 10000); try { const response = await fetch('/vpn/probe.json?t=' + Date.now(), { cache: 'no-store', signal: controller.signal }); if (!response.ok) throw new Error('HTTP'); const data = await response.json(); if (data.service !== 'family-vpn-site') throw new Error('Unexpected response'); $('#latency').textContent = Math.round(performance.now() - started) + ' мс'; $('#probe-message').textContent = 'Сайт отвечает. Это не подтверждение работы VPN.'; } catch { $('#latency').textContent = '—'; $('#probe-message').textContent = 'Сайт не ответил за время проверки. Проверь интернет и повтори.'; } finally { clearTimeout(timer); button.disabled = false; button.textContent = 'Проверить соединение'; } });
  const guideData = {
    android: ['Android', 'Установи Happ из магазина приложений или с официального сайта разработчика.'],
    ios: ['iPhone и iPad', 'Найди Happ в App Store. Доступность приложения зависит от региона твоего аккаунта.'],
    windows: ['Windows', 'Скачай Happ для Windows с официального сайта и установи приложение.'],
    macos: ['macOS', 'Установи Happ для macOS с официального сайта или из App Store, если приложение доступно в твоём регионе.'],
    linux: ['Linux', 'Выбери клиент с поддержкой формата своей подписки. Перед импортом проверь совместимость клиента с выданным профилем.'],
    tv: ['Smart TV', 'Проверь операционную систему телевизора. Для Android TV нужен совместимый клиент; для других систем может потребоваться подключение через роутер.']
  };
  function platform(key) {
    if (!(key in guideData)) key = 'android';
    const [name, first] = guideData[key];
    $$('[data-platform]').forEach(b => { b.setAttribute('aria-selected', String(b.dataset.platform === key)); b.tabIndex = b.dataset.platform === key ? 0 : -1; });
    const target = $('#guide'); if (!target) return;
    target.setAttribute('aria-labelledby', `tab-${key}`);
    target.innerHTML = `<h2>Подключение: ${name}</h2><ol><li><strong>Установи приложение.</strong><br>${first}</li><li><strong>Добавь подписку.</strong><br>Скопируй свою личную ссылку, открой приложение и выбери добавление из буфера обмена. В этом демо действующей ссылки нет.</li><li><strong>Включи VPN.</strong><br>Выбери маршрут, нажми подключение и подтверди системный запрос на создание VPN-соединения.</li></ol><a class="btn secondary small" href="https://www.happ.su/" target="_blank" rel="noopener noreferrer">Официальный сайт Happ ↗</a><p class="demo-label">Для Linux и телевизора сначала проверь совместимость выбранного клиента. Если установка не подходит — открой раздел «Помощь».</p>`;
  }
  $$('[data-platform]').forEach((btn, index, list) => {
    btn.addEventListener('click', () => { location.hash = `devices?platform=${btn.dataset.platform}`; });
    btn.addEventListener('keydown', e => { let next; if (e.key === 'ArrowRight') next = (index + 1) % list.length; if (e.key === 'ArrowLeft') next = (index + list.length - 1) % list.length; if (e.key === 'Home') next = 0; if (e.key === 'End') next = list.length - 1; if (next !== undefined) { e.preventDefault(); list[next].click(); list[next].focus(); } });
  });
  $$('[data-plan]').forEach(a => a.addEventListener('click', e => { e.preventDefault(); const period = a.dataset.plan; $('#plan-message').textContent = `Выбран период: ${period} дней. Цена ещё не утверждена. Оплата и выдача доступа пока недоступны.`; toast(`Выбран период: ${period} дней`); }));
  let previousScreen;
  function route() {
    if (!$('[data-screen]')) return;
    const [requested, query = ''] = location.hash.slice(1).split('?');
    const key = $$('[data-screen]').some(x => x.dataset.screen === requested) ? requested : 'home';
    $$('[data-screen]').forEach(el => { el.hidden = el.dataset.screen !== key; });
    $$('[data-route]').forEach(el => { if (el.dataset.route === key) el.setAttribute('aria-current', 'page'); else el.removeAttribute('aria-current'); });
    if (previousScreen && previousScreen !== key) { window.scrollTo(0, 0); const heading = document.querySelector(`[data-screen="${key}"] h1`); if (heading) { heading.tabIndex = -1; heading.focus({preventScroll:true}); } }
    previousScreen = key;
    const params = new URLSearchParams(query);
    if (key === 'devices') platform(params.get('platform') || 'android');
    if (key === 'plans' && ['30','90','180','365'].includes(params.get('period'))) $('#plan-message').textContent = `Выбран период: ${params.get('period')} дней. Цена ещё не утверждена; оплата пока недоступна.`;
    document.title = `${$('[data-route][aria-current="page"]')?.textContent.trim() || 'Кабинет'} — Family VPN`;
  }
  window.addEventListener('hashchange', route);
  window.addEventListener('fp-languagechange', route); route();
})();
