// Node 20+, Playwright and sharp. All article input is plain text, never executable HTML.
const fs = require('node:fs');
const path = require('node:path');
const {pathToFileURL} = require('node:url');
const {chromium} = require('playwright');
const sharp = require('sharp');
const assets = path.resolve(__dirname, '../assets');
const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const red = '#D93D28', ink = '#151515';
const textStyle = `margin:0;font-size:16px;line-height:1.95;letter-spacing:0.3px;color:${ink};`;
const p = (s, css='') => `<p style="${textStyle}${css}">${esc(s).replace(/\n/g,'<br />')}</p>`;
const image = (src, alt) => `<img src="${esc(src)}" alt="${esc(alt)}" style="display:block;width:100%;height:auto;vertical-align:middle;" />`;
const wrap = html => `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;padding:14px 20px;background:#FFFFFF}</style>${html}</html>`;
function required(v,label) { if(typeof v !== 'string' || !v.trim()) throw Error(`Missing ${label}`); }
function paragraphs(v,label) { if(!Array.isArray(v)||!v.length) throw Error(`Missing ${label}`); v.forEach(x=>required(x,label)); }
function validate(data) {
  for(const k of ['title','headline','digest','hero_path']) required(data[k],k);
  required(data.person?.name,'person.name'); required(data.person?.role,'person.role');
  paragraphs(data.intro,'intro'); paragraphs(data.conclusion,'conclusion');
  if(!Array.isArray(data.sections)||!data.sections.length) throw Error('Missing sections');
  for(const s of data.sections) { required(s.title,'section.title'); paragraphs(s.paragraphs,'section.paragraphs'); if(s.quote) {required(s.quote.text,'quote.text');required(s.quote.attribution,'quote.attribution (use 编辑提炼 for editorial opinion)');} }
  if(!Array.isArray(data.recommendations)||data.recommendations.length<2||data.recommendations.length>3) throw Error('Supply 2–3 real previous articles');
  for(const r of data.recommendations) {
    required(r.title,'recommendation.title'); required(r.cover_path,'recommendation.cover_path');
    const u=new URL(r.url); if(u.protocol!=='https:'||u.hostname!=='mp.weixin.qq.com'||u.username||u.password||!/^\/s(?:\/|$)/.test(u.pathname)) throw Error('Recommendation must link to a real WeChat article');
    if(r.published_at && (!/^\d{4}-\d{2}-\d{2}$/.test(r.published_at)||new Date(r.published_at).toISOString().slice(0,10)!==r.published_at)) throw Error('Invalid publication date');
  }
}
async function main() {
  const [input, output]=process.argv.slice(2); if(!input||!output) throw Error('Usage: node build.cjs INPUT.json OUTPUT_DIR');
  const base=path.dirname(path.resolve(input)), out=path.resolve(output);
  const data=JSON.parse(fs.readFileSync(input,'utf8').replace(/^\uFEFF/,'')); validate(data);
  if(fs.existsSync(out)&&fs.readdirSync(out).length) throw Error('Use a fresh output directory; existing work is not overwritten');
  const local=f=>{const v=path.resolve(base,f);if(!fs.statSync(v).isFile())throw Error('Missing image: '+f);return v;};
  const hero=local(data.hero_path); data.recommendations.forEach(r=>local(r.cover_path));
  const hm=await sharp(hero).metadata();if(Math.abs(hm.width/hm.height-2.34)>.12)throw Error('Hero must be approximately 2.34:1; adapt the cover first');
  fs.mkdirSync(out,{recursive:true});
  for(const f of ['header-card.jpg','ending-card.jpg'])fs.copyFileSync(path.join(assets,f),path.join(out,f));
  // Encoding only: keep the approved cover composition and dimensions.
  await sharp(hero).rotate().jpeg({quality:94}).toFile(path.join(out,'hero.jpg'));
  const bodyImages=[{local_path:'header-card.jpg',placeholder:'__HEADER__'},{local_path:'hero.jpg',placeholder:'__HERO__'}];
  const browser=await chromium.launch({headless:true});
  try {
    const page=await browser.newPage({viewport:{width:1050,height:1000},deviceScaleFactor:1});
    for(const [i,r] of data.recommendations.entries()) {
      const stem=`recommendation-${i+1}`, date=r.published_at ? r.published_at.slice(5).replace('-',' 月 ')+' 日' : '';
      const sourceName=`source-cover-${i+1}${path.extname(r.cover_path).toLowerCase()}`;
      fs.copyFileSync(local(r.cover_path),path.join(out,sourceName));
      const html=`<!doctype html><html lang="zh-CN"><meta charset="utf-8"><style>*{box-sizing:border-box}body{margin:0;background:#FFFFFF;font-family:Arial,"Microsoft YaHei",sans-serif}</style><article style="width:1050px;background:${red};border-radius:16px;overflow:hidden;"><img src="${esc(sourceName)}" alt="${esc(r.title)}" style="display:block;width:1050px;height:448px;object-fit:cover;object-position:${esc(r.cover_position||'center')};"><div style="padding:22px 30px 28px;color:#FFFFFF;">${date?`<div style="font-size:26px;line-height:1.5;letter-spacing:3px;margin-bottom:10px;">${date}</div>`:''}<div style="font-size:40px;font-weight:700;line-height:1.5;">${esc(r.title)}</div><div style="font-size:26px;line-height:1.5;margin-top:15px;">点击阅读 ↗</div></div></article></html>`;
      fs.writeFileSync(path.join(out,stem+'.html'),html);
      await page.goto(pathToFileURL(path.join(out,stem+'.html')).href,{waitUntil:'load'});await page.evaluate(()=>document.fonts.ready);
      if(!await page.locator('img').evaluate(x=>x.complete&&x.naturalWidth>0))throw Error('Recommendation cover failed to load');
      const bytes=await page.locator('article').screenshot({type:'png'});
      await sharp(bytes).jpeg({quality:94}).toFile(path.join(out,stem+'.jpg'));
      bodyImages.push({local_path:stem+'.jpg',placeholder:`__REC${i+1}__`});
    }
  } finally {await browser.close();}
  bodyImages.push({local_path:'ending-card.jpg',placeholder:'__ENDING__'});
  let html=`<section style="max-width:677px;margin:0 auto;background:#FFFFFF;color:${ink};font-family:Arial,'PingFang SC','Microsoft YaHei',sans-serif;word-wrap:break-word;">`;
  html+=`<section style="margin:0 0 10px;line-height:0;">${image('__HEADER__','AI PIONEER · 记录 AI 先行者的思考与行动')}</section>`;
  html+=`<p style="margin:0;line-height:0;">${image('__HERO__',data.person.name+' · '+data.person.role)}</p>`;
  // Identity and role are already present in the hero. Start the article with its headline.
  html+=p(data.headline,'font-family:SimSun,"Songti SC",serif;font-size:29px;font-weight:700;line-height:1.4;letter-spacing:0;margin:26px 0 24px;');
  html+=`<section style="margin:0 0 36px;">${data.intro.map((t,i)=>p(t,i?'margin-top:16px;':'')).join('')}</section>`;
  data.sections.forEach((s,i)=>{
    html+=`<section style="margin:${i?36:0}px 0 15px;"><p style="margin:0 0 8px;color:${red};font-size:11px;font-weight:700;letter-spacing:1px;line-height:1.4;">${String(i+1).padStart(2,'0')}</p>${p(s.title,'font-size:20px;line-height:1.5;font-weight:700;letter-spacing:0;')}</section>`;
    html+=s.paragraphs.map((t,j)=>p(t,j?'margin-top:16px;':'')).join('');
    if(s.quote)html+=`<section style="margin:34px 0 4px;padding:0 9px;"><p style="margin:0 0 6px;font-family:Georgia,serif;font-size:48px;line-height:0.9;color:${red};">“</p>${p(s.quote.text,'font-family:SimSun,"Songti SC",serif;font-size:22px;font-weight:700;line-height:1.7;')}${p(s.quote.attribution,'font-size:12px;line-height:1.7;margin-top:12px;')}</section>`;
  });
  html+=`<section style="margin:40px 0 0;">${p('写在最后','font-size:20px;line-height:1.5;font-weight:700;margin:0 0 16px;')}${data.conclusion.map((t,i)=>p(t,i?'margin-top:16px;':'')).join('')}</section>`;
  html+=`<section style="margin:40px 0 48px;text-align:center;"><p style="margin:0;color:${red};font-size:11px;letter-spacing:4px;line-height:1.8;">全文完</p></section><section style="margin:0 0 24px;text-align:center;"><p style="margin:0;color:${red};font-size:11px;letter-spacing:2px;line-height:1.6;">CONTINUE READING</p><p style="margin:7px 0 0;font-size:20px;font-weight:700;line-height:1.6;color:${ink};">往期推荐</p></section>`;
  data.recommendations.forEach((r,i)=>{html+=`<section style="margin:0 0 18px;line-height:0;"><a href="${esc(r.url)}" style="display:block;font-size:0;line-height:0;text-decoration:none;">${image(`__REC${i+1}__`,r.title)}</a></section>`;});
  html+=`<section style="margin:38px 0 20px;line-height:0;">${image('__ENDING__','AI PIONEER · 与AI先行者同行。人物与思想，工具与实践。')}</section></section>`;
  fs.writeFileSync(path.join(out,'content.html'),html);
  let preview=html; for(const im of bodyImages)preview=preview.replaceAll(im.placeholder,im.local_path);
  fs.writeFileSync(path.join(out,'preview.html'),wrap(preview));
  const manifest={title:data.title,author:'AI Pioneer',digest:data.digest,content_html_path:'content.html',cover_path:'hero.jpg',content_source_url:data.content_source_url||'',body_images:bodyImages};
  fs.writeFileSync(path.join(out,'article.json'),JSON.stringify(manifest,null,2));
  const limits={title:[...data.title].length<=32,digest:[...data.digest].length<=120,html:html.length<20000,images:bodyImages.every(i=>fs.statSync(path.join(out,i.local_path)).size<1024*1024)};
  fs.writeFileSync(path.join(out,'build-check.json'),JSON.stringify({limits,recommendations:data.recommendations.length,hero_dimensions:[hm.width,hm.height]},null,2));
  console.log(JSON.stringify({output:out,limits}));if(Object.values(limits).some(v=>!v))throw Error('Preview generated but draft limits failed; inspect build-check.json and adjust without silently truncating content');
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
