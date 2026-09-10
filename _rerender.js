const { chromium } = require('playwright-core');
const fs=require('fs');
const OUT='/private/tmp/claude-501/-Users-marino/528f078e-f6e7-4138-8906-5adb44be4fc8/scratchpad';
const TPL=fs.readFileSync(OUT+'/widget_tpl.html','utf8');
(async()=>{
 const b=await chromium.launch({channel:'chrome'}).catch(()=>chromium.launch());
 const p=await b.newPage({viewport:{width:1400,height:1000}});
 await p.goto('https://bottegadalmut.com/products/pantaloni-belted-o-transition-brown-house-in-lino',{waitUntil:'domcontentloaded',timeout:60000});
 await p.waitForTimeout(3500);
 const PAY={productId:1,title:'Pantaloni Belted',handle:'p',type:'',tags:[],optionName:'Taglia',optionPosition:1,
   values:['46','48','50','52','54'].map(l=>({label:l,available:true,variantId:null})),collections:[],locale:'it',routeRoot:'/'};
 await p.evaluate(html=>{const list=document.querySelector('.product-info__block-list');
   const sg=[...list.children].find(el=>/size guide/i.test(el.innerText||''))||list.children[3];
   const d=document.createElement('div'); d.innerHTML=html; const sc=[...d.querySelectorAll('script')];
   sc.forEach(s=>s.remove()); sg.after(d);
   sc.forEach(s=>{const n=document.createElement('script'); if(s.type){n.type=s.type;n.id=s.id;} n.textContent=s.textContent; document.body.appendChild(n);});
   window.__T0=document.getElementById('bdsf-trigger');   // nodo a cui lo script si è agganciato
 }, TPL.replace('__PAYLOAD__', JSON.stringify(PAY)));
 await p.waitForTimeout(200);
 const subito=await p.evaluate(()=>({stessoNodo: window.__T0===document.getElementById('bdsf-trigger'), quanti:document.querySelectorAll('#bdsf-trigger').length}));
 console.log('appena iniettato      :', JSON.stringify(subito));
 await p.waitForTimeout(3000);
 const dopoAttesa=await p.evaluate(()=>({stessoNodo: window.__T0===document.getElementById('bdsf-trigger'), quanti:document.querySelectorAll('#bdsf-trigger').length, connesso: window.__T0.isConnected}));
 console.log('dopo 3 secondi        :', JSON.stringify(dopoAttesa));
 // cambio taglia: fa scattare il re-render del tema
 await p.evaluate(()=>{const l=[...document.querySelectorAll('.product-info label.block-swatch')].find(e=>e.textContent.trim()==='52'); if(l) l.click();});
 await p.waitForTimeout(2500);
 const dopoCambio=await p.evaluate(()=>({stessoNodo: window.__T0===document.getElementById('bdsf-trigger'), connesso: window.__T0.isConnected, quanti:document.querySelectorAll('#bdsf-trigger').length}));
 console.log('dopo cambio variante  :', JSON.stringify(dopoCambio));
 const apre=await p.evaluate(()=>{const d=document.getElementById('bdsf-drawer'); document.getElementById('bdsf-trigger').click(); return {siApre:!d.hidden};});
 console.log('il link funziona ancora:', JSON.stringify(apre));
 await b.close();
})();
