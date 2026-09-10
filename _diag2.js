const { chromium } = require('playwright-core');
const fs=require('fs');
const OUT='/private/tmp/claude-501/-Users-marino/528f078e-f6e7-4138-8906-5adb44be4fc8/scratchpad';
const TPL=fs.readFileSync(OUT+'/widget_tpl.html','utf8');
(async()=>{
 const b=await chromium.launch({channel:'chrome'}).catch(()=>chromium.launch());
 const p=await b.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 p.on('pageerror',e=>console.log('PAGEERROR:',String(e).slice(0,200)));
 await p.goto('https://bottegadalmut.com/products/pantaloni-belted-o-transition-brown-house-in-lino',{waitUntil:'domcontentloaded',timeout:60000});
 await p.waitForTimeout(3000);
 await p.evaluate(()=>{window.__E=[];window.addEventListener('error',e=>window.__E.push(e.message+' @ '+e.lineno));});
 const PAY={productId:1,title:'Pantaloni Belted',handle:'p',type:'',tags:[],optionName:'Taglia',optionPosition:1,
   values:['46','48','50','52','54'].map(l=>({label:l,available:true,variantId:null})),collections:[],locale:'it',routeRoot:'/'};
 await p.evaluate(html=>{const list=document.querySelector('.product-info__block-list');
   const sg=[...list.children].find(el=>/size guide/i.test(el.innerText||''))||list.children[3];
   const d=document.createElement('div'); d.innerHTML=html; const sc=[...d.querySelectorAll('script')];
   sc.forEach(s=>s.remove()); sg.after(d);
   sc.forEach(s=>{const n=document.createElement('script'); if(s.type){n.type=s.type;n.id=s.id;} n.textContent=s.textContent; document.body.appendChild(n);});
 }, TPL.replace('__PAYLOAD__', JSON.stringify(PAY)));
 await p.waitForTimeout(600);
 const r=await p.evaluate(()=>{
   const out={};
   out.erroriFinestra=window.__E;
   out.titolo=document.getElementById('bdsf-title').textContent;
   out.schedaProdotto=document.getElementById('bdsf-prod').className;
   out.stepLabel=document.querySelector('.bdsf-step').textContent;
   out.ctaFooter=document.getElementById('bdsf-next').textContent;
   const d=document.getElementById('bdsf-drawer');
   out.drawerEsiste=!!d; out.drawerPadre=d?d.parentElement.tagName:null; out.hiddenPrima=d?d.hidden:null;
   try{ document.getElementById('bdsf-trigger').click(); out.clickOk=true; }catch(e){ out.clickErr=String(e).slice(0,180); }
   out.hiddenDopo=d?d.hidden:null;
   out.classi=d?d.className:null;
   out.overlayClassi=document.getElementById('bdsf-overlay').className;
   const h=document.getElementById('bdsf-h');
   out.altezzaType=h.type; out.altezzaPh=h.placeholder;
   return out;
 });
 console.log(JSON.stringify(r,null,1));
 await b.close();
})();
