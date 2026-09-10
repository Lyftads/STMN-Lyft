const { chromium } = require('playwright-core');
const fs=require('fs');
const OUT='/private/tmp/claude-501/-Users-marino/528f078e-f6e7-4138-8906-5adb44be4fc8/scratchpad';
const TPL=fs.readFileSync(OUT+'/widget_tpl.html','utf8');
(async()=>{
 const b=await chromium.launch({channel:'chrome'}).catch(()=>chromium.launch());
 for(const [w,h,nome] of [[1400,1000,'desktop'],[390,844,'mobile']]){
  const p=await b.newPage({viewport:{width:w,height:h},isMobile:w<500,hasTouch:w<500,deviceScaleFactor:2});
  await p.goto('https://bottegadalmut.com/products/pantaloni-belted-o-transition-brown-house-in-lino',{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(4000);
  const img=await p.evaluate(()=>{
    const im=[...document.querySelectorAll('img')].find(i=>/cdn\/shop\/(files|products)/.test(i.currentSrc||i.src||''));
    const u=(im&&(im.currentSrc||im.src))||'';
    return u.replace(/([?&])width=\d+/,'$1width=220');
  });
  const PAY={productId:1,title:'Pantaloni Belted O Transition Brown House in Lino',handle:'pantaloni-belted',type:'',tags:[],
    optionName:'Taglia',optionPosition:1,values:['46','48','50','52','54'].map(l=>({label:l,available:true})),collections:[],locale:'it',
    image:img, image2x:img.replace('width=220','width=440'), imageAlt:'Pantaloni'};
  await p.evaluate(html=>{
    const list=document.querySelector('.product-info__block-list');
    const sg=[...list.children].find(el=>/size guide/i.test(el.innerText||''))||list.children[3];
    const d=document.createElement('div'); d.innerHTML=html;
    const sc=[...d.querySelectorAll('script')]; sc.forEach(s=>s.remove()); sg.after(d);
    sc.forEach(s=>{const n=document.createElement('script'); if(s.type){n.type=s.type;n.id=s.id;} n.textContent=s.textContent; document.body.appendChild(n);});
  }, TPL.replace('__PAYLOAD__', JSON.stringify(PAY)));
  await p.waitForTimeout(500);
  await p.evaluate(()=>document.getElementById('bdsf-trigger').click());
  await p.waitForTimeout(1800);
  const r=await p.evaluate(()=>{
    const e=document.getElementById('bdsf-prod');
    if(!e) return {errore:'contenitore assente'};
    const i=e.querySelector('img'), k=e.querySelector('.bdsf-prod-kicker'), n=e.querySelector('.bdsf-prod-name');
    const primoCampo=document.getElementById('bdsf-w').getBoundingClientRect();
    return {classe:e.className, kicker:k&&k.textContent, nome:n&&n.textContent,
            imgOk:i?i.naturalWidth>0:null, box:i?[i.clientWidth,i.clientHeight]:null,
            src:i?i.currentSrc.slice(-60):null,
            campoVisibile: primoCampo.bottom<=window.innerHeight};
  });
  console.log(nome+': '+JSON.stringify(r));
  await p.screenshot({path:`${OUT}/img_${nome}.png`});
  await p.close();
 }
 await b.close();
})();
