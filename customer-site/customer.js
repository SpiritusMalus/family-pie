(() => {
  'use strict';
  document.documentElement.classList.add('js');
  let vpnPlan, suflerPlan;
  const lang = () => window.FPi18n?.lang === 'en' ? 'en' : 'ru';
  const originals = new WeakMap();
  document.querySelectorAll('[data-demo]').forEach(root => {
    const frames = [...root.querySelectorAll('[data-frame]')];
    const image = root.querySelector('.demo-screen');
    const full = root.querySelector('.original-link');
    const caption = root.querySelector('.demo-description');
    const failure = root.querySelector('.screen-error');
    function show(index) {
      const frame = frames[index];
      image.dataset.ru = frame.dataset.altRu;image.dataset.en = frame.dataset.altEn;
      caption.dataset.ru = frame.dataset.captionRu;caption.dataset.en = frame.dataset.captionEn;
      caption.textContent = caption.dataset[lang()];
      image.alt = image.dataset[lang()];full.href = frame.dataset.src;
      image.hidden = false;failure.hidden = true;image.src = frame.dataset.src;
      frames.forEach((button,i) => button.setAttribute('aria-pressed',String(i === index)));
    }
    frames.forEach((button,i) => button.addEventListener('click',() => show(i)));
    image.addEventListener('error',() => {image.hidden = true;failure.hidden = false;});
    image.addEventListener('load',() => {image.hidden = false;failure.hidden = true;});
    root.querySelector('.demo-controls').hidden = false;
    if(image.complete && !image.naturalWidth){image.hidden=true;failure.hidden=false;}
  });
  function render() {
    document.querySelectorAll('[data-ru][data-en]').forEach(node => {
      const value = node.dataset[lang()];
      if (node.dataset.copyAttr) node.setAttribute(node.dataset.copyAttr, value);
      else if (node.textContent !== value) node.textContent = value;
    });
    const vpn = document.getElementById('vpn-price'), sufler = document.getElementById('sufler-price');
    if (vpn && vpnPlan) vpn.textContent = lang() === 'en' ? `${vpnPlan.priceMinor / 100} RUB for ${vpnPlan.days} days` : `${vpnPlan.priceMinor / 100} ₽ за ${vpnPlan.days} дней`;
    if (sufler && suflerPlan) sufler.textContent = lang() === 'en' ? `30 minutes free, then ${Number(suflerPlan.amount)} RUB for ${suflerPlan.days} days` : `30 минут бесплатно, затем ${Number(suflerPlan.amount)} ₽ за ${suflerPlan.days} дней`;
    document.querySelectorAll('a[href]').forEach(link => {
      const value = originals.get(link) || link.getAttribute('href');
      if (!value.startsWith('/') || value.startsWith('//')) return;
      if (/\.(png|jpg|jpeg|webp|svg|pdf|zip|exe|dmg|txt)$/i.test(new URL(value,location.origin).pathname)) return;
      originals.set(link, value);
      const url = new URL(value, location.origin);
      if (!/\.(png|jpg|jpeg|svg|pdf|zip|exe|dmg|txt)$/i.test(url.pathname)) url.searchParams.set('lang', lang());
      link.setAttribute('href', url.pathname + url.search + url.hash);
    });
  }
  document.querySelectorAll('.langtoggle [data-fp-lang]').forEach(button => button.addEventListener('click', () => window.FPi18n?.set(button.dataset.fpLang)));
  addEventListener('fp-languagechange', render);
  render();
  if (document.getElementById('vpn-price')) fetch('/public-plans/vpn', {cache:'no-store'}).then(r => {if (!r.ok) throw Error();return r.json();}).then(data => {
    const plan = data.available === true && data.testMode === false && data.plans?.find(p => p.days === 30 && Number.isSafeInteger(p.priceMinor) && p.priceMinor > 0);
    if (plan) {vpnPlan = plan;render();}
  }).catch(() => {});
  if (document.getElementById('sufler-price')) fetch('/public-plans/sufler', {cache:'no-store'}).then(r => {if (!r.ok) throw Error();return r.json();}).then(plan => {
    if (plan.enabled === true && plan.currency === 'RUB' && /^\d+\.\d{2}$/.test(plan.amount) && Number.isFinite(Number(plan.amount)) && Number(plan.amount) > 0 && Number.isSafeInteger(plan.days) && plan.days > 0) {suflerPlan = plan;render();}
  }).catch(() => {});
})();
