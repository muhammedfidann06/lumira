(function(){'use strict';
const T=(key,values)=>window.LUMIRA_ACCESS_COPY.text(key,values);
const tiers=[{amount:1,badge:'👍',minutes:60,count:25},{amount:5,badge:'☕',minutes:90,count:50},{amount:10,badge:'❤️',minutes:120,count:100},{amount:25,badge:'💛',minutes:240,count:150},{amount:50,badge:'⭐',minutes:480,count:300},{amount:100,badge:'👑',minutes:null,count:null}];
let active=null;
const create=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;};
const name=amount=>amount?T('names')[tiers.findIndex(t=>t.amount===amount)]:T('none');
function close(){
 if(!active)return;const state=active;active=null;
 state.root.remove();document.body.style.overflow=state.overflow;
 for(const [node,inert,aria]of state.hidden){node.inert=inert;if(aria===null)node.removeAttribute('aria-hidden');else node.setAttribute('aria-hidden',aria);}
 document.removeEventListener('keydown',state.keys);
 if(state.focus?.isConnected){try{state.focus.focus({preventScroll:true});}catch{state.focus.focus();}}
}
function open(reason,quota){
 if(active){if(active.reason===reason)return;close();}
 const benefits=['pdf_badge_required','pdf_limit','offline'].includes(reason);
 quota=quota || window.LUMIRA_FEATURES?.getQuota() || window.LUMIRA_FEATURES?.entitlement() || {tier:0};
 const current=Number(quota.tier)||0;
 const root=create('div','la-backdrop');root.dataset.reason=reason;
 const panel=create('section','la-panel');panel.setAttribute('role','dialog');panel.setAttribute('aria-modal','true');panel.setAttribute('aria-labelledby','la-title');panel.setAttribute('dir',window.NATIVE_LANG==='ar'?'rtl':'ltr');
 const top=create('div','la-top'),brand=create('div','la-brand');
 brand.innerHTML='<svg viewBox="0 0 64 48" aria-hidden="true"><path fill="#4fe8ff" d="M30 22C25 2 2-2 6 13c3 9 13 13 24 12C12 22 9 39 20 40c9 1 11-10 12-14Z"/><path fill="#aa87ff" d="M34 22C39 2 62-2 58 13c-3 9-13 13-24 12 18-3 21 14 10 15-9 1-11-10-12-14Z"/></svg><span>LUMIRA</span>';
 const x=create('button','la-x','×');x.type='button';x.setAttribute('aria-label',T('close'));x.onclick=close;
 top.append(brand,x);panel.append(top);
 const title=create('h2','la-title',T(benefits?'accessTitle':'limitTitle'));title.id='la-title';panel.append(title,create('p','la-sub',T(benefits && !current?'accessSub':'limitSub')),create('p','la-lifetime',T('lifetime')),create('p','la-period',T(benefits?'offlineIntro':'period')));
 const plan=create('div','la-current');plan.append(create('strong','',T('current')+': '+name(current)));
 const item=tiers.find(t=>t.amount===current) || {minutes:20,count:10};
 plan.append(create('span','',benefits?(current?(T(current===1?'pdf':'pdfUnlimited')+' · '+T('offline')):T('needBadge')):(T(item.minutes===null?'liveUnlimited':'live',{n:item.minutes})+' · '+T(item.count===null?'writingUnlimited':'writing',{n:item.count}))));panel.append(plan);
 const grid=create('div','la-grid');let selected=tiers.find(t=>t.amount>current)?.amount || null;
 const cards=[];const badgeFiles=['1f44d','2615','2764','1f49b','2b50','1f451'];
 tiers.forEach((tier,index)=>{
  const card=create('button','la-card');card.type='button';card.dataset.tier=tier.amount;card.disabled=tier.amount<=current;
  const heading=create('span','la-card-head');const badge=create('img','la-badge');badge.src='./vendor/badges/'+badgeFiles[index]+'.svg';badge.alt='';badge.width=28;badge.height=28;heading.append(badge,create('strong','',T('names')[index]));
  const check=create('span','la-check','✓');check.setAttribute('aria-hidden','true');heading.append(check);card.append(heading);
  const lines=benefits?[T(tier.amount===1?'pdf':'pdfUnlimited'),T('offline')]:[T(tier.minutes===null?'liveUnlimited':'live',{n:tier.minutes}),T(tier.count===null?'writingUnlimited':'writing',{n:tier.count})];
  lines.forEach((line,i)=>{const row=create('span','la-benefit');row.append(create('span','la-benefit-icon',i===0?'▧':'◇'),create('span','',line));card.append(row);});
  if(card.disabled)card.append(create('span','la-owned',T('owned')));
  card.onclick=()=>{selected=tier.amount;update();};cards.push(card);grid.append(card);
 });
 panel.append(grid);
 if(benefits)panel.append(create('p','la-note',T('pdfNote')),create('p','la-note la-note-small',T('pdfOther')));else panel.append(create('p','la-note',T('note')));
 const buy=create('button','la-buy',T('buy'));buy.type='button';
 const native=typeof window.getDigitalGoodsService==='function';let storeItems=null;
 buy.onclick=()=>{const tier=window.LUMIRA_BADGES?.tiers.find(t=>t.amount===selected);if(tier && window.purchaseSupportTier)window.purchaseSupportTier(tier);};
 const dismiss=create('button','la-dismiss',T('dismiss'));dismiss.type='button';dismiss.onclick=close;panel.append(buy,dismiss);
 function update(){cards.forEach(card=>{const chosen=Number(card.dataset.tier)===selected;card.classList.toggle('is-selected',chosen);card.setAttribute('aria-pressed',String(chosen));});const product=window.LUMIRA_PLAY?.products.find(row=>row.amount===selected);buy.disabled=selected===null||(native&&!storeItems?.has(product?.sku));}
 update();root.append(panel);
 const state={root,reason,focus:document.activeElement,overflow:document.body.style.overflow,hidden:[]};
 state.keys=e=>{
  if(e.key==='Escape'){e.preventDefault();close();return;}
  if(e.key!=='Tab')return;
  const buttons=Array.from(panel.querySelectorAll('button:not(:disabled),a[href]'));const first=buttons[0],last=buttons.at(-1);
  if(e.shiftKey && document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first.focus();}
 };
 for(const node of Array.from(document.body.children)){if(['SCRIPT','STYLE','LINK'].includes(node.tagName))continue;state.hidden.push([node,node.inert,node.getAttribute('aria-hidden')]);node.inert=true;node.setAttribute('aria-hidden','true');}
 active=state;document.body.append(root);document.body.style.overflow='hidden';document.addEventListener('keydown',state.keys);x.focus({preventScroll:true});
 if(native)window.LUMIRA_PLAY.catalog().then(items=>{if(active!==state)return;storeItems=items;for(const card of cards){const amount=Number(card.dataset.tier),product=window.LUMIRA_PLAY.products.find(row=>row.amount===amount),item=items.get(product.sku),line=create('span','la-benefit',item?item.price+' · '+window.LUMIRA_BILLING.text(product.lifetime?3:4):window.LUMIRA_BILLING.text(21));card.append(line);if(!item)card.disabled=true;}update();}).catch(()=>{if(active===state)buy.disabled=true;});
}
async function requireFeature(feature){
 const F=window.LUMIRA_FEATURES;
 let user;try{user=window.firebase.auth().currentUser;}catch{}
 if(!user){window.PWA?.toast(F?.text('login_required'),{kind:'bad'});return false;}
 let quota;
 try{quota=navigator.onLine?(await F.api('status')).quota:F.entitlement();}
 catch(error){window.PWA?.toast(navigator.onLine?F.errorText(error):T('net'),{kind:'bad'});return false;}
 if(!quota){window.PWA?.toast(navigator.onLine?F.text('usage_unavailable'):T('net'),{kind:'bad'});return false;}
 if(!quota.tier){open(feature==='pdf'?'pdf_badge_required':'offline',quota);return false;}
 if(feature==='pdf' && quota.pdf?.remaining===0){open('pdf_limit',quota);return false;}
 return true;
}
window.LUMIRA_ACCESS={open,close,require:requireFeature,tiers};
window.addEventListener('lumira:featureauthchange',close);
window.addEventListener('lumira:purchaseverified',close);
})();
