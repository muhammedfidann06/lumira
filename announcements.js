(function(root){'use strict';
 const COPY={
 tr:{title:'Bildirim gönder',sub:'Bir kişiye veya herkese, hesap başına bir kez görünen bir mesaj gönder.',all:'Herkes',one:'Bir kişi',scope:'Alıcı',search:'Kullanıcı adı ara',choose:'Kişi seç',heading:'Başlık',message:'Mesaj',preview:'Önizleme',send:'Bildirimi gönder',sent:'Bildirim hazır. Alıcı uygulamaya girdiğinde bir kez görecek.',error:'Bildirim işlemi tamamlanamadı. Yeniden dene.',loading:'Kullanıcılar yükleniyor…',empty:'Kullanıcı bulunamadı.',done:'Gördüm, teşekkürler',close:'Bildirimi kapat',notice:'LUMIRA’DAN BİR MESAJ',selected:'Seçilen kişi: '},
 en:{title:'Send a message',sub:'Send one person or everyone a message shown once per account.',all:'Everyone',one:'One person',scope:'Recipient',search:'Search by username',choose:'Select a person',heading:'Title',message:'Message',preview:'Preview',send:'Send message',sent:'Message ready. Recipients will see it once when they open the app.',error:'The message could not be processed. Please retry.',loading:'Loading users…',empty:'No users found.',done:'Got it, thank you',close:'Close message',notice:'A MESSAGE FROM LUMIRA',selected:'Selected person: '},
 de:{title:'Nachricht senden',sub:'Sende einer Person oder allen eine Nachricht, die pro Konto einmal erscheint.',all:'Alle',one:'Eine Person',scope:'Empfänger',search:'Nutzernamen suchen',choose:'Person auswählen',heading:'Titel',message:'Nachricht',preview:'Vorschau',send:'Nachricht senden',sent:'Die Nachricht ist bereit und erscheint beim Öffnen der App einmal.',error:'Die Nachricht konnte nicht verarbeitet werden. Bitte erneut versuchen.',loading:'Nutzer werden geladen…',empty:'Keine Nutzer gefunden.',done:'Verstanden, danke',close:'Nachricht schließen',notice:'EINE NACHRICHT VON LUMIRA',selected:'Ausgewählte Person: '},
 ar:{title:'إرسال رسالة',sub:'أرسل رسالة لشخص أو للجميع، تظهر مرة واحدة لكل حساب.',all:'الجميع',one:'شخص واحد',scope:'المستلم',search:'ابحث باسم المستخدم',choose:'اختر شخصاً',heading:'العنوان',message:'الرسالة',preview:'معاينة',send:'إرسال الرسالة',sent:'الرسالة جاهزة. ستظهر للمستلم مرة واحدة عند فتح التطبيق.',error:'تعذرت معالجة الرسالة. حاول مجدداً.',loading:'جارٍ تحميل المستخدمين…',empty:'لم يُعثر على مستخدمين.',done:'فهمت، شكراً',close:'إغلاق الرسالة',notice:'رسالة من لوميرا',selected:'الشخص المحدد: '},
 fr:{title:'Envoyer un message',sub:'Envoie à une personne ou à tous un message affiché une fois par compte.',all:'Tout le monde',one:'Une personne',scope:'Destinataire',search:'Chercher un nom d’utilisateur',choose:'Choisir une personne',heading:'Titre',message:'Message',preview:'Aperçu',send:'Envoyer le message',sent:'Le message est prêt. Il apparaîtra une fois à l’ouverture de l’application.',error:'Impossible de traiter le message. Réessaie.',loading:'Chargement des utilisateurs…',empty:'Aucun utilisateur trouvé.',done:'Compris, merci',close:'Fermer le message',notice:'UN MESSAGE DE LUMIRA',selected:'Personne choisie : '},
 es:{title:'Enviar mensaje',sub:'Envía a una persona o a todos un mensaje que aparece una vez por cuenta.',all:'Todos',one:'Una persona',scope:'Destinatario',search:'Buscar nombre de usuario',choose:'Seleccionar persona',heading:'Título',message:'Mensaje',preview:'Vista previa',send:'Enviar mensaje',sent:'El mensaje está listo. Aparecerá una vez al abrir la aplicación.',error:'No se pudo procesar el mensaje. Reinténtalo.',loading:'Cargando usuarios…',empty:'No se encontraron usuarios.',done:'Entendido, gracias',close:'Cerrar mensaje',notice:'UN MENSAJE DE LUMIRA',selected:'Persona seleccionada: '},
 ru:{title:'Отправить сообщение',sub:'Отправь одному человеку или всем сообщение, которое появится один раз для каждого аккаунта.',all:'Всем',one:'Одному человеку',scope:'Получатель',search:'Поиск по имени пользователя',choose:'Выбрать человека',heading:'Заголовок',message:'Сообщение',preview:'Предпросмотр',send:'Отправить сообщение',sent:'Сообщение готово. Получатель увидит его один раз при открытии приложения.',error:'Не удалось обработать сообщение. Повтори попытку.',loading:'Загрузка пользователей…',empty:'Пользователи не найдены.',done:'Понятно, спасибо',close:'Закрыть сообщение',notice:'СООБЩЕНИЕ ОТ LUMIRA',selected:'Выбранный пользователь: '}
 };
 const t=key=>(COPY[root.NATIVE_LANG]||COPY.en)[key],n=(tag,cls,value)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(value!==undefined)e.textContent=value;return e;},button=(label,cls,fn)=>{const b=n('button',cls,label);b.type='button';b.onclick=fn;return b;};
 const F=()=>root.LUMIRA_FEATURES,uid=()=>root.LB_getUid?.()||'',api=(action,params)=>F().service('announcements',action,params,{timeoutMs:12000});
 const mascot='<svg class="lumira-notice-mascot" viewBox="0 0 100 80" aria-hidden="true"><path fill="#95e5f1" d="M48 38C38 0 1 0 7 24c3 14 22 22 41 18C13 35 9 66 29 67c14 1 20-18 21-25Z"/><path fill="#b5a1f3" d="M52 38C62 0 99 0 93 24c-3 14-22 22-41 18 35-7 39 24 19 25-14 1-20-18-21-25Z"/><path d="M50 36v23m0-22-8-12m8 12 8-12" stroke="#d5efff" stroke-width="2.5" stroke-linecap="round"/></svg>';
 let account='',queue=[],overlay=null,loading=false,timer,epoch=0,controller;
 const seen=new Map();
 function seenFor(id){if(!seen.has(id)){let list=[];try{list=JSON.parse(localStorage.getItem('lumira_notice_seen_'+id)||'[]');}catch{}seen.set(id,new Set(Array.isArray(list)?list.slice(-200):[]));}return seen.get(id);}
 function remember(user,id){const values=seenFor(user);values.add(id);try{localStorage.setItem('lumira_notice_seen_'+user,JSON.stringify([...values].slice(-200)));}catch{}}
 function pendingAcks(user){try{const value=JSON.parse(localStorage.getItem('lumira_notice_ack_'+user)||'[]');return Array.isArray(value)?value.filter(row=>typeof row?.id==='string'&&typeof row.claim==='string').slice(-100):[];}catch{return[];}}
 function saveAcks(user,rows){try{if(rows.length)localStorage.setItem('lumira_notice_ack_'+user,JSON.stringify(rows.slice(-100)));else localStorage.removeItem('lumira_notice_ack_'+user);}catch{}}
 function queueAck(user,id,claim){saveAcks(user,[...pendingAcks(user).filter(row=>row.id!==id),{id,claim}]);}
 async function retryAcks(user){for(const row of pendingAcks(user)){if(uid()!==user)return;try{await api('ack',row);if(uid()===user)saveAcks(user,pendingAcks(user).filter(value=>value.id!==row.id));}catch{return;}}}
 function next(){
  if(overlay||!uid()||uid()!==account||document.hidden)return;
  if(document.querySelector('.pwa-sheet.in,.pwa-box.in')||document.querySelector('#ltMic[aria-pressed=true]')){clearTimeout(timer);timer=setTimeout(next,2000);return;}
  const notice=queue.shift();if(!notice)return;
  if(seenFor(account).has(notice.id)){next();return;}
  const user=account,run=epoch,claim=F().id();
  api('claim',{id:notice.id,claim}).then(()=>{
   if(run!==epoch||uid()!==user)return;
   const previous=document.activeElement,back=overlay=n('div','lumira-notice-backdrop'),card=n('section','lumira-notice');card.setAttribute('role','dialog');card.setAttribute('aria-modal','true');card.dir=root.NATIVE_LANG==='ar'?'rtl':'ltr';
   let acknowledged=false;const markSeen=()=>{if(acknowledged||run!==epoch||uid()!==user)return;acknowledged=true;remember(user,notice.id);queueAck(user,notice.id,claim);retryAcks(user);};
   const close=()=>{markSeen();back.remove();if(overlay===back)overlay=null;if(previous?.isConnected)previous.focus({preventScroll:true});next();};
   const x=button('×','lumira-notice-close',close);x.setAttribute('aria-label',t('close'));const title=n('h2','',notice.title);title.id='lumiraNoticeTitle';card.setAttribute('aria-labelledby',title.id);
   const art=n('span');art.innerHTML=mascot;card.append(x,art,n('span','lumira-notice-eyebrow',t('notice')),title,n('p','lumira-notice-message',notice.message),button(t('done'),'lumira-notice-done',close));back.append(card);document.body.append(back);card.querySelector('.lumira-notice-done').focus({preventScroll:true});
   back.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();close();}if(e.key==='Tab'){const rows=[...card.querySelectorAll('button')];if(e.shiftKey&&document.activeElement===rows[0]){e.preventDefault();rows.at(-1).focus();}else if(!e.shiftKey&&document.activeElement===rows.at(-1)){e.preventDefault();rows[0].focus();}}};
   requestAnimationFrame(()=>{if(back.isConnected)markSeen();});
  }).catch(()=>{if(run===epoch)next();});
 }
 async function check(){
  const user=uid();if(!user||loading||document.hidden||navigator.onLine===false)return;
  if(account!==user){account=user;queue=[];epoch++;overlay?.remove();overlay=null;}
  const run=epoch;loading=true;
  try{await retryAcks(user);if(run!==epoch||uid()!==user)return;const result=await api('inbox',{});if(run!==epoch||uid()!==user)return;const existing=new Set(queue.map(row=>row.id));for(const row of result.messages||[])if(!seenFor(user).has(row.id)&&!existing.has(row.id))queue.push(row);next();}catch{}finally{loading=false;}
 }
 function admin(){
  if(!root.PWA?.sheet||!F())return;
  controller?.abort();controller=new AbortController();const signal=controller.signal;
  root.PWA.sheet(t('title'),t('sub'),(body)=>{
   body.classList.add('notice-compose');body.dir=root.NATIVE_LANG==='ar'?'rtl':'ltr';let users=[],selected='',requestId=null;
   const field=(name,element)=>{const label=n('label','pwa-field');label.append(n('span','',t(name)),element);body.append(label);return element;};
   const scope=field('scope',n('select','pwa-input'));for(const[value,label]of[['all',t('all')],['one',t('one')]]){const o=n('option','',label);o.value=value;scope.append(o);}
   const search=field('search',n('input','pwa-input'));search.type='search';search.autocomplete='off';search.placeholder=t('search');const people=n('div','notice-people'),chosen=n('p','pwa-note');body.append(people,chosen);
   const title=field('heading',n('input','pwa-input'));title.maxLength=100;const message=field('message',n('textarea','pwa-input'));message.maxLength=1600;
   const preview=n('div','notice-preview'),previewTitle=n('strong'),previewMessage=n('span');preview.append(previewTitle,previewMessage);preview.setAttribute('aria-label',t('preview'));body.append(preview);const status=n('p','pwa-note',t('loading'));status.setAttribute('role','status');const send=button(t('send'),'pwa-btn');send.disabled=true;body.append(status,send);
   const searchKey=value=>String(value).normalize('NFKD').replace(/\p{M}/gu,'').toLocaleLowerCase().replace(/ı/g,'i');
   function paint(){search.parentElement.hidden=people.hidden=chosen.hidden=scope.value==='all';people.replaceChildren();if(scope.value==='one'){const query=searchKey(search.value);for(const user of users.filter(u=>!query||searchKey(u.name+' '+u.uid).includes(query)).slice(0,20)){const b=button(user.name,'pwa-btn ghost',()=>{selected=user.uid;chosen.textContent=t('selected')+user.name;paint();});b.setAttribute('aria-pressed',String(selected===user.uid));people.append(b);}if(!people.children.length)people.append(n('p','pwa-note',t('empty')));}previewTitle.textContent=title.value||t('heading');previewMessage.textContent=message.value||t('message');send.disabled=!title.value.trim()||!message.value.trim()||scope.value==='one'&&!selected;}
   for(const e of[scope,search,title,message])e.addEventListener(e===scope?'change':'input',()=>{requestId=null;paint();});paint();
   (async()=>{try{let pageToken;do{const page=await F().adminBadges('list',pageToken?{pageToken}:{},{signal});if(signal.aborted||!body.isConnected)return;users.push(...page.users);pageToken=page.nextPageToken;}while(pageToken);users=[...new Map(users.map(row=>[row.uid,row])).values()];status.textContent='';paint();}catch{if(body.isConnected)status.textContent=t('error');}})();
   send.onclick=async()=>{if(send.disabled)return;send.disabled=true;requestId||=F().id();const elements=[scope,search,title,message];elements.forEach(e=>e.disabled=true);try{await api('create',{id:requestId,scope:scope.value,...(scope.value==='one'?{uid:selected}:{}),title:title.value,message:message.value});if(body.isConnected){status.textContent=t('sent');title.value=message.value='';requestId=null;root.PWA.toast(t('sent'),{kind:'good'});}}catch{if(body.isConnected)status.textContent=t('error');}finally{if(body.isConnected){elements.forEach(e=>e.disabled=false);paint();}}};
  });
 }
 root.LUMIRA_ANNOUNCEMENTS={openAdmin:admin,check,text:t};
 root.addEventListener('lumira:featureauthchange',()=>{epoch++;loading=false;account='';queue=[];overlay?.remove();overlay=null;clearTimeout(timer);timer=setTimeout(check,1000);});root.addEventListener('online',check);document.addEventListener('visibilitychange',()=>{if(!document.hidden)check();});
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>setTimeout(check,1500),{once:true});else setTimeout(check,1500);
})(window);
