const { chromium } = require('playwright-core');
const fs=require('fs');
const OUT='/private/tmp/claude-501/-Users-marino/528f078e-f6e7-4138-8906-5adb44be4fc8/scratchpad';
const TPL=fs.readFileSync(OUT+'/widget_tpl.html','utf8');
const PAY={productId:1,title:'Pantaloni Belted O Transition Brown House in Lino',handle:'pantaloni-belted',type:'',tags:[],optionName:'Taglia',optionPosition:1,values:['46','48','50','52','54'].map(l=>({label:l,available:true})),collections:[],locale:'it'};

(async()=>{
 const b=await chromium.launch({channel:'chrome'}).catch(()=>chromium.launch());
 for(const [w,h,nome] of [[360,780,'360'],[390,844,'390'],[430,932,'430'],[1400,1000,'desktop']]){
  const p=await b.newPage({viewport:{width:w,height:h}, isMobile:w<500, hasTouch:w<500, deviceScaleFactor:2});
  await p.goto('https://bottegadalmut.com/products/pantaloni-belted-o-transition-brown-house-in-lino',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(2500);
  // inserisce SUBITO SOTTO il blocco Size Guide
  await p.evaluate(html=>{
    const list=document.querySelector('.product-info__block-list');
    const sg=[...list.children].find(el=>/size guide/i.test(el.innerText||''));
    const d=document.createElement('div'); d.innerHTML=html;
    const scripts=[...d.querySelectorAll('script')]; scripts.forEach(s=>s.remove());
    sg.after(d);
    scripts.forEach(s=>{const n=document.createElement('script'); if(s.type){n.type=s.type;n.id=s.id;} n.textContent=s.textContent; document.body.appendChild(n);});
  }, TPL.replace('__PAYLOAD__', JSON.stringify(PAY)));
  await p.waitForTimeout(500);
  const geo=await p.evaluate(()=>{
    const t=document.getElementById('bdsf-trigger'), r=t.getBoundingClientRect();
    return {tap:[Math.round(r.width),Math.round(r.height)], overflowX: document.documentElement.scrollWidth > window.innerWidth};
  });
  await p.locator('#bdsf-trigger').scrollIntoViewIfNeeded();
  await p.screenshot({path:`${OUT}/m_${nome}_trigger.png`, clip: await p.locator('#bdsf-trigger').evaluate(el=>{const r=el.getBoundingClientRect();return{x:Math.max(0,r.x-20),y:Math.max(0,r.y-90),width:Math.min(430,r.width+260),height:190};})});
  await p.evaluate(()=>document.getElementById('bdsf-trigger').click());
  await p.waitForTimeout(800);
  const apertura=await p.evaluate(()=>{const d=document.getElementById('bdsf-drawer');
    return {hidden:d.hidden, aperto:d.classList.contains('bdsf-open'), inputVisibile: !!document.getElementById('bdsf-w').offsetParent};});
  if(!apertura.aperto){ console.log(nome+' NON APERTO '+JSON.stringify(apertura)); await p.close(); continue; }
  await p.fill('#bdsf-w','80'); await p.fill('#bdsf-h','180'); await p.fill('#bdsf-a','38');
  await p.evaluate(()=>document.getElementById('bdsf-next').click()); await p.waitForTimeout(500);
  await p.evaluate(()=>{const i=document.querySelector('input[name="bdsf-fit"][value="regular"]');i.checked=true;i.dispatchEvent(new Event('change',{bubbles:true}));});
  await p.evaluate(()=>document.getElementById('bdsf-next').click()); await p.waitForTimeout(800);
  const res=await p.evaluate(()=>{
    const d=document.getElementById('bdsf-drawer'), r=d.getBoundingClientRect();
    const body=document.getElementById('bdsf-body');
    const cta=document.getElementById('bdsf-next').getBoundingClientRect();
    return {taglia:document.querySelector('.bdsf-res-size').textContent.trim(),
            drawer:[Math.round(r.width),Math.round(r.height)],
            dentroViewport: r.right<=window.innerWidth+1 && r.bottom<=window.innerHeight+1,
            ctaAltezza:Math.round(cta.height), ctaVisibile: cta.bottom<=window.innerHeight+1,
            scrollOrizzontale: body.scrollWidth>body.clientWidth};
  });
  await p.screenshot({path:`${OUT}/m_${nome}_res.png`});
  console.log(`${nome.padEnd(8)} tap ${geo.tap[0]}x${geo.tap[1]}  overflowX:${geo.overflowX}  |  ${JSON.stringify(res)}`);
  await p.close();
 }
 await b.close();
})();
