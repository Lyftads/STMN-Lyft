const { chromium } = require('playwright-core');
const fs=require('fs');
const OUT='/private/tmp/claude-501/-Users-marino/528f078e-f6e7-4138-8906-5adb44be4fc8/scratchpad';
const TPL=fs.readFileSync(OUT+'/widget_tpl.html','utf8');
(async()=>{
 const b=await chromium.launch({channel:'chrome'}).catch(()=>chromium.launch());
 const p=await b.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const errs=[]; p.on('pageerror',e=>errs.push(String(e).slice(0,160)));
 await p.goto('https://bottegadalmut.com/products/pantaloni-belted-o-transition-brown-house-in-lino',{waitUntil:'domcontentloaded',timeout:60000});
 await p.waitForTimeout(3000);
 const PAY={productId:1,title:'Pantaloni Belted',handle:'p',type:'',tags:[],optionName:'Taglia',optionPosition:1,
   values:['46','48','50','52','54'].map(l=>({label:l,available:true,variantId:null})),collections:[],locale:'it',routeRoot:'/'};
 await p.evaluate(html=>{const list=document.querySelector('.product-info__block-list');
   const sg=[...list.children].find(el=>/size guide/i.test(el.innerText||''))||list.children[3];
   const d=document.createElement('div'); d.innerHTML=html; const sc=[...d.querySelectorAll('script')];
   sc.forEach(s=>s.remove()); sg.after(d);
   sc.forEach(s=>{const n=document.createElement('script'); if(s.type){n.type=s.type;n.id=s.id;} n.textContent=s.textContent; document.body.appendChild(n);});
 }, TPL.replace('__PAYLOAD__', JSON.stringify(PAY)));
 await p.waitForTimeout(600);
 console.log('errori JS all avvio:', errs.length?errs:'nessuno');
 const clickErr=await p.evaluate(()=>{try{document.getElementById('bdsf-trigger').click();return null;}catch(e){return String(e).slice(0,200);}});
 console.log('errore al click:', clickErr||'nessuno');
 await p.waitForTimeout(1200);
 const st=await p.evaluate(()=>{
   const d=document.getElementById('bdsf-drawer'), w=document.getElementById('bdsf-w'), h=document.getElementById('bdsf-h');
   return {aperto:d.classList.contains('bdsf-open'), pannello0:document.getElementById('bdsf-p0').classList.contains('bdsf-on'),
     pesoVisibile:!!w.offsetParent, altezzaVisibile:!!h.offsetParent, tipoAltezza:h.type,
     phPeso:w.placeholder, phAltezza:h.placeholder};
 });
 console.log('stato:', JSON.stringify(st));
 console.log('errori JS dopo apertura:', errs.length?errs:'nessuno');
 await b.close();
})();
