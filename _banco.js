const { chromium } = require('playwright-core');
const OUT='/private/tmp/claude-501/-Users-marino/528f078e-f6e7-4138-8906-5adb44be4fc8/scratchpad';
(async()=>{
 const b=await chromium.launch({channel:'chrome'}).catch(()=>chromium.launch());
 const p=await b.newPage({viewport:{width:390,height:844}});
 p.on('pageerror',e=>console.log('PAGEERROR:',String(e).slice(0,220)));
 p.on('console',m=>{ if(m.type()==='error') console.log('CONSOLE:',m.text().slice(0,200)); });
 await p.goto('file://'+OUT+'/banco.html');
 await p.waitForTimeout(400);
 const r=await p.evaluate(()=>{
   const d=document.getElementById('bdsf-drawer');
   const out={prima:d.hidden};
   document.getElementById('bdsf-trigger').click();
   out.dopo=d.hidden; out.classi=d.className;
   return out;
 });
 console.log(JSON.stringify(r));
 await b.close();
})();
