(() => {
  const storageKey = 'family-vpn-pending-order';
  const valid = id => typeof id === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(id);
  function saved() { try { return sessionStorage.getItem(storageKey); } catch { return null; } }
  function forget() { try { sessionStorage.removeItem(storageKey); } catch { /* Optional recovery. */ } }
  window.vpnRememberCheckout = id => { if (valid(id)) try { sessionStorage.setItem(storageKey,id); } catch { /* The return URL still identifies the order. */ } };
  window.vpnPaymentReturn = ({api, refreshSubscription, refreshOrders, getSubscription, status}) => {
    const incoming = new URLSearchParams(location.hash.split('?')[1] || '').get('order');
    const order = valid(incoming) ? incoming : saved();
    if (!valid(order) && !(getSubscription().payment_confirmed && getSubscription().sync_state !== 'synced')) return;
    let busy = false, stopped = false, attempts = 0, timer;
    function stop() {
      stopped = true; clearInterval(timer);
      window.removeEventListener('focus',check);
    }
    function overview(text) {
      history.replaceState(null,'',location.pathname + location.search + '#home');
      window.dispatchEvent(new Event('hashchange'));
      status(text);
    }
    async function check() {
      if (busy || stopped) return;
      busy = true;
      try {
        let state;
        if (valid(order)) {
          state = (await api('orders/' + order + '/check','POST',{})).order.state;
          await refreshOrders();
        }
        await refreshSubscription();
        const sub = getSubscription();
        if (['canceled','refunded'].includes(state)) {
          forget(); stop();
          status(state === 'canceled' ? 'Платёж отменён. Деньги за этот заказ не приняты.' : 'Возврат подтверждён. Подписка пересчитана.');
        } else if (sub.active && sub.sync_state === 'synced' && (!valid(order) || state === 'paid')) {
          forget(); stop();
          overview('Оплата подтверждена. Твоё подключение готово — добавь его в Happ или открой QR-код ниже.');
        } else if (state === 'paid' || !valid(order) && sub.payment_confirmed) {
          overview('Оплата подтверждена. Готовим подключение; повторно платить не нужно.');
        } else {
          status('Ждём подтверждение платежа от ЮKassa. После оплаты подключение появится автоматически.');
        }
      } catch (error) {
        status(error.message);
        if ([400,403,404].includes(error.status)) { forget(); stop(); }
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
