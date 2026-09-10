const { chromium } = require('playwright-core');
const OUT='/private/tmp/claude-501/-Users-marino/528f078e-f6e7-4138-8906-5adb44be4fc8/scratchpad';
async function prova(b,file,{w,h,imperial}){
  const p=await b.newPage({viewport:{width:390,height:844}});
  p.on('pageerror',e=>console.log('PAGEERROR:',String(e).slice(0,180)));
  await p.goto('file://'+OUT+'/'+file); await p.waitForTimeout(300);
  await p.evaluate(()=>{try{localStorage.clear()}catch(e){}});
  await p.reload({waitUntil:'load'}); await p.waitForTimeout(700);
  const salvato=await p.evaluate(()=>{try{return localStorage.getItem('bdsf:v1')}catch(e){return 'n/d'}});
  await p.evaluate(()=>document.getElementById('bdsf-trigger').click());
  const passo=await p.evaluate(()=>[...document.querySelectorAll('.bdsf-step')].findIndex(e=>e.classList.contains('bdsf-active')));
  if(imperial) await p.evaluate(()=>{document.querySelector('[data-wu="lbs"]').click();document.querySelector('[data-hu="in"]').click();});
  const ph=await p.evaluate(({w,h})=>{const g=i=>document.getElementById(i);
    const setv=(id,v)=>{const e=g(id); e.value=v; e.dispatchEvent(new Event('input',{bubbles:true}));};
    setv('bdsf-w',w); setv('bdsf-h',h); setv('bdsf-a','38');
    return [g('bdsf-w').placeholder,g('bdsf-h').placeholder];},{w,h});
  await p.evaluate(()=>{document.getElementById('bdsf-h').dispatchEvent(new Event('blur'));});
  const st=await p.evaluate(()=>{document.getElementById('bdsf-next').click();
    const e=document.getElementById('bdsf-err'); return e.hidden?null:e.textContent;});
  if(st){ await p.close(); return {placeholder:ph, errore:st, salvato, passo}; }
  await p.evaluate(()=>{const r=document.querySelector('input[name="bdsf-fit"][value="slim"]');r.checked=true;r.dispatchEvent(new Event('change',{bubbles:true}));});
  const r=await p.evaluate(()=>{document.getElementById('bdsf-next').click();
    const big=document.querySelector('.bdsf-res-size');
    if(!big) return {diagnosi:{p1:document.getElementById('bdsf-p1').className,p2:document.getElementById('bdsf-p2').className,
      spento:document.getElementById('bdsf-next').disabled, res:document.getElementById('bdsf-res').innerHTML.length}};
    return {taglia:big.textContent.trim(),
      conversione:(document.querySelector('.bdsf-res-eq')||{}).textContent||null,
      tabella:[...document.querySelectorAll('.bdsf-row')].map(e=>e.textContent.replace(/\s+/g,' ').trim())};});
  await p.close(); return Object.assign({placeholder:ph, salvato, passo}, r);
}
(async()=>{
 const b=await chromium.launch({channel:'chrome'}).catch(()=>chromium.launch());
 const r1=await prova(b,'banco.html',{w:'80',h:'180'});
 console.log('PANTALONI metrico 80kg/180cm :', r1.taglia, '|', r1.conversione, '| apre allo step', r1.passo, '| salvato:', r1.salvato);
 for(const h of ["5'11\"","5.11","71"]){
   const r=await prova(b,'banco.html',{w:'176',h,imperial:true});
   console.log(`PANTALONI 176lbs ${h.padEnd(7)}    :`, r.taglia||r.errore||JSON.stringify(r.diagnosi), '|', r.conversione, '| step', r.passo, '| ph', JSON.stringify(r.placeholder));
 }
 const re=await prova(b,'banco.html',{w:'176',h:'2',imperial:true});
 console.log('ERRORE altezza 2             :', JSON.stringify(re.errore));
 const rc=await prova(b,'banco2.html',{w:'176',h:"5'11\"",imperial:true});
 console.log('CAMICIA 176lbs 5\'11"         :', rc.taglia, '|', rc.conversione);
 console.log('  tabella:', JSON.stringify(rc.tabella));
 const rb=await prova(b,'banco3.html',{w:'80',h:'180'});
 console.log('BLAZER metrico 80kg/180cm    :', rb.taglia, '|', rb.conversione);
 console.log('  tabella:', JSON.stringify(rb.tabella));
 await b.close();
})();
