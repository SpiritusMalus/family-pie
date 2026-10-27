(() => {
  'use strict';
  const key = 'family-vpn-setup-progress-v1';
  const text = value => window.FPi18n?.t(value) || value;
  let accountId, ready = false, stage = 1;
  const platform = () => window.vpnDevicePlatform?.() || 'android';
  const saved = () => {
    try {
      const value = JSON.parse(localStorage.getItem(key) || 'null');
      return value?.accountId === accountId && [1, 2, 3, 4].includes(value.steps?.[platform()]) ? value.steps[platform()] : 1;
    } catch { return 1; }
  };
  function remember() {
    if (!accountId) return;
    try {
      let value = JSON.parse(localStorage.getItem(key) || 'null');
      if (value?.accountId !== accountId) value = {accountId, steps: {}};
      value.steps = value.steps && typeof value.steps === 'object' ? value.steps : {};
      value.steps[platform()] = stage;
      localStorage.setItem(key, JSON.stringify(value));
    } catch { /* Setup remains usable when storage is unavailable. */ }
  }
  function requested() {
    const value = new URLSearchParams(location.hash.split('?')[1] || '').get('step');
    return value === 'import' ? 2 : value === 'connect' ? 3 : value === 'install' ? 1 : null;
  }
  const resume = () => saved() === 4 && requested() === 3 ? 4 : requested() || saved();
  function render(focus = false) {
    const guide = document.querySelector('#guide');
    if (!guide) return;
    const progress = guide.querySelector('[data-setup-progress]');
    if (!progress) return;
    if (!ready && stage > 2) stage = 2;
    progress.replaceChildren();
    const label = document.createElement('p');
    label.className = 'setup-progress-label';
    label.textContent = text(stage === 4 ? 'Настройка пройдена' : ['Шаг 1 из 3', 'Шаг 2 из 3', 'Шаг 3 из 3'][stage - 1]);
    progress.append(label);
    const nav = document.createElement('div');
    nav.className = 'setup-progress-nav';
    for (const [index, title] of ['Установка', 'Подписка', 'Подключение'].entries()) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = text(title);
      button.disabled = index === 2 && !ready;
      if (stage === index + 1) button.setAttribute('aria-current', 'step');
      button.addEventListener('click', () => go(index + 1));
      nav.append(button);
    }
    progress.append(nav);
    guide.querySelectorAll('[data-setup-step]').forEach(item => {
      item.hidden = Number(item.dataset.setupStep) !== stage;
      if (!item.hidden && focus) {
        const heading = item.querySelector('h3');
        heading.tabIndex = -1;
        heading.focus({preventScroll: true});
        item.scrollIntoView({block: 'start'});
      }
    });
    const complete = guide.querySelector('[data-setup-complete]');
    if (complete) {
      complete.hidden = stage !== 4;
      if (stage === 4 && focus) {
        const heading = complete.querySelector('h3');
        heading.tabIndex = -1;
        heading.focus({preventScroll: true});
      }
    }
  }
  function go(value) {
    if (![1, 2, 3, 4].includes(value) || value > 2 && !ready) return;
    stage = value;
    remember();
    const step = value === 1 ? 'install' : value === 2 ? 'import' : 'connect';
    history.replaceState(null, '', location.pathname + location.search + '#devices?platform=' + platform() + '&step=' + step);
    render(true);
  }
  function mount() {
    stage = resume();
    document.querySelectorAll('[data-setup-next]').forEach(button => button.addEventListener('click', () => go(Number(button.dataset.setupNext))));
    render();
  }
  window.vpnSetupProgress = {
    go,
    update(value) {
      const changed = accountId !== value.accountId;
      accountId = value.accountId;
      ready = value.ready;
      if (changed) stage = resume();
      render();
    }
  };
  window.addEventListener('vpn-platformchange', mount);
  window.addEventListener('fp-languagechange', () => render());
  mount();
})();
