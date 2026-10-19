(() => {
  'use strict';
  document.documentElement.classList.add('js');
  let vpnPlan, suflerPlan;
  let vpnPlans = [];
  const lang = () => window.FPi18n?.lang === 'en' ? 'en' : 'ru';
  const originals = new WeakMap();
  document.querySelectorAll('[data-static-screen]').forEach(root => {
    const image = root.querySelector('.demo-screen');
    const failure = root.querySelector('.screen-error');
    image.addEventListener('error', () => {image.hidden = true;failure.hidden = false;});
    image.addEventListener('load', () => {image.hidden = false;failure.hidden = true;});
    if (image.complete && !image.naturalWidth) {image.hidden = true;failure.hidden = false;}
  });
  // Native details remain fully open without JS. Mobile exposes one offer at a time.
  const offers = [...document.querySelectorAll('details[data-vpn-plan]')];
  if (offers.length) {
    const narrow = window.matchMedia('(max-width:600px)');
    let selected = offers[0].dataset.vpnPlan;
    const arrange = () => {
      offers.forEach(offer => offer.removeAttribute('name'));
      offers.forEach(offer => {
        offer.open = !narrow.matches || offer.dataset.vpnPlan === selected;
        if (narrow.matches) offer.setAttribute('name', 'vpn-offers');
        const summary = offer.querySelector('summary');
        summary.tabIndex = narrow.matches ? 0 : -1;
      });
    };
    offers.forEach(offer => {
      offer.querySelector('summary').addEventListener('click', event => {
        if (!narrow.matches) event.preventDefault();
      });
      offer.addEventListener('toggle', () => {
        if (!narrow.matches || !offer.open) return;
        selected = offer.dataset.vpnPlan;
        offers.forEach(other => {if (other !== offer) other.open = false;});
      });
    });
    arrange();
    narrow.addEventListener('change', arrange);
  }
  function render() {
    document.querySelectorAll('[data-ru][data-en]').forEach(node => {
      const value = node.dataset[lang()];
      if (node.dataset.copyAttr) node.setAttribute(node.dataset.copyAttr, value);
      else if (node.textContent !== value) node.textContent = value;
    });
    const vpn = document.getElementById('vpn-price'), sufler = document.getElementById('sufler-price');
    if (vpn && vpnPlan) vpn.textContent = lang() === 'en' ? `${vpnPlan.priceMinor / 100} RUB for ${vpnPlan.days} days` : `${vpnPlan.priceMinor / 100} ₽ за ${vpnPlan.days} дней`;
    if (sufler && suflerPlan) sufler.textContent = lang() === 'en' ? `30 minutes free, then ${Number(suflerPlan.amount)} RUB for ${suflerPlan.days} days` : `30 минут бесплатно, затем ${Number(suflerPlan.amount)} ₽ за ${suflerPlan.days} дней`;
    const rate = Number(document.querySelector('.vpn-pricing')?.dataset.usdRub);
    const months = {30:1,90:3,180:6,365:12};
    const format = value => new Intl.NumberFormat(lang() === 'en' ? 'en-US' : 'ru-RU', {maximumFractionDigits:2}).format(value);
    const rubles = value => lang() === 'en' ? `${format(value)} RUB` : `${format(value)} ₽`;
    const bestPlan = vpnPlans.length > 1 && vpnPlans.reduce((best, p) =>
      p.priceMinor / months[p.days] < best.priceMinor / months[best.days] ? p : best);
    document.querySelectorAll('[data-vpn-plan]').forEach(card => {
      const plan = vpnPlans.find(p => p.days === Number(card.dataset.vpnPlan));
      if (!plan) return;
      const amount = card.querySelector('.vpn-plan-amount'), usd = card.querySelector('.vpn-plan-usd');
      const monthly = card.querySelector('.vpn-plan-monthly'), unit = card.querySelector('.vpn-plan-unit');
      const saving = card.querySelector('.vpn-plan-saving'), best = card.querySelector('.vpn-plan-best');
      const overview = card.querySelector('.vpn-plan-overview');
      if (overview) overview.textContent = rubles(plan.priceMinor / 100);
      monthly.textContent = rubles(plan.priceMinor / 100 / months[plan.days]);
      monthly.hidden = unit.hidden = false;
      amount.textContent = (lang() === 'en' ? 'Total ' : 'Всего ') + rubles(plan.priceMinor / 100);
      card.classList.add('has-price');
      card.dataset.best = String(bestPlan === plan && plan.days !== 30);
      best.hidden = card.dataset.best !== 'true';
      if (vpnPlan && Number.isSafeInteger(vpnPlan.priceMinor * months[plan.days])) {
        const saved = (vpnPlan.priceMinor * months[plan.days] - plan.priceMinor) / 100;
        saving.textContent = saved > 0 ? (lang() === 'en' ? 'Save ' : 'Экономия ') + rubles(saved) : '';
        saving.hidden = saved <= 0;
        saving.dataset.positive = String(saved > 0);
      }
      if (Number.isFinite(rate) && rate > 0) {
        usd.textContent = `≈ US$${(plan.priceMinor / 100 / rate).toFixed(2)}`;
        usd.hidden = false;
      }
    });
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
    if (data.available !== true || data.testMode !== false || !Array.isArray(data.plans)) return;
    vpnPlans = data.plans.filter(p => p && [30,90,180,365].includes(p.days) && Number.isSafeInteger(p.priceMinor) && p.priceMinor > 0);
    vpnPlan = vpnPlans.find(p => p.days === 30);
    render();
  }).catch(() => {});
  if (document.getElementById('sufler-price')) fetch('/public-plans/sufler', {cache:'no-store'}).then(r => {if (!r.ok) throw Error();return r.json();}).then(plan => {
    if (plan.enabled === true && plan.currency === 'RUB' && /^\d+\.\d{2}$/.test(plan.amount) && Number.isFinite(Number(plan.amount)) && Number(plan.amount) > 0 && Number.isSafeInteger(plan.days) && plan.days > 0) {suflerPlan = plan;render();}
  }).catch(() => {});
})();
