(() => {
  'use strict';
  if('serviceWorker' in navigator)navigator.serviceWorker.register('/vpn/sw.js',{scope:'/vpn/'}).catch(()=>{});
  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];
  const read = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
  const store = (key, value) => { try { localStorage.setItem(key, value); } catch { /* Preferences remain usable without storage. */ } };
  function theme(value) { document.body.classList.toggle('light', value === 'light'); store('family-vpn-theme-v3', value); const select = $('#appearance'); if (select) select.value = value; }
  theme(read('family-vpn-theme-v3') || 'dark');
  $$('[data-theme]').forEach(btn => btn.addEventListener('click', () => theme(document.body.classList.contains('light') ? 'dark' : 'light')));
  $('#appearance')?.addEventListener('change', e => theme(e.target.value));
  $('[data-menu]')?.addEventListener('click', e => { const button = e.currentTarget; const open = button.getAttribute('aria-expanded') !== 'true'; button.setAttribute('aria-expanded', String(open)); $('#navigation').classList.toggle('open', open); });
  $$('#navigation a').forEach(a => a.addEventListener('click', () => { $('#navigation').classList.remove('open'); $('[data-menu]').setAttribute('aria-expanded', 'false'); }));
  const guideData = {
    android: ['Android', 'Установи Happ из Google Play. Если магазин недоступен, скачай APK с официальной страницы.', [['Google Play','https://play.google.com/store/apps/details?id=com.happproxy'],['Скачать APK','https://github.com/Happ-proxy/happ-android/releases/latest/download/Happ.apk']]],
    ios: ['iPhone и iPad', 'Установи Happ из App Store. Если приложение недоступно для твоего региона, обратись в поддержку.', [['App Store','https://apps.apple.com/us/app/happ-proxy-utility/id6504287215'],['Помощь с установкой','#support']]],
    windows: ['Windows', 'Скачай установщик Happ для своего компьютера. Обычно подходит версия x64; ARM64 нужна для компьютеров на ARM.', [['Windows x64','https://github.com/Happ-proxy/happ-desktop/releases/latest/download/setup-Happ.x64.exe'],['Windows ARM64','https://github.com/Happ-proxy/happ-desktop/releases/latest/download/setup-Happ.arm64.exe']]],
    macos: ['macOS', 'Скачай Happ для Mac или установи его из App Store.', [['Скачать для Mac','https://github.com/Happ-proxy/happ-desktop/releases/latest/download/Happ.macOS.universal.dmg'],['App Store','https://apps.apple.com/us/app/happ-proxy-utility/id6504287215']]],
    linux: ['Linux', 'Для Ubuntu и Debian выбери DEB, для Fedora — RPM. Другие сборки доступны на официальной странице.', [['Linux DEB · x64','https://github.com/Happ-proxy/happ-desktop/releases/latest/download/Happ.linux.x64.deb'],['Linux RPM · x64','https://github.com/Happ-proxy/happ-desktop/releases/latest/download/Happ.linux.x64.rpm'],['Все сборки','https://www.happ.su/main/ru']]],
    tv: ['Smart TV', 'Для Android TV установи Happ из Google Play, для Apple TV — из App Store. На других телевизорах подключение можно настроить через совместимый роутер.', [['Android TV','https://play.google.com/store/apps/details?id=com.happproxy'],['Apple TV','https://apps.apple.com/us/app/happ-proxy-utility-for-tv/id6748297274'],['Инструкция Android TV','https://www.happ.su/main/ru/faq/android-tv']]]
  };
  function platform(key) {
    if (!(key in guideData)) key = 'android';
    const [name, first, downloads] = guideData[key];
    $$('[data-platform]').forEach(b => { b.setAttribute('aria-selected', String(b.dataset.platform === key)); b.tabIndex = b.dataset.platform === key ? 0 : -1; });
    const target = $('#guide'); if (!target) return;
    target.setAttribute('aria-labelledby', `tab-${key}`);
    target.innerHTML = `<h2>Подключение: ${name}</h2><ol><li><strong>Установи Happ.</strong><br>${first}<div class="guide-downloads">${downloads.map(([label,url])=>`<a class="btn secondary small" href="${url}"${url.startsWith('#')?'':' target="_blank" rel="noopener noreferrer"'}>${label}${url.startsWith('#')?'':' ↗'}</a>`).join('')}</div></li><li><strong>Добавь подписку.</strong><br>Открой «Моё подключение» ниже. После оплаты там появятся личная ссылка и QR-код. Нажми «Добавить в Happ», чтобы импортировать подписку автоматически, или добавь ссылку из буфера обмена внутри приложения.</li><li><strong>Включи VPN.</strong><br>Выбери маршрут и нажми подключение. При первом запуске разреши приложению создать VPN-соединение.</li></ol><a class="btn secondary small" href="#home">Открыть моё подключение</a><a class="btn secondary small" href="#support">Помощь с настройкой</a>`;

  }
  $$('[data-platform]').forEach((btn, index, list) => {
    btn.addEventListener('click', () => { location.hash = `devices?platform=${btn.dataset.platform}`; });
    btn.addEventListener('keydown', e => { let next; if (e.key === 'ArrowRight') next = (index + 1) % list.length; if (e.key === 'ArrowLeft') next = (index + list.length - 1) % list.length; if (e.key === 'Home') next = 0; if (e.key === 'End') next = list.length - 1; if (next !== undefined) { e.preventDefault(); list[next].click(); list[next].focus(); } });
  });
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
    if (key === 'plans' && ['30','90','180','365'].includes(params.get('period'))) window.dispatchEvent(new CustomEvent('vpn-plan-selection',{detail:{days:Number(params.get('period'))}}));
    document.title = `${$('[data-route][aria-current="page"]')?.textContent.trim() || 'Кабинет'} — Family VPN`;
  }
  window.addEventListener('hashchange', route);
  window.addEventListener('fp-languagechange', route); route();
})();
