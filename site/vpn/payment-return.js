(() => {
  'use strict';
  const storageKey = 'family-vpn-purchase-v2';
  const valid = id => typeof id === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id);
  const period = days => [30,90,180,365].includes(Number(days)) ? Number(days) : null;
  let intent = {};
  function save() { try { sessionStorage.setItem(storageKey,JSON.stringify(intent)); } catch { /* The current URL still keeps the selection. */ } }
  function clear() { intent={};try { sessionStorage.removeItem(storageKey);sessionStorage.removeItem('family-vpn-pending-order'); } catch { /* Optional recovery. */ } }
  window.vpnPurchaseIntent = {
    bind(account) {
      let previous;try { previous=JSON.parse(sessionStorage.getItem(storageKey));sessionStorage.removeItem('family-vpn-pending-order'); } catch { /* Optional recovery. */ }
      intent=typeof account==='string'&&account ? {account,...(previous?.account===account ? {days:period(previous.days),order:valid(previous.order)?previous.order:null} : {})} : {};
      save();return period(intent.days);
    },
    select(days) { if(intent.account&&period(days)){intent.days=period(days);save();} },
    rememberOrder(id,days) { if(intent.account&&valid(id)){intent.order=id;if(period(days))intent.days=period(days);save();} },
    forgetOrder(id) { if(!id||intent.order===id){delete intent.order;save();} },
    get order(){return valid(intent.order)?intent.order:null;},
    clear
  };
  window.vpnRememberCheckout = (id,days) => window.vpnPurchaseIntent.rememberOrder(id,days);
  window.vpnPaymentReturn = ({api, refreshSubscription, refreshOrders, getSubscription, status, onOrder=()=>{}}) => {
    const incoming = new URLSearchParams(location.hash.split('?')[1] || '').get('order');
    const order = valid(incoming) ? incoming : window.vpnPurchaseIntent.order;
    if (!valid(order) && !(getSubscription().payment_confirmed && getSubscription().sync_state !== 'synced')) return;
    let busy = false, stopped = false, attempts = 0, timer, overviewShown=false;
    function stop() {
      stopped = true; clearInterval(timer);
      window.removeEventListener('focus',check);
    }
    function overview(text,tone='info') {
      if (!overviewShown&&!location.hash.startsWith('#devices')) {
        history.replaceState(null,'',location.pathname + location.search + '#devices?platform='+(window.vpnDevicePlatform?.()||'android'));
        window.dispatchEvent(new Event('hashchange'));
      }
      overviewShown=true;status(text,tone);
    }
    async function check() {
      if (busy || stopped) return;
      busy = true;
      try {
        let state;
        if (valid(order)) {
          const checked=(await api('orders/' + order + '/check','POST',{})).order;
          state=checked.state;onOrder(checked);
          await refreshOrders();
        }
        await refreshSubscription();
        const sub = getSubscription();
        if (['canceled','refunded'].includes(state)) {
          window.vpnPurchaseIntent.forgetOrder(order);stop();
          status(state === 'canceled' ? 'Платёж отменён. Можно оплатить выбранный тариф ещё раз.' : 'Возврат подтверждён. Подписка пересчитана.');
        } else if (sub.active && sub.sync_state === 'synced' && (!valid(order) || state === 'paid')) {
          window.vpnPurchaseIntent.forgetOrder(order);stop();
          overview('Оплата подтверждена. Установи приложение и добавь подписку по инструкции ниже.','success');
        } else if (state === 'paid' || !valid(order) && sub.payment_confirmed) {
          overview('Оплата подтверждена. Готовим подключение; повторно платить не нужно.');
        } else {
          status('Ждём подтверждение платежа от ЮKassa. После оплаты подключение появится автоматически.');
        }
      } catch (error) {
        status(error.message,'error');
        if ([400,403,404].includes(error.status)) { window.vpnPurchaseIntent.forgetOrder(order);stop(); }
      } finally {
        busy = false;
        if (++attempts >= 36 && !stopped) {
          stop(); status('Проверка займёт больше времени. Открой «Подписка» → «История платежей» и проверь заказ. Повторно оплачивать не нужно.');
        }
      }
    }
    timer = setInterval(check,5000);
    window.addEventListener('focus',check);
    check();
    return stop;
  };
})();
