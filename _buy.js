const { chromium } = require('playwright-core');
const fs=require('fs');
const OUT='/private/tmp/claude-501/-Users-marino/528f078e-f6e7-4138-8906-5adb44be4fc8/scratchpad';
const TPL=fs.readFileSync(OUT+'/widget_tpl.html','utf8');
let PR=[]; for(const i of [1,2,3]) PR=PR.concat(JSON.parse(fs.readFileSync(OUT+'/bd_'+i+'.json')).products);
const SZ=['taglia','misura','size','taglie','taglia set','taglia camicia'];
const pick=h=>{
  const p=PR.find(x=>x.handle===h); const o=p.options.find(o=>SZ.includes(o.name.toLowerCase()));
  return {productId:p.id,title:p.title,handle:p.handle,type:'',tags:p.tags||[],optionName:o.name,optionPosition:1,
    values:o.values.map(l=>{const v=p.variants.find(v=>v.option1===l);return {label:l,available:v?v.available:true,variantId:v?v.id:null};}),
    collections:[],locale:'it',
    image:(p.images[0]||{}).src ? p.images[0].src.replace(/(\.[a-z]+)(\?|$)/,'$1?width=220') : null,
    image2x:(p.images[0]||{}).src ? p.images[0].src.replace(/(\.[a-z]+)(\?|$)/,'$1?width=440') : null,
    imageAlt:p.title};
};
const H=['pantaloni-belted-o-transition-brown-house-in-lino','camicia-in-lino-classic-fit-bianca','camicia-sahariana-seersucker-polvere','cricket-jumper-blu-1'];
(async()=>{
 const b=await chromium.launch({channel:'chrome'}).catch(()=>chromium.launch());
 const ctx=await b.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:2});
 const p=await ctx.newPage();
 const foto=[];
 for(let n=0;n<H.length;n++){
  const PAY=pick(H[n]);
  await p.goto('https://bottegadalmut.com/products/'+H[n],{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(3200);
  await p.evaluate(()=>{document.querySelectorAll('.bdsf-wrap,#bdsf-drawer,#bdsf-overlay,#bdsf-data,.bdsf-sizenote').forEach(e=>e.remove());});
  await p.evaluate(html=>{const list=document.querySelector('.product-info__block-list');
    const sg=[...list.children].find(el=>/size guide/i.test(el.innerText||''))||list.children[3];
    const d=document.createElement('div'); d.innerHTML=html; const sc=[...d.querySelectorAll('script')];
    sc.forEach(s=>s.remove()); sg.after(d);
    sc.forEach(s=>{const nn=document.createElement('script'); if(s.type){nn.type=s.type;nn.id=s.id;} nn.textContent=s.textContent; document.body.appendChild(nn);});
  }, TPL.replace('__PAYLOAD__', JSON.stringify(PAY)));
  await p.waitForTimeout(400);
  await p.evaluate(()=>document.getElementById('bdsf-trigger').click());
  await p.waitForTimeout(1200);
  if(await p.evaluate(()=>document.getElementById('bdsf-p0').classList.contains('bdsf-on'))){
    await p.fill('#bdsf-w','80'); await p.fill('#bdsf-h','180'); await p.fill('#bdsf-a','38');
    await p.evaluate(()=>document.getElementById('bdsf-next').click()); await p.waitForTimeout(600);}
  if(await p.evaluate(()=>document.getElementById('bdsf-p1').classList.contains('bdsf-on'))){
    await p.evaluate(()=>{const i=document.querySelector('input[name="bdsf-fit"][value="slim"]');i.checked=true;i.dispatchEvent(new Event('change',{bubbles:true}));});
    await p.evaluate(()=>document.getElementById('bdsf-next').click()); await p.waitForTimeout(1000);}
  const st=await p.evaluate(()=>{const c=document.getElementById('bdsf-prod'),i=c.querySelector('img');
    return {nome:(c.querySelector('.bdsf-prod-name')||{}).textContent, img:i?i.currentSrc:null, ok:i?i.naturalWidth>0:false,
            taglia:(document.querySelector('.bdsf-res-size')||{}).textContent,
            cta:document.getElementById('bdsf-next').textContent.trim(),
            alt:!!document.getElementById('bdsf-selonly')};});
  foto.push(st.img);
  console.log(`${n+1}. ${String(st.nome).slice(0,32).padEnd(32)} foto=${String(st.img).split('/').pop().split('?')[0].slice(0,24).padEnd(24)} caricata=${st.ok} taglia=${st.taglia} | CTA "${st.cta}"`);
  if(n===H.length-1){
    await p.evaluate(()=>document.getElementById('bdsf-next').click());
    await p.waitForTimeout(6000);
    console.log('\n   dopo click ACQUISTA ORA -> '+p.url().slice(0,72));
    console.log('   è il checkout:', /\/checkouts\//.test(p.url()));
  }
 }
 console.log('\nfoto tutte diverse:', new Set(foto).size===foto.length, '('+new Set(foto).size+' distinte su '+foto.length+')');
 await ctx.close(); await b.close();
})();
