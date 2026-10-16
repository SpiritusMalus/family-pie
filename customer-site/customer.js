(() => {
  'use strict';
  document.documentElement.classList.add('js');
  let vpnPlan, suflerPlan;
  const lang = () => window.FPi18n?.lang === 'en' ? 'en' : 'ru';
  const originals = new WeakMap();
  const demos = [...document.querySelectorAll('[data-demo]')].map(root => {
    const frames = [...root.querySelectorAll('[data-frame]')];
    const image = root.querySelector('.demo-screen');
    const link = root.querySelector('.screen-link');
    const full = root.querySelector('.original-link');
    const caption = root.querySelector('.demo-description');
    const play = root.querySelector('.demo-play');
    const failure = root.querySelector('.screen-error');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let index = Number(root.dataset.initial) || 0, timer = null;
    function stop() {
      clearTimeout(timer);timer = null;
      play.dataset.ru = reduced.matches ? 'Следующий экран' : 'Короткое демо';
      play.dataset.en = reduced.matches ? 'Next screen' : 'Play short demo';
      play.textContent = play.dataset[lang()];play.setAttribute('aria-pressed','false');
    }
    function show(next) {
      index = next;
      const frame = frames[index];
      for (const target of [image,link]) {
        target.dataset.ru = frame.dataset.altRu;target.dataset.en = frame.dataset.altEn;
      }
      caption.dataset.ru = frame.dataset.captionRu;caption.dataset.en = frame.dataset.captionEn;
      caption.textContent = caption.dataset[lang()];
      image.alt = frame.dataset[lang() === 'en' ? 'altEn' : 'altRu'];
      link.setAttribute('aria-label',image.alt);
      link.href = frame.dataset.src;full.href = frame.dataset.src;
      image.hidden = false;failure.hidden = true;image.src = frame.dataset.src;
      frames.forEach((button,i) => button.setAttribute('aria-pressed',String(i === index)));
    }
    frames.forEach((button,i) => button.addEventListener('click',() => {stop();show(i);}));
    image.addEventListener('error',() => {image.hidden = true;failure.hidden = false;stop();});
    image.addEventListener('load',() => {image.hidden = false;failure.hidden = true;});
    // The page starts still. A finite sequence plays only after an explicit click.
    play.addEventListener('click',() => {
      if (timer !== null) {stop();return;}
      if (reduced.matches) {show((index+1)%frames.length);return;}
      show(0);play.dataset.ru = 'Пауза';play.dataset.en = 'Pause';
      play.textContent = play.dataset[lang()];play.setAttribute('aria-pressed','true');
      function advance() {
        if (index === frames.length-1) {stop();return;}
        show(index+1);timer = setTimeout(advance,3000);
      }
      timer = setTimeout(advance,3000);
    });
    reduced.addEventListener('change',stop);
    document.addEventListener('visibilitychange',() => {if(document.hidden)stop();});
    root.querySelector('.demo-controls').hidden = false;
    // Handle an already-failed cached image before attaching error listeners.
    if(image.complete && !image.naturalWidth){image.hidden=true;failure.hidden=false;}
    stop();
    return {stop};
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
