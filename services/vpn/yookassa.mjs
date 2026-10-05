// Notifications are hints, never authoritative payment proofs.
export class YooKassaReader {
  constructor({ shopId, secret, testMode = true, request = fetch }) {
    if (!shopId || !secret) throw new Error('VPN merchant configuration missing');
    this.shopId = String(shopId); this.secret = secret; this.testMode = testMode; this.request = request;
  }
  async object(type,id) {
    if (!['payments','refunds'].includes(type) || typeof id !== 'string' || !/^[A-Za-z0-9-]{1,128}$/.test(id))
      throw new Error('Invalid provider object');
    const response = await this.request(`https://api.yookassa.ru/v3/${type}/${id}`, {
      headers: { Authorization:`Basic ${Buffer.from(`${this.shopId}:${this.secret}`).toString('base64')}` },
      signal:AbortSignal.timeout(8000), redirect:'error'
    });
    if (!response.ok) throw new Error('Provider verification unavailable');
    const object = await response.json();
    if (object.id !== id) throw new Error('Provider object mismatch');
    if (type === 'payments' && (object.recipient?.account_id !== this.shopId || object.test !== this.testMode))
      throw new Error('Wrong merchant or payment mode');
    return object;
  }
  async confirmPayment(store,id) {
    return store.confirmPayment(await this.object('payments',id),{testMode:this.testMode});
  }
  async confirmRefund(store,id) {
    const refund = await this.object('refunds',id);
    const payment = await this.object('payments',refund.payment_id);
    if (payment.status !== 'succeeded' || payment.paid !== true) throw new Error('Original payment unverified');
    return store.confirmFullRefund(refund);
  }
}
