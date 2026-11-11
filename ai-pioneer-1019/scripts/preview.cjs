const fs=require('node:fs'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('playwright');
(async()=>{
  const [directory, savedHtml]=process.argv.slice(2);if(!directory)throw Error('Usage: node preview.cjs OUTPUT_DIR [READBACK_HTML]');
  const dir=path.resolve(directory), manifest=JSON.parse(fs.readFileSync(path.join(dir,'article.json'),'utf8'));
  let file=path.join(dir,'preview.html'); const prefix=savedHtml?'saved-preview':'preview';
  if(savedHtml){
    let html=fs.readFileSync(path.resolve(savedHtml),'utf8').replace(/<img\b[^>]*>/gi,tag=>{
      const m=tag.match(/\sdata-src\s*=\s*(["'])(.*?)\1/i);if(!m)return tag;
      return tag.replace(/\s(?:src|data-src)\s*=\s*(["']).*?\1/gi,'').replace(/^<img/i,`<img src="${m[2]}"`);
    });
    file=path.join(dir,'saved-preview.html');fs.writeFileSync(file,'<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:14px 20px;background:#FFFFFF}</style>'+html+'</html>');
  }
  const b=await chromium.launch({headless:true,...(process.env.PLAYWRIGHT_CHANNEL?{channel:process.env.PLAYWRIGHT_CHANNEL}:{})});const reports=[];
  try{for(const width of [390,430]){
    const page=await b.newPage({viewport:{width,height:844},deviceScaleFactor:2});
    await page.goto(pathToFileURL(file).href,{waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);
    const r=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,images:[...document.images].map(x=>({alt:x.alt,loaded:x.complete&&x.naturalWidth>0})),links:[...document.querySelectorAll('a')].map(x=>({href:x.href,images:x.querySelectorAll('img').length,text:x.innerText})),hasConclusion:document.body.innerText.includes('写在最后'),hasEnd:document.body.innerText.includes('全文完')}));
    if(manifest.layout?.version==='2026-11-11'){
      r.typography=await page.evaluate(expected=>{
        const root=document.querySelector('body > section');
        if(!root)return {ok:false,error:'Missing article container'};
        const read=el=>{const s=getComputedStyle(el);return {text:el.innerText.slice(0,80),font:s.fontSize,line:s.lineHeight,spacing:s.letterSpacing,color:s.color,weight:s.fontWeight,paddingLeft:s.paddingLeft,paddingRight:s.paddingRight};};
        const container=read(root), paragraphs=[...root.querySelectorAll('p')].filter(x=>x.textContent.trim()&&getComputedStyle(x).fontSize==='15px').map(read);
        const headline=[...root.children].find(x=>x.tagName==='P'&&x.textContent.trim());
        const numbers=[...root.querySelectorAll('h2')].filter(x=>/^\d{2,}$/.test(x.textContent.trim())).map(read);
        const headings=[...root.querySelectorAll('h3')].map(read);
        const ok=container.font==='15px'&&container.line==='26.25px'&&container.spacing==='1.5px'&&container.paddingLeft==='16px'&&container.paddingRight==='16px'
          &&!!headline&&getComputedStyle(headline).fontSize==='29px'
          &&paragraphs.length>0&&paragraphs.every(x=>x.line==='26.25px'&&x.spacing==='1.5px'&&x.paddingLeft==='0px'&&x.paddingRight==='0px')
          &&numbers.length===expected&&numbers.every((x,i)=>x.text===String(i+1).padStart(2,'0')&&x.font==='28px'&&x.line==='36.4px'&&x.spacing==='normal'&&x.color==='rgb(217, 61, 40)'&&x.weight==='700')
          &&headings.length===expected&&headings.every(x=>x.font==='18px'&&x.line==='27px'&&x.spacing==='normal'&&x.color==='rgb(217, 61, 40)'&&x.weight==='700');
        return {container,headline:headline?read(headline):null,paragraphs,numbers,headings,ok};
      },manifest.layout.section_count);
    }
    await page.screenshot({path:path.join(dir,`${prefix}-${width}.png`),fullPage:true});
    await page.screenshot({path:path.join(dir,`${prefix}-${width}-top.png`)});
    if(manifest.layout?.version==='2026-11-11'){await page.locator('h2').first().scrollIntoViewIfNeeded();await page.screenshot({path:path.join(dir,`${prefix}-${width}-body.png`)});}
    await page.getByText('往期推荐',{exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:path.join(dir,`${prefix}-${width}-ending.png`)});
    const expected=manifest.body_images.filter(x=>/^__REC\d+__$/.test(x.placeholder)).length;
    r.ok=r.width===r.scrollWidth&&r.images.length===manifest.body_images.length&&r.images.every(x=>x.loaded)&&r.links.length===expected&&r.links.every(x=>x.images===1&&new URL(x.href).hostname==='mp.weixin.qq.com')&&r.hasConclusion&&r.hasEnd&&(!r.typography||r.typography.ok);
    reports.push(r);await page.close();
  }}finally{await b.close();}
  fs.writeFileSync(path.join(dir,`${prefix}-checks.json`),JSON.stringify(reports,null,2));console.log(JSON.stringify(reports));if(reports.some(x=>!x.ok))process.exitCode=2;
})().catch(e=>{console.error(e.message);process.exitCode=1;});
