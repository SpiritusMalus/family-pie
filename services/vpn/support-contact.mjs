// Existing public contact, also published in /vpn/terms/ and /vpn/privacy/.
// This is a support destination, never proof of ownership or an email-login identity.
export const SUPPORT_EMAIL='support@family-pie.ru';
export const SUPPORT_REQUEST_PROMPT='Укажи устройство, что происходит и когда началась проблема. Если вопрос об оплате, добавь номер заказа, если он есть.';
export const SUPPORT_PRIVACY_NOTE='Не отправляй пароли, коды входа, личную VPN-ссылку или данные карты.';

export function emailSupportText({html=false}={}){
 const address=html?'<code>'+SUPPORT_EMAIL+'</code>':SUPPORT_EMAIL;
 return 'Email поддержки: '+address+'\n'+SUPPORT_REQUEST_PROMPT+'\n'+SUPPORT_PRIVACY_NOTE;
}

// Inline Telegram URL buttons do not support mailto:. The public address can be copied instead.
export function supportEmailCopyButton(){return {text:'Скопировать email',copy_text:{text:SUPPORT_EMAIL}};}
