const { chromium } = require('playwright-core');
const fs=require('fs');
const OUT='/private/tmp/claude-501/-Users-marino/528f078e-f6e7-4138-8906-5adb44be4fc8/scratchpad';
const TPL=fs.readFileSync(OUT+'/widget_tpl.html','utf8');
(async()=>{
 const b=await chromium.launch({channel:'chrome'}).catch(()=>chromium.launch());
 const p=await b.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await p.goto('https://bottegadalmut.com/products/pantaloni-belted-o-transition-brown-house-in-lino',{waitUntil:'domcontentloaded',timeout:60000});
 await p.waitForTimeout(3500);
 const PAY={productId:1,title:'Pantaloni Belted',handle:'p',type:'',tags:[],optionName:'Taglia',optionPosition:1,values:['46','48','50','52','54'].map(l=>({label:l,available:true})),collections:[],locale:'it'};
 await p.evaluate(html=>{const list=document.querySelector('.product-info__block-list');
   const sg=[...list.children].find(el=>/size guide/i.test(el.innerText||''))||list.children[3];
   const d=document.createElement('div'); d.innerHTML=html; const sc=[...d.querySelectorAll('script')];
   sc.forEach(s=>s.remove()); sg.after(d);
   sc.forEach(s=>{const n=document.createElement('script'); if(s.type){n.type=s.type;n.id=s.id;} n.textContent=s.textContent; document.body.appendChild(n);});
 }, TPL.replace('__PAYLOAD__', JSON.stringify(PAY)));
 await p.waitForTimeout(400);
 await p.evaluate(()=>document.getElementById('bdsf-trigger').click()); await p.waitForTimeout(900);
 await p.fill('#bdsf-w','80'); await p.fill('#bdsf-h','180'); await p.fill('#bdsf-a','38');
 await p.evaluate(()=>document.getElementById('bdsf-next').click()); await p.waitForTimeout(700);
 const a=await p.evaluate(()=>({spento:document.getElementById('bdsf-next').disabled,
   preselezionati:[...document.querySelectorAll('input[name=bdsf-fit]')].filter(i=>i.checked).length}));
 await p.evaluate(()=>{const i=document.querySelector('input[name="bdsf-fit"][value="slim"]');i.checked=true;i.dispatchEvent(new Event('change',{bubbles:true}));});
 await p.waitForTimeout(300);
 const c=await p.evaluate(()=>document.getElementById('bdsf-next').disabled);
 await p.evaluate(()=>document.getElementById('bdsf-next').click()); await p.waitForTimeout(1200);
 const r=await p.evaluate(()=>({taglia:document.querySelector('.bdsf-res-size').textContent.trim(),
   fit:(document.querySelector('.bdsf-res-fit')||{}).textContent}));
 console.log('  step2 senza scelta -> pulsante spento:',a.spento,'| radio preselezionati:',a.preselezionati);
 console.log('  dopo la scelta -> pulsante spento:',c);
 console.log('  risultato:',JSON.stringify(r));
 await b.close();
})();
