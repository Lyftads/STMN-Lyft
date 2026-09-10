const { chromium } = require('playwright-core');
const fs=require('fs');
const OUT='/private/tmp/claude-501/-Users-marino/528f078e-f6e7-4138-8906-5adb44be4fc8/scratchpad';
const TPL=fs.readFileSync(OUT+'/widget_tpl.html','utf8');

async function test(p, handle, payload, tag, viewport){
  await p.setViewportSize(viewport);
  await p.goto('https://bottegadalmut.com/products/'+handle,{waitUntil:'networkidle',timeout:60000});
  await p.waitForTimeout(2500);
  await p.evaluate(()=>{window.__err=[];window.addEventListener('error',e=>window.__err.push(String(e.message)));});
  const html=TPL.replace('__PAYLOAD__', JSON.stringify(payload));
  await p.evaluate(h=>{
    const host=document.querySelector('.product-info__block-list')||document.querySelector('.product-info');
    const d=document.createElement('div'); d.innerHTML=h;
    // gli script iniettati via innerHTML non girano: li rieseguo
    const scripts=[...d.querySelectorAll('script')];
    scripts.forEach(s=>s.remove());
    host.appendChild(d);
    scripts.forEach(s=>{ if(s.type==='application/json'){const j=document.createElement('script');j.type=s.type;j.id=s.id;j.textContent=s.textContent;document.body.appendChild(j);} });
    scripts.filter(s=>!s.type).forEach(s=>{ const n=document.createElement('script'); n.textContent=s.textContent; document.body.appendChild(n); });
  }, html);
  await p.waitForTimeout(600);
  const log=[];
  const diag=await p.evaluate(()=>{
    const t=document.getElementById('bdsf-trigger'), d=document.getElementById('bdsf-drawer');
    const r=t&&t.getBoundingClientRect();
    return {trigger:!!t, drawer:!!d, testo:t?t.innerText.trim():null,
            box:r?[Math.round(r.width),Math.round(r.height)]:null,
            errori:window.__err||null};
  });
  log.push('diagnostica: '+JSON.stringify(diag));
  if(!diag.trigger) return log;
  // via banner cookie / popup
  for(const sel of ['#shopify-pc__banner__btn-accept','button:has-text("Accetta")','.needsclick .close','[aria-label="Chiudi"]']){
    try{ const l=p.locator(sel).first(); if(await l.count() && await l.isVisible()) { await l.click({timeout:2000}); await p.waitForTimeout(300);} }catch(e){}
  }
  await p.locator('#bdsf-trigger').scrollIntoViewIfNeeded();
  await p.locator('#bdsf-trigger').click({force:true, timeout:8000}); await p.waitForTimeout(800);
  await p.screenshot({path:`${OUT}/t_${tag}_1.png`});
  await p.fill('#bdsf-w','80'); await p.fill('#bdsf-h','180'); await p.fill('#bdsf-a','38');
  await p.click('[data-shape="average"]'); await p.waitForTimeout(250);
  log.push('bottone avanti attivo: '+!(await p.locator('#bdsf-next').isDisabled()));
  await p.click('#bdsf-next'); await p.waitForTimeout(600);
  await p.screenshot({path:`${OUT}/t_${tag}_2.png`});
  await p.locator('input[name="bdsf-fit"][value="slim"]').check(); await p.waitForTimeout(200);
  await p.click('#bdsf-next'); await p.waitForTimeout(900);
  const size=await p.locator('.bdsf-res-size').textContent();
  const badge=await p.locator('.bdsf-badge').first().textContent().catch(()=>'-');
  const rows=await p.locator('.bdsf-row').allTextContents();
  log.push('TAGLIA: '+size.trim()+' | '+badge.trim());
  log.push('tabella: '+rows.map(r=>r.replace(/\s+/g,' ').trim()).join(' / '));
  await p.screenshot({path:`${OUT}/t_${tag}_3.png`});
  const btn=(await p.locator('#bdsf-next').textContent()).trim();
  log.push('CTA finale: '+btn);
  await p.click('#bdsf-next'); await p.waitForTimeout(900);
  const sel=await p.evaluate(()=>{
    const i=document.querySelector('.product-info input[type=radio]:checked');
    if(!i) return '(nessun radio selezionato)';
    const l=document.querySelector('label[for="'+CSS.escape(i.id)+'"]');
    return l?l.textContent.trim():'?';
  });
  log.push('variante selezionata sulla pagina: '+sel);
  return log;
}

(async()=>{
 const b=await chromium.launch({channel:'chrome'}).catch(()=>chromium.launch());
 const p=await b.newPage();
 const cases=[
  ['camicia-in-lino-classic-fit-bianca',{productId:11862078587148,title:'Camicia in lino Classic-Fit Bianca',handle:'camicia-in-lino-classic-fit-bianca',type:'',tags:[],optionName:'Taglia',optionPosition:1,values:['37','38','39','40','41','42','43','44','45','46','47'].map(l=>({label:l,available:true})),collections:[],locale:'it'},'camicia',{width:1400,height:1000}],
  ['pantaloni-belted-o-transition-brown-house-in-lino',{productId:1,title:'Pantaloni Belted O Transition Brown House in Lino',handle:'pantaloni-belted',type:'',tags:[],optionName:'Taglia',optionPosition:1,values:['46','48','50','52','54'].map(l=>({label:l,available:true})),collections:[],locale:'it'},'pantaloni',{width:1400,height:1000}],
  ['camicia-sahariana-seersucker-polvere',{productId:2,title:'Camicia Sahariana seersucker Ceruleo',handle:'camicia-sahariana',type:'',tags:[],optionName:'Taglia Set',optionPosition:1,values:['S - 46','M - 48','L - 50','XL - 52'].map(l=>({label:l,available:true})),collections:[],locale:'it'},'sahariana-mobile',{width:390,height:844}]
 ];
 for(const [h,pay,tag,vp] of cases){
   console.log('\n═══ '+tag+' ('+vp.width+'px) ═══');
   try{ (await test(p,h,pay,tag,vp)).forEach(l=>console.log('  '+l)); }
   catch(e){ console.log('  ERRORE: '+e.message.split('\n')[0]); }
 }
 await b.close();
})();
