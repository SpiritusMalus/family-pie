(() => {
 const t=text=>window.FPi18n.t(text);
 const $=s=>document.querySelector(s);let csrf='',me,authVersion=0;
 const message=(x,tone='info')=>{const el=$('#account-message');if(el){el.dataset.tone=tone;el.textContent=x;}};
 async function api(path,method='GET',body){const version=authVersion;const r=await fetch('/vpn/api/'+path,{method,credentials:'same-origin',headers:{'Content-Type':'application/json',...(csrf?{'X-CSRF-Token':csrf}:{})},...(body?{body:JSON.stringify(body)}:{})});const d=await r.json();if(!r.ok){const e=new Error(d.error||'Сервис временно недоступен');e.status=r.status;throw e;}if(d.csrf&&version===authVersion)csrf=d.csrf;return d;}
 function el(tag,text,cls){const e=document.createElement(tag);if(text!==undefined)e.textContent=text;if(cls)e.className=cls;return e;}
 const destination=user=>{const next=new URLSearchParams(location.search).get('next');return next&&/^\/vpn\/cabinet\/(?:#[^\s]*)?$/.test(next)?next:user.role==='admin'?'/vpn/admin/':'/vpn/cabinet/';};
 window.vpnLoginDestination=destination;
 window.vpnFinishLogin=async()=>{
  authVersion++;
  try{me=await api('me');}catch(err){if(err.status===401){err.message='Не удалось сохранить вход. Разреши cookies для этого сайта и войди снова.';loginView(err.message);}throw err;}
  if(me.user.must_change||new URLSearchParams(location.search).has('change')){changeView();message('');}else location.href=destination(me.user);
 };

 const date=s=>s.unlimited?'Без ограничения срока':s.expires_at?new Date(s.expires_at).toLocaleDateString('ru-RU'):'Не задан';
 function authCopy(changing){
  const label=$('.demo-label'),intro=$('.auth-layout > div > p');
  if(label)label.hidden=changing;
  if(intro)intro.textContent=changing?'Обнови пароль, чтобы защитить свой аккаунт.':'Войди, чтобы открыть свою подписку и настройки.';
 }
 function changeView(){
  $('#login-form').hidden=true;$('#password-form').hidden=false;authCopy(true);
  $('#auth-title').textContent=me.user.must_change?'Смени временный пароль':'Сменить пароль';
  $('#password-form p').textContent=me.user.must_change?'Задай свой пароль от 12 символов. После сохранения откроется личный кабинет.':'Выбери новый пароль от 12 символов.';
 }
 function loginView(text,tone='error'){
  authVersion++;csrf='';
  if(me?.user?.login)$('#login').value=me.user.login;
  me=null;$('#password-form').hidden=true;$('#login-form').hidden=false;$('#auth-title').textContent='Вход в аккаунт';authCopy(false);
  for(const id of ['password','current','next','repeat'])$('#'+id).value='';
  message(text,tone);$('#password').focus();
 }
 $('#login-form')?.addEventListener('submit',async e=>{e.preventDefault();authVersion++;const b=e.submitter;let authenticated=false;b.disabled=true;message('Входим…');try{const d=await api('login','POST',{login:$('#login').value,password:$('#password').value});authenticated=true;me=d;
  // A successful credential check is not enough: ensure the browser retained the session cookie.
  me=await api('me');
  if(me.user.must_change||new URLSearchParams(location.search).has('change')){changeView();message('');}else location.href=destination(me.user);
 }catch(err){if(err.status===401&&authenticated)loginView('Не удалось сохранить вход. Разреши cookies для этого сайта и войди снова.');else message(err.message,'error');}finally{b.disabled=false;}});
 $('#password-form')?.addEventListener('submit',async e=>{e.preventDefault();if($('#next').value!==$('#repeat').value)return message('Новые пароли не совпадают','error');const b=e.submitter;b.disabled=true;message('Сохраняем пароль…');try{
  // Refresh CSRF and verify the session before submitting any password mutation.
  me=await api('me');await api('password','POST',{current:$('#current').value,next:$('#next').value});location.href=destination(me.user);
 }catch(err){if(err.status===401)loginView('Сессия завершилась. Войди снова, затем повтори смену пароля.');else message(err.message,'error');}finally{b.disabled=false;}});
 $('#switch-account')?.addEventListener('click',async e=>{
  const button=e.currentTarget;button.disabled=true;
  try{await api('me');await api('logout','POST',{});loginView('Войди с другим логином.','info');}
  catch(err){if(err.status===401)loginView('Войди с другим логином.','info');else message(err.message,'error');}
  finally{button.disabled=false;}
 });
 $('#admin-search')?.addEventListener('input',()=>{const q=$('#admin-search').value.trim().toLowerCase();document.querySelectorAll('.admin-user').forEach(r=>r.hidden=!r.dataset.login.includes(q));});
 async function adminList(){const d=await api('admin/users');const target=$('#admin-users');target.replaceChildren();for(const u of d.users){if(u.role==='admin')continue;const row=el('article',undefined,'admin-user');row.dataset.login=u.login.toLowerCase();const heading=el('h3',u.login);heading.dataset.fpNoI18n='';row.append(heading);const state=el('p',`${u.deleted?'Удалена':u.enabled&&(u.unlimited||u.expires_at>Date.now())?'Активна':'Неактивна'} · ${date(u)} · ${u.sync_state==='awaiting_payment'?'Ожидает оплаты ЮKassa':u.sync_state==='synced'?'Применено на VPN':u.sync_state==='error'?'Ошибка применения, проверь сервер':'Ожидает применения'}`,'muted');row.append(state);
  const form=el('form');const label=el('label','Доступ до');const input=el('input');input.type='date';if(u.expires_at)input.value=new Date(u.expires_at).toISOString().slice(0,10);label.append(input);form.append(label);const unlimited=el('input');unlimited.type='checkbox';unlimited.checked=Boolean(u.unlimited);unlimited.style.width='auto';const ul=el('label');ul.append(unlimited,document.createTextNode(' Без ограничения срока'));if(u.allow_unlimited)form.append(ul);else input.required=true;const save=el('button','Сохранить','btn small');save.type='submit';form.append(save);
  form.addEventListener('submit',async e=>{e.preventDefault();save.disabled=true;try{await api('admin/users/'+u.account_id,'PATCH',{expiresAt:input.value?Date.parse(input.value+'T23:59:59.000Z'):0,unlimited:unlimited.checked,enabled:true,deleted:false});await adminList();}catch(err){message(err.message,'error');}finally{save.disabled=false;}});
  const remove=el('button','Удалить подписку','btn small secondary');remove.type='button';remove.addEventListener('click',async()=>{if(!confirm(t('Отключить подписку этого пользователя? Запись сохранится для восстановления.')))return;try{await api('admin/users/'+u.account_id,'DELETE',{});await adminList();}catch(err){message(err.message,'error');}});form.append(remove);row.append(form);target.append(row);}}
 $('#create-user')?.addEventListener('submit',async e=>{e.preventDefault();const b=e.submitter;b.disabled=true;try{const d=await api('admin/users','POST',{login:$('#new-login').value,expiresAt:$('#new-expiry').value?Date.parse($('#new-expiry').value+'T23:59:59.000Z'):0,unlimited:false});$('#new-credentials').textContent=`Логин: ${d.login}. Временный пароль: ${d.temporaryPassword}. Передай лично: при входе пользователь обязан сменить пароль. Доступ к VPN появится только после подтверждённой оплаты ЮKassa.`;$('#new-login').value='';await adminList();}catch(err){message(err.message,'error');}finally{b.disabled=false;}});
 async function boot(){const version=authVersion;try{const fresh=await api('me');if(version!==authVersion)return;me=fresh;if($('#login-form')){if(new URLSearchParams(location.search).has('reauth')){$('#login').value=me.user.login;message('Подтверди пароль, чтобы изменить способы входа.');return;}if(me.user.must_change||new URLSearchParams(location.search).has('change'))changeView();else location.href=destination(me.user);return;}if(me.user.must_change){location.href='/vpn/cabinet/auth/';return;}
 const actions=$('.nav-actions');const logout=el('button','Выйти','btn small secondary');logout.addEventListener('click',async()=>{await api('logout','POST',{});location.href='/vpn/cabinet/auth/';});actions?.append(logout);
 if($('#admin-users')){if(me.user.role!=='admin'){message('Раздел доступен только администратору');$('#main').replaceChildren(el('h1','Нет доступа'));return;}await adminList();window.dispatchEvent(new CustomEvent('vpn-ready',{detail:{api,me}}));return;}
 $('.preview-bar').textContent=`Аккаунт: ${me.user.login}. Личный кабинет Family VPN.`;
 if(me.user.role==='admin'){const a=el('a','Администрирование','btn small');a.href='/vpn/admin/';actions?.append(a);}
 const panel=$('.subscription');const sub=me.subscription;panel.replaceChildren(el('h2',sub.payment_required?'Ожидаем подтверждение оплаты':sub.active?'Твоя подписка':'Подписка не активна'),el('p',sub.payment_required?'Аккаунт создан. Ключ VPN выдаётся только после подтверждённой оплаты ЮKassa. Выбери тариф в разделе «Подписка».':`${date(sub)}${sub.sync_state!=='synced'?' · Изменения ещё применяются на VPN':''}`));
 if(sub.active&&sub.profile_url&&sub.sync_state==='synced'){const copy=el('button','Скопировать подключение','btn');copy.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(sub.profile_url);copy.textContent='Скопировано';}catch{copy.textContent='Не удалось скопировать';}});panel.append(copy);}
 const settings=$('[data-screen="settings"]');const a=el('a','Сменить пароль','btn secondary');a.href='/vpn/cabinet/auth/?change=1';settings?.append(a);
 await window.vpnTelegramLink({api,settings,home:$('[data-screen="home"]')});window.dispatchEvent(new CustomEvent('vpn-ready',{detail:{api,me}}));
 }catch(err){if(version!==authVersion)return;if(err.status===401){if(!$('#login-form'))location.href='/vpn/cabinet/auth/?next='+encodeURIComponent(location.pathname+location.hash);}else message(err.message,'error');}}
 boot();
})();
