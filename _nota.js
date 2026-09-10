const { chromium } = require('playwright-core');
const fs=require('fs');
const OUT='/private/tmp/claude-501/-Users-marino/528f078e-f6e7-4138-8906-5adb44be4fc8/scratchpad';
function tpl(){ // rigenera il template dal liquid corrente
  const src=fs.readFileSync('/Users/marino/bottegadalmut-size-finder/trova-la-tua-taglia.liquid','utf8');
  let s=src.replace(/\{%-?\s*comment[\s\S]*?endcomment\s*-?%\}/g,'')
           .replace(/\{%-?\s*liquid[\s\S]*?-?%\}/,'')
           .replace(/\{%-?\s*capture bdsf_payload[\s\S]*?endcapture\s*-?%\}/,'')
           .replace(/\{%-?\s*if size_option[\s\S]*?-?%\}/,'')
           .replace(/\{%-?\s*endif\s*-?%\}/g,'');
  return s.replace('{{ bdsf_payload }}','__PAYLOAD__');
}
const T=tpl();
async function prova(b,url,pay,etichetta){
  const p=await b.newPage({viewport:{width:1400,height:1000}});
  p.on('pageerror',e=>console.log('PAGEERROR:',String(e).slice(0,160)));
  await p.goto(url,{waitUntil:'domcontentloaded',timeout:60000});
  await p.waitForTimeout(3500);
  // via la copia gia pubblicata, per non avere duplicati
  await p.evaluate(()=>{
    document.querySelectorAll('.bdsf-wrap,#bdsf-drawer,#bdsf-overlay,#bdsf-data,.bdsf-sizenote').forEach(e=>e.remove());
  });
  await p.evaluate(html=>{
    const list=document.querySelector('.product-info__block-list');
    const sg=[...list.children].find(el=>/size guide/i.test(el.innerText||''))||list.children[3];
    const d=document.createElement('div'); d.innerHTML=html;
    const sc=[...d.querySelectorAll('script')]; sc.forEach(s=>s.remove()); sg.after(d);
    sc.forEach(s=>{const n=document.createElement('script'); if(s.type){n.type=s.type;n.id=s.id;} n.textContent=s.textContent; document.body.appendChild(n);});
  }, T.replace('__PAYLOAD__', JSON.stringify(pay)));
  await p.waitForTimeout(600);
  const r1=await p.evaluate(()=>{
    const n=document.querySelector('.bdsf-sizenote');
    const vp=document.querySelector('.product-info [data-block-type="variant-picker"]');
    return {nota:n?n.textContent:null, dentroIlSelettore: n?vp.contains(n):null, quante:document.querySelectorAll('.bdsf-sizenote').length};
  });
  // cambio taglia: il tema rigenera il blocco?
  await p.evaluate(()=>{const l=[...document.querySelectorAll('.product-info label.block-swatch')][2]; if(l) l.click();});
  await p.waitForTimeout(2500);
  const r2=await p.evaluate(()=>{
    const d=document.getElementById('bdsf-drawer');
    const out={nota:!!document.querySelector('.bdsf-sizenote'), quante:document.querySelectorAll('.bdsf-sizenote').length,
               testoNota:(document.querySelector('.bdsf-sizenote')||{}).textContent};
    document.getElementById('bdsf-trigger').click();
    out.linkFunziona=!d.hidden;
    return out;});
  console.log(etichetta.padEnd(22)+':', JSON.stringify(r1));
  console.log(' '.repeat(22)+'  dopo cambio taglia ->', JSON.stringify(r2));
  await p.close();
}
const mk=(t,v,loc)=>({productId:1,title:t,handle:'p',type:'',tags:[],optionName:'Taglia',optionPosition:1,
  values:v.map(l=>({label:l,available:true,variantId:null})),collections:[],locale:loc,routeRoot:loc==='en'?'/en':'/'});
(async()=>{
 const b=await chromium.launch({channel:'chrome'}).catch(()=>chromium.launch());
 const PANT='products/pantaloni-belted-o-transition-brown-house-in-lino';
 const CAM='products/camicia-in-lino-classic-fit-bianca';
 await prova(b,'https://bottegadalmut.com/'+PANT, mk('Pantaloni Belted',['46','48','50','52','54'],'it'),'PANTALONI IT');
 await prova(b,'https://bottegadalmut.com/en/'+PANT, mk('Pantaloni Belted',['46','48','50','52','54'],'en'),'PANTALONI EN');
 await prova(b,'https://bottegadalmut.com/'+CAM, mk('Camicia in lino',['37','38','39','40','41','42','43','44','45','46','47'],'it'),'CAMICIA IT');
 await prova(b,'https://bottegadalmut.com/en/'+CAM, mk('Camicia in lino',['37','38','39','40','41','42','43','44','45','46','47'],'en'),'CAMICIA EN');
 await b.close();
})();
