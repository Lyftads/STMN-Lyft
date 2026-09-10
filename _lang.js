const { chromium } = require('playwright-core');
const fs=require('fs');
const OUT='/private/tmp/claude-501/-Users-marino/528f078e-f6e7-4138-8906-5adb44be4fc8/scratchpad';
const TPL=fs.readFileSync(OUT+'/widget_tpl.html','utf8');
const IMG='https://bottegadalmut.com/cdn/shop/files/DSC00060.jpg?v=1&width=220';
const mk=loc=>({productId:1,title:'Pantaloni Belted O Transition Brown House in Lino',handle:'pantaloni-belted',type:'',tags:[],optionName:'Taglia',optionPosition:1,values:['46','48','50','52','54'].map(l=>({label:l,available:true})),collections:[],locale:loc,
  image:IMG,image2x:IMG,imageAlt:'x'});
(async()=>{
 const b=await chromium.launch({channel:'chrome'}).catch(()=>chromium.launch());
 for(const [url,loc,nome] of [
   ['https://bottegadalmut.com/products/pantaloni-belted-o-transition-brown-house-in-lino','it','ITALIANO'],
   ['https://bottegadalmut.com/en/products/pantaloni-belted-o-transition-brown-house-in-lino','en','INGLESE']]){
  const p=await b.newPage({viewport:{width:1400,height:1000}});
  await p.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(5000); // lascia lavorare Weglot
  await p.evaluate(html=>{
    const list=document.querySelector('.product-info__block-list');
    const sg=[...list.children].find(el=>/size guide/i.test(el.innerText||''))||list.children[3];
    const d=document.createElement('div'); d.innerHTML=html;
    const sc=[...d.querySelectorAll('script')]; sc.forEach(s=>s.remove()); sg.after(d);
    sc.forEach(s=>{const n=document.createElement('script'); if(s.type){n.type=s.type;n.id=s.id;} n.textContent=s.textContent; document.body.appendChild(n);});
  }, TPL.replace('__PAYLOAD__', JSON.stringify(Object.assign(mk(loc), await p.evaluate(()=>{
      const im=document.querySelector('.product-gallery img, .product__media img, main img');
      const u=im&&(im.currentSrc||im.src)||'';
      return {image:u.replace(/(&|\?)width=\d+/,'$1width=220'), image2x:u.replace(/(&|\?)width=\d+/,'$1width=440')};
    })))));
  await p.waitForTimeout(3000); // Weglot potrebbe ritradurre il DOM iniettato
  const t1=await p.evaluate(()=>document.getElementById('bdsf-trigger').innerText.trim());
  await p.evaluate(()=>document.getElementById('bdsf-trigger').click());
  await p.waitForTimeout(2500);
  const s1=await p.evaluate(()=>{
    const g=i=>document.getElementById(i);
    return {titolo:g('bdsf-title').innerText.trim(),
      step:[...document.querySelectorAll('.bdsf-step')].map(e=>e.innerText.trim()),
      campi:['bdsf-w','bdsf-h','bdsf-a'].map(i=>g(i).placeholder),
      forme:[...document.querySelectorAll('.bdsf-shape span')].map(e=>e.innerText.trim()),
      nota:g('bdsf-hint-txt').innerText.trim().slice(0,60), cta:g('bdsf-next').innerText.trim()};
  });
  await p.fill('#bdsf-w','80'); await p.fill('#bdsf-h','180'); await p.fill('#bdsf-a','38');
  await p.evaluate(()=>document.getElementById('bdsf-next').click()); await p.waitForTimeout(1500);
  const s2=await p.evaluate(()=>({domanda:document.getElementById('bdsf-fit-q').innerText.trim(),
    sotto:document.getElementById('bdsf-fit-sub').innerText.trim(),
    opzioni:[...document.querySelectorAll('.bdsf-opt-txt')].map(e=>e.innerText.replace(/\n/g,' / ').trim()),
    cta:document.getElementById('bdsf-next').innerText.trim()}));
  await p.evaluate(()=>document.getElementById('bdsf-next').click()); await p.waitForTimeout(1800);
  const s3=await p.evaluate(()=>({kicker:document.querySelector('.bdsf-res-kicker').innerText.trim(),
    taglia:document.querySelector('.bdsf-res-size').innerText.trim(),
    fit:document.querySelector('.bdsf-res-fit').innerText.trim(),
    badge:document.querySelector('.bdsf-badge').innerText.trim(),
    tabella:[...document.querySelectorAll('.bdsf-row')].map(e=>e.innerText.replace(/\n/g,': ').trim()),
    cta:document.getElementById('bdsf-next').innerText.trim()}));
  console.log('\n═══════════ '+nome+' ═══════════');
  console.log(' trigger:',t1);
  console.log(' STEP1:',JSON.stringify(s1));
  console.log(' STEP2:',JSON.stringify(s2));
  console.log(' STEP3:',JSON.stringify(s3));
  await p.screenshot({path:`${OUT}/lang_${loc}.png`});
  await p.close();
 }
 await b.close();
})();
