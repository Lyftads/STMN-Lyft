const { chromium } = require('playwright-core');
const fs=require('fs');
const OUT='/private/tmp/claude-501/-Users-marino/528f078e-f6e7-4138-8906-5adb44be4fc8/scratchpad';
const TPL=fs.readFileSync(OUT+'/widget_tpl.html','utf8');
const P=[
 ['pantaloni-belted-o-transition-brown-house-in-lino','Pantaloni Belted O Transition Brown House in Lino','Taglia',['46','48','50','52','54']],
 ['camicia-in-lino-classic-fit-bianca','Camicia in lino Classic-Fit Bianca','Taglia',['37','38','39','40','41','42','43','44','45','46','47']],
 ['camicia-sahariana-seersucker-polvere','Camicia Sahariana seersucker Ceruleo','Taglia Set',['S - 46','M - 48','L - 50','XL - 52']],
 ['cricket-jumper-blu-1','Cricket in Cotone Panna Celeste/Rosa','MISURA',['S','M','L','XL']]
];
(async()=>{
 const b=await chromium.launch({channel:'chrome'}).catch(()=>chromium.launch());
 const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
 const p=await ctx.newPage();   // stessa sessione: localStorage condiviso
 for(let n=0;n<P.length;n++){
  const [h,titolo,opt,vals]=P[n];
  await p.goto('https://bottegadalmut.com/products/'+h,{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(3500);
  const img=await p.evaluate(()=>{const im=[...document.querySelectorAll('img')]
     .find(i=>/cdn\/shop\/(files|products)/.test(i.currentSrc||i.src||''));
     const u=(im&&(im.currentSrc||im.src))||''; return u.replace(/([?&])width=\d+/,'$1width=220');});
  const PAY={productId:1000+n,title:titolo,handle:h,type:'',tags:[],optionName:opt,optionPosition:1,
    values:vals.map(l=>({label:l,available:true})),collections:[],locale:'it',
    image:img,image2x:img.replace('width=220','width=440'),imageAlt:titolo};
  await p.evaluate(html=>{const list=document.querySelector('.product-info__block-list');
    const sg=[...list.children].find(el=>/size guide/i.test(el.innerText||''))||list.children[3];
    const d=document.createElement('div'); d.innerHTML=html; const sc=[...d.querySelectorAll('script')];
    sc.forEach(s=>s.remove()); sg.after(d);
    sc.forEach(s=>{const nn=document.createElement('script'); if(s.type){nn.type=s.type;nn.id=s.id;} nn.textContent=s.textContent; document.body.appendChild(nn);});
  }, TPL.replace('__PAYLOAD__', JSON.stringify(PAY)));
  await p.waitForTimeout(400);
  const trigger=await p.evaluate(()=>document.getElementById('bdsf-trigger').innerText.replace(/\n/g,' ').trim());
  await p.evaluate(()=>document.getElementById('bdsf-trigger').click());
  await p.waitForTimeout(1200);
  const st=await p.evaluate(()=>{
    const c=document.getElementById('bdsf-prod'); const i=c.querySelector('img');
    const step=[...document.querySelectorAll('.bdsf-step')].findIndex(e=>e.classList.contains('bdsf-active'));
    return {step, nome:(c.querySelector('.bdsf-prod-name')||{}).textContent,
            imgOk:i?i.naturalWidth>0:false, img:i?i.currentSrc.split('/').pop().slice(0,26):null,
            visibile:c.getBoundingClientRect().height>10};
  });
  // completa quello che manca
  if(st.step===0){ await p.fill('#bdsf-w','80'); await p.fill('#bdsf-h','180'); await p.fill('#bdsf-a','38');
    await p.evaluate(()=>document.getElementById('bdsf-next').click()); await p.waitForTimeout(600); }
  if(await p.evaluate(()=>document.getElementById('bdsf-p1').classList.contains('bdsf-on'))){
    await p.evaluate(()=>{const i=document.querySelector('input[name="bdsf-fit"][value="slim"]');i.checked=true;i.dispatchEvent(new Event('change',{bubbles:true}));});
    await p.evaluate(()=>document.getElementById('bdsf-next').click()); await p.waitForTimeout(1000); }
  const res=await p.evaluate(()=>{
    const c=document.getElementById('bdsf-prod'); const i=c.querySelector('img');
    return {taglia:(document.querySelector('.bdsf-res-size')||{}).textContent,
            schedaSulRisultato:c.getBoundingClientRect().height>10,
            img:i?i.currentSrc.split('/').pop().slice(0,26):null};});
  console.log(`${n+1}. ${titolo.slice(0,34).padEnd(34)} apre allo step ${st.step} | foto ${st.img} | trigger "${trigger}" -> taglia ${res.taglia} | scheda visibile su risultato: ${res.schedaSulRisultato}`);
  await p.evaluate(()=>document.getElementById('bdsf-close').click()); await p.waitForTimeout(400);
 }
 await ctx.close(); await b.close();
})();
