const { chromium } = require('playwright-core');
const fs=require('fs');
const OUT='/private/tmp/claude-501/-Users-marino/528f078e-f6e7-4138-8906-5adb44be4fc8/scratchpad';
const TPL=fs.readFileSync(OUT+'/widget_tpl.html','utf8');
const PAY={productId:1,title:'Pantaloni Belted',handle:'p',type:'',tags:[],optionName:'Taglia',optionPosition:1,values:['46','48','50','52','54'].map(l=>({label:l,available:true})),collections:[],locale:'it'};
(async()=>{
 const b=await chromium.launch({channel:'chrome'}).catch(()=>chromium.launch());
 const p=await b.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await p.goto('https://bottegadalmut.com/products/pantaloni-belted-o-transition-brown-house-in-lino',{waitUntil:'domcontentloaded',timeout:60000});
 await p.waitForTimeout(3000);
 await p.evaluate(html=>{
   const list=document.querySelector('.product-info__block-list');
   const sg=[...list.children].find(el=>/size guide/i.test(el.innerText||''));
   const d=document.createElement('div'); d.innerHTML=html;
   const sc=[...d.querySelectorAll('script')]; sc.forEach(s=>s.remove()); sg.after(d);
   sc.forEach(s=>{const n=document.createElement('script'); if(s.type){n.type=s.type;n.id=s.id;} n.textContent=s.textContent; document.body.appendChild(n);});
 }, TPL.replace('__PAYLOAD__', JSON.stringify(PAY)));
 await p.waitForTimeout(400);
 await p.evaluate(()=>document.getElementById('bdsf-trigger').click());
 await p.waitForTimeout(700);
 const r=await p.evaluate(()=>{
   const ban=document.querySelector('#shopify-pc__banner');
   const dr=document.getElementById('bdsf-drawer');
   const cta=document.getElementById('bdsf-next');
   const bb=ban&&ban.getBoundingClientRect(), cb=cta.getBoundingClientRect();
   const centro=document.elementFromPoint(cb.x+cb.width/2, cb.y+cb.height/2);
   return {
     bannerPresente: !!ban,
     bannerZ: ban?getComputedStyle(ban).zIndex:null,
     bannerBox: bb?[Math.round(bb.y),Math.round(bb.height)]:null,
     drawerZ: getComputedStyle(dr).zIndex,
     ctaBox:[Math.round(cb.y),Math.round(cb.height)],
     sovrapposti: !!(bb && cb.bottom>bb.top && cb.top<bb.bottom),
     chiRiceveIlTocco: centro?(centro.id||centro.className||centro.tagName):null
   };
 });
 console.log(JSON.stringify(r,null,1));
 await p.screenshot({path:OUT+'/cookie_conflict.png'});
 await b.close();
})();
