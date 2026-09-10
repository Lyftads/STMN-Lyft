const { chromium } = require('playwright-core');
const OUT='/private/tmp/claude-501/-Users-marino/528f078e-f6e7-4138-8906-5adb44be4fc8/scratchpad';
(async()=>{
 const b=await chromium.launch({channel:'chrome'}).catch(()=>chromium.launch());
 const p=await b.newPage({viewport:{width:1400,height:1000}});
 await p.goto('https://bottegadalmut.com/products/pantaloni-belted-o-transition-brown-house-in-lino',{waitUntil:'networkidle',timeout:60000});
 await p.waitForTimeout(3000);
 const blocks=await p.evaluate(()=>{
   const l=document.querySelector('.product-info__block-list'); if(!l) return null;
   return [...l.children].map((el,i)=>({
     i, tipo:el.getAttribute('data-block-type'), id:(el.getAttribute('data-block-id')||'').slice(0,24),
     testo:(el.innerText||'').replace(/\s+/g,' ').trim().slice(0,52)
   }));
 });
 console.log('ORDINE BLOCCHI nella colonna prodotto:');
 blocks.forEach(b=>console.log(`  [${b.i}] ${String(b.tipo).padEnd(10)} ${b.testo}`));
 const sg=p.locator('text=Size Guide').first();
 await sg.scrollIntoViewIfNeeded();
 const box=await sg.boundingBox();
 const st=await sg.evaluate(el=>{const c=getComputedStyle(el);const pa=el.parentElement;
   return {tag:el.tagName,cls:el.className,font:c.fontSize,peso:c.fontWeight,transform:c.textTransform,
           deco:c.textDecorationLine,colore:c.color,spaziatura:c.letterSpacing,padre:pa.className};});
 console.log('\nSTILE del "Size Guide" attuale:', JSON.stringify(st,null,1));
 await p.screenshot({path:OUT+'/sizeguide_area.png', clip:{x:box.x-330,y:box.y-160,width:520,height:420}});
 await b.close();
})();
