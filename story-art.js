/* Theme-aware story art: 15 original illustrations, 600 deterministic cover
   compositions. Only the cover on screen is loaded; no remote generation. */
(function(root){'use strict';
 const genres=['adventure','fairy','scifi','mystery','daily','comedy'],settings=['vienna','kitchen','market','station','library','park','museum','village','cafe','workshop'];
 const accent={daily:'#b7edcb',adventure:'#a7dfed',fairy:'#dcc2f7',scifi:'#8ce4ec',mystery:'#d4cff7',comedy:'#f8dbaa'};
 const plots={
 daily:[
  '<circle cx="46" cy="44" r="12"/><circle cx="82" cy="44" r="12"/><path d="M25 94V83a21 21 0 0 1 42 0v11m-5-24a21 21 0 0 1 41 13v11M59 52l5 5 5-5"/>',
  '<path d="M28 38h69v55H28zM28 48h69M76 64h27v20H76z"/><circle cx="86" cy="74" r="2"/><path d="M43 31V19h33v12M41 67h16m-16 12h9"/>',
  '<rect x="38" y="16" width="52" height="96" rx="10"/><path d="M54 25h20M59 101h10M47 69h34V52H47zm4-17v-4m9 4v-4m9 4v-4m12 10h5v5M57 85l14-8m-14 0 14 8"/>',
  '<path d="M24 32q20-10 40 0 20-10 40 0v65q-20-10-40 0-20-10-40 0Zm40 0v65M34 48h18m-18 12h18m-18 12h13M78 46q-10 11 0 18 10-7 0-18Zm-4 30h17"/>',
  '<path d="M27 84q-5-16 5-18 6-1 12 11l19 10m-36-3 14 21h48q8 0 8-8 0-7-8-7H66M69 27q-13-17-25-4-13 16 25 39 38-23 25-39-12-13-25 4Z"/>'
 ],
 adventure:[
  '<path d="m16 26 32-9 32 9 32-9v84l-32 9-32-9-32 9Zm32-9v84m32-75v84M29 47q12 25 31 18t35-10"/><circle cx="94" cy="54" r="5"/>',
  '<path d="M30 65V42l20 14q14-7 28 0l20-14v23q16 12 8 31-7 16-42 16S7 87 30 65Z"/><circle cx="47" cy="77" r="2"/><circle cx="80" cy="77" r="2"/><path d="m57 91 7 7 7-7Zm7 7v8M39 23l-3-8m50 8 3-8"/>',
  '<path d="M23 58a20 20 0 0 1 16-35 28 28 0 0 1 52 5 16 16 0 0 1 8 30ZM37 73l-7 14m31-14-7 14m31-14-7 14M43 105h43"/><path d="m16 105 18-12m62 0 16 12"/>',
  '<path d="m20 42 44-24 44 24v50l-44 24-44-24Zm0 0 44 24 44-24M64 66v50M42 30l44 24m-56 9 17 9m35 13 14-8"/>',
  '<path d="M13 89h102M23 88V53m82 35V53M23 61q41-44 82 0M23 75q41-44 82 0M44 88V49m40 39V49M30 105l7-10m54 0 7 10"/>'
 ],
 fairy:[
  '<path d="M60 65C38 13 4 17 17 49c7 16 26 21 43 16-38-5-38 40-14 34 12-3 15-22 17-31m5-3c22-52 56-48 43-16-7 16-26 21-43 16 38-5 38 40 14 34-12-3-15-22-17-31ZM64 57v42m0-42-8-11m8 11 8-11M25 13v10m-5-5h10m68 84v10m-5-5h10"/>',
  '<circle cx="39" cy="40" r="22"/><circle cx="39" cy="40" r="8"/><path d="m55 56 51 51m-17-17 12-12m-24 0 12-12M14 85v12m-6-6h12M91 16v12m-6-6h12"/>',
  '<path d="M85 17A44 44 0 1 0 110 88 43 43 0 0 1 85 17Z"/><path d="m98 38 3 8 8 3-8 3-3 8-3-8-8-3 8-3Zm-2 60v14m-7-7h14"/>',
  '<path d="M64 111V64M64 76Q18 78 22 33q42-3 42 43Zm0-10q-2-43 42-45 5 42-42 45ZM25 111h78M33 94q31-15 62 0"/>',
  '<path d="M18 34q23-10 46 0 23-10 46 0v69q-23-10-46 0-23-10-46 0Zm46 0v69M31 49h20m-20 13h20m27-13h18m-18 13h18M81 15v12m-6-6h12M45 11v12m-6-6h12"/>'
 ],
 scifi:[
  '<rect x="25" y="40" width="78" height="67" rx="17"/><path d="M64 40V24m-14 0h28M17 58v30m94-30v30M45 89h38"/><circle cx="45" cy="65" r="8"/><circle cx="83" cy="65" r="8"/><path d="M48 103v10m32-10v10"/>',
  '<rect x="17" y="26" width="94" height="69" rx="12"/><path d="m17 41 47 27 47-27M28 16v-7m72 7v-7M46 111l18-16 18 16"/><circle cx="94" cy="83" r="17"/><path d="M94 74v10l7 4"/>',
  '<path d="m23 45 68-7 14 52-68 7Zm4 13 68-7M31 73l68-7M47 42l13 53m9-55 13 53M66 95v17M12 17v15m-8-7h16m7-15-6 8m7 13 7 8"/>',
  '<path d="M22 97h84M38 96V73q-13 3-18-8m44 31V41q-28-4-30-24 30-6 30 24 0-29 30-24-2 20-30 24Zm25 0V67q12 5 18-8"/><path d="M38 74q-7-22-20-20m70 13q5-22 22-22"/>',
  '<path d="M39 34q25-25 50 0v62q-25 25-50 0Zm0 0q25 22 50 0M39 96q25-22 50 0M39 52h50M39 80h50m-41-17h31M15 45v14m-7-7h14m82 48v14m-7-7h14"/>'
 ],
 mystery:[
  '<rect x="14" y="43" width="46" height="62" rx="9"/><rect x="68" y="43" width="46" height="62" rx="9"/><path d="M25 43V26h24v17m30 0V26h24v17M31 64v23m55-23v23m-65-7h35m20 0h30"/>',
  '<path d="M26 18h59l21 21v72H26ZM85 18v23h21M39 54h42M39 69h42M39 84h21"/><circle cx="82" cy="89" r="16"/><path d="m94 101 14 14"/>',
  '<circle cx="64" cy="64" r="46"/><path d="M64 29v35l23 13M64 104v-8M24 64h8m64 0h8M32 32l6 6m52 52 6 6M96 32l-6 6m-52 52-6 6"/><path d="m57 78 14 14m0-14L57 92"/>',
  '<path d="M17 25h94v78H17ZM28 88l24-25 20 20 13-13 16 18"/><circle cx="82" cy="48" r="10"/><circle cx="45" cy="56" r="24"/><path d="m26 75-15 15"/>',
  '<path d="M47 91V32l58-12v59M47 48l58-12"/><ellipse cx="33" cy="95" rx="15" ry="10"/><ellipse cx="91" cy="83" rx="15" ry="10"/><path d="M16 22q14 12 0 24m106 45q-13 11 0 22"/>'
 ],
 comedy:[
  '<path d="M15 64h45v43H15Zm53 0h45v43H68ZM15 76q8 11 16 0 8 11 16 0 7 11 13 0m8 0q8 11 16 0 8 11 16 0 7 11 13 0M28 64V47m19 17V47m34 17V47m19 17V47M26 34l4-9 4 9m10 0 4-9 4 9m27 0 4-9 4 9m10 0 4-9 4 9"/>',
  '<path d="M16 22h58v42H43L28 79V64H16Zm96 41H80V37m32 26v31H97l-15 15V94H62V79M30 38h30m-30 12h16m62 29H89"/>',
  '<path d="M13 84q49 20 102 0l-13-10-9-39q-30-12-56 0l-9 39ZM29 73q35 12 72 0M21 25q-12-14-18-3m92-5q13-18 25-6M42 107q13 10 24 0"/>',
  '<path d="M15 47h36v30l20 12v18H15Zm62-20h36v35l-19 14H68V58l9-8ZM21 93h41M82 36h24m-78 24h17m-17 10h17m43-21h15"/>',
  '<path d="M42 104V42q0-30 29-30 24 0 29 20l14 10-19 7v29q0 24-27 26Zm24-57Q28 55 42 84q25 2 38-23M54 104v12m23-12v12M13 19q18-8 22 9m-19 8 16 3"/><circle cx="79" cy="29" r="2"/>'
 ]};
 function meta(options={},coverId){
  const genre=genres.includes(options.genre)?options.genre:'daily';const match=new RegExp('^'+genre+'-(\\d{3})$').exec(String(coverId||''));let index=match?Number(match[1]):0;if(index>99)index=0;
  const setting=settings[index%10],plot=Math.floor(index/20),ending=Math.floor(index/10)%2;
  return{genre,index,setting,plot,ending,accent:accent[genre],src:'assets/story-covers/'+(setting==='vienna'?genre+'-vienna':setting)+'-v2.webp',symbol:plots[genre][plot],identity:genre+'-'+String(index).padStart(3,'0')};
 }
 function render(options,coverId){
  const data=meta(options,coverId),cover=document.createElement('div'),image=document.createElement('img');cover.className='story-art story-art-v2';cover.dataset.style=options.style;cover.dataset.coverId=data.identity;cover.dataset.ending=String(data.ending);cover.setAttribute('aria-hidden','true');cover.style.setProperty('--story-art-accent',data.accent);
  image.src=new URL(data.src,document.baseURI).href;image.alt='';image.width=1024;image.height=683;image.decoding='async';image.loading='lazy';image.style.objectPosition=(data.ending?'54%':'46%')+' '+(43+data.plot*3)+'%';cover.append(image);
  const symbol=document.createElementNS('http://www.w3.org/2000/svg','svg');symbol.setAttribute('viewBox','0 0 128 128');symbol.setAttribute('fill','none');symbol.setAttribute('stroke','currentColor');symbol.setAttribute('stroke-width','3.5');symbol.setAttribute('stroke-linecap','round');symbol.setAttribute('stroke-linejoin','round');symbol.classList.add('story-art-symbol');symbol.innerHTML=data.symbol;cover.append(symbol);
  const marker=document.createElement('span');marker.className='story-art-orbit';marker.textContent=data.ending?'✧':'✦';cover.append(marker);
  const label=document.createElement('small');label.textContent='✦ '+root.LUMIRA_STORY_COPY.text('genres')[genres.indexOf(data.genre)];cover.append(label);return cover;
 }
 root.LUMIRA_STORY_ART={meta,render};
})(window);

