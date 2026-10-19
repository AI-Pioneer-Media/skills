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
  const b=await chromium.launch({headless:true});const reports=[];
  try{for(const width of [390,430]){
    const page=await b.newPage({viewport:{width,height:844},deviceScaleFactor:2});
    await page.goto(pathToFileURL(file).href,{waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);
    const r=await page.evaluate(()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,images:[...document.images].map(x=>({alt:x.alt,loaded:x.complete&&x.naturalWidth>0})),links:[...document.querySelectorAll('a')].map(x=>({href:x.href,images:x.querySelectorAll('img').length,text:x.innerText})),hasConclusion:document.body.innerText.includes('写在最后'),hasEnd:document.body.innerText.includes('全文完')}));
    await page.screenshot({path:path.join(dir,`${prefix}-${width}.png`),fullPage:true});
    await page.screenshot({path:path.join(dir,`${prefix}-${width}-top.png`)});
    await page.getByText('往期推荐',{exact:true}).scrollIntoViewIfNeeded();await page.screenshot({path:path.join(dir,`${prefix}-${width}-ending.png`)});
    const expected=manifest.body_images.filter(x=>/^__REC\d+__$/.test(x.placeholder)).length;
    r.ok=r.width===r.scrollWidth&&r.images.length===manifest.body_images.length&&r.images.every(x=>x.loaded)&&r.links.length===expected&&r.links.every(x=>x.images===1&&new URL(x.href).hostname==='mp.weixin.qq.com')&&r.hasConclusion&&r.hasEnd;
    reports.push(r);await page.close();
  }}finally{await b.close();}
  fs.writeFileSync(path.join(dir,`${prefix}-checks.json`),JSON.stringify(reports,null,2));console.log(JSON.stringify(reports));if(reports.some(x=>!x.ok))process.exitCode=2;
})().catch(e=>{console.error(e.message);process.exitCode=1;});
