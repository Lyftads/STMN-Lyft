const { chromium } = require('playwright-core');
const fs=require('fs');
const OUT='/private/tmp/claude-501/-Users-marino/528f078e-f6e7-4138-8906-5adb44be4fc8/scratchpad';
const TPL=fs.readFileSync(OUT+'/widget_tpl.html','utf8');
const mk=(loc,vals,opt)=>({productId:1,title:'Pantaloni Belted',handle:'p',type:'',tags:[],optionName:opt,optionPosition:1,
  values:vals.map(l=>({label:l,available:true,variantId:null})),collections:[],locale:loc,routeRoot:loc==='en'?'/en':'/'});
async function setup(p,url,pay){
  await p.goto(url,{waitUntil:'domcontentloaded',timeout:60000}); await p.waitForTimeout(3000);
  await p.evaluate(html=>{const list=document.querySelector('.product-info__block-list');
    const sg=[...list.children].find(el=>/size guide/i.test(el.innerText||''))||list.children[3];
    const d=document.createElement('div'); d.innerHTML=html; const sc=[...d.querySelectorAll('script')];
    sc.forEach(s=>s.remove()); sg.after(d);
    sc.forEach(s=>{const n=document.createElement('script'); if(s.type){n.type=s.type;n.id=s.id;} n.textContent=s.textContent; document.body.appendChild(n);});
  }, TPL.replace('__PAYLOAD__', JSON.stringify(pay)));
  await p.waitForTimeout(400);
  await p.evaluate(()=>{try{localStorage.removeItem('bdsf:v1')}catch(e){}});
  await p.evaluate(()=>document.getElementById('bdsf-trigger').click()); await p.waitForTimeout(900);
}
async function run(p,{w,h,imperial}){
  if(imperial){ await p.evaluate(()=>{document.querySelector('[data-wu="lbs"]').click();document.querySelector('[data-hu="in"]').click();}); await p.waitForTimeout(300); }
  await p.fill('#bdsf-w',w); await p.fill('#bdsf-h',h); await p.fill('#bdsf-a','38');
  await p.waitForTimeout(300);
  const ph=await p.evaluate(()=>[document.getElementById('bdsf-w').placeholder,document.getElementById('bdsf-h').placeholder]);
  await p.evaluate(()=>document.getElementById('bdsf-next').click()); await p.waitForTimeout(600);
  const err=await p.evaluate(()=>{const e=document.getElementById('bdsf-err');return e.hidden?null:e.textContent;});
  if(err) return {err,ph};
  await p.evaluate(()=>{const i=document.querySelector('input[name="bdsf-fit"][value="slim"]');i.checked=true;i.dispatchEvent(new Event('change',{bubbles:true}));});
  await p.evaluate(()=>document.getElementById('bdsf-next').click()); await p.waitForTimeout(1000);
  return await p.evaluate(()=>({taglia:document.querySelector('.bdsf-res-size').textContent.trim(),
    eq:(document.querySelector('.bdsf-res-eq')||{}).textContent,
    righe:[...document.querySelectorAll('.bdsf-row')].map(e=>e.textContent.replace(/\s+/g,' ').trim())}));
}
(async()=>{
 const b=await chromium.launch({channel:'chrome'}).catch(()=>chromium.launch());
 const IT='https://bottegadalmut.com/products/pantaloni-belted-o-transition-brown-house-in-lino';
 const EN='https://bottegadalmut.com/en/products/pantaloni-belted-o-transition-brown-house-in-lino';
 let p=await b.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await setup(p,IT,mk('it',['46','48','50','52','54'],'Taglia'));
 console.log('metrico  80kg/180cm :', JSON.stringify(await run(p,{w:'80',h:'180'})));
 await p.close();

 for(const alt of ["5'11\"", "5.11", "71"]){
   p=await b.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
   await setup(p,EN,mk('en',['46','48','50','52','54'],'Taglia'));
   const r=await run(p,{w:'176',h:alt,imperial:true});
   console.log(('imperiale 176lbs / '+alt).padEnd(26)+':', JSON.stringify(r));
   await p.close();
 }
 // errore fuori scala, deve parlare in pollici
 p=await b.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await setup(p,EN,mk('en',['46','48','50','52','54'],'Taglia'));
 console.log('errore fuori scala        :', JSON.stringify(await run(p,{w:'176',h:'2',imperial:true})));
 await p.close();
 // camicia: collo in pollici
 p=await b.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 await setup(p,EN,mk('en',['37','38','39','40','41','42','43','44','45'],'Taglia'));
 await p.evaluate(()=>{const d=JSON.parse(document.getElementById('bdsf-data').textContent);});
 console.log('camicia 176lbs 5\'11"      :', JSON.stringify(await run(p,{w:'176',h:"5'11\"",imperial:true})));
 await b.close();
})();
