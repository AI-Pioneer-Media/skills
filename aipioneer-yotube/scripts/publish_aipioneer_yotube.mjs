import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { assertReaderReady } from './reader-quality.mjs';

const API = 'https://api.weixin.qq.com/cgi-bin';

function parseArgs(argv) {
  const out = {};
  for (let i = 2; i < argv.length; i += 1) {
    const key = argv[i];
    if (key === '--dry-run') {
      out.dryRun = true;
      continue;
    }
    if (!key.startsWith('--') || i + 1 >= argv.length) {
      throw new Error(`Invalid argument: ${key}`);
    }
    out[key.slice(2)] = argv[++i];
  }
  return out;
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function inlineMarkdown(value) {
  let text = escapeHtml(value);
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, '<a href="$2" style="color:inherit;text-decoration:underline;">$1</a>');
  text = text.replace(/`([^`]+)`/g, '<code style="font-size:14px;color:#111;background:#f2f4f7;padding:2px 5px;border-radius:4px;">$1</code>');
  text = text.replace(/\*\*([^*]+)\*\*/g, '<strong style="color:#111;font-weight:700;">$1</strong>');
  return text;
}

function parseMarkdown(markdown, markdownPath) {
  const lines = markdown.replaceAll('\r\n', '\n').split('\n');
  const titleLine = lines.find((line) => /^#\s+/.test(line.trim()));
  const title = titleLine?.trim().replace(/^#\s+/, '');
  if (!title) throw new Error('Markdown is missing an H1 title');

  const images = [];
  const seen = new Set();
  for (const raw of lines) {
    const match = raw.trim().match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (!match) continue;
    const source = match[2].trim();
    if (/02-business-contact/i.test(source) || seen.has(source)) continue;
    seen.add(source);
    images.push({
      alt: match[1].trim(),
      source,
      filePath: path.resolve(path.dirname(markdownPath), source),
    });
  }

  return { lines, title, images };
}

function renderHtml(article, imageUrls) {
  const out = ['<section style="font-size:16px;color:#2c2c2c;line-height:2;letter-spacing:.025em;word-break:break-word;">'];
  let sectionNumber = 0;
  let contentImageNumber = 0;
  const stats = { blue: 0, green: 0, bold: 0, cards: 0, images: 0 };

  for (const raw of article.lines) {
    const line = raw.trim();
    if (!line || /^#\s+/.test(line)) continue;

    const image = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (image) {
      const source = image[2].trim();
      if (/02-business-contact/i.test(source)) continue;
      const url = imageUrls.get(source);
      if (!url) throw new Error(`Image was not uploaded: ${source}`);

      const isHeader = /01-header-logo|header-logo/i.test(source);
      const isFooter = /03-about-services|04-follow-banner|05-star-guide|about-services|follow-banner|star-guide/i.test(source);
      const isContent = !isHeader && !isFooter;
      const isHero = isContent && contentImageNumber === 0;
      if (isContent) contentImageNumber += 1;

      const margin = isHeader ? '0 8px' : isFooter ? '12px 8px 0' : isHero ? '0 8px 16px' : '24px 8px 10px';
      const radius = isContent && !isHero ? 'border-radius:8px;' : '';
      out.push(`<section style="text-align:center;margin:${margin};"><img src="${escapeHtml(url)}" alt="${escapeHtml(image[1])}" style="display:inline-block;width:100%;max-width:100%;height:auto;${radius}" /></section>`);
      stats.images += 1;
      continue;
    }

    const caption = line.match(/^\*([^*]+)\*$/);
    if (caption) {
      out.push(`<p style="font-size:13px;color:#888;line-height:1.65;text-align:center;margin:0 8px 24px;">${inlineMarkdown(caption[1])}</p>`);
      continue;
    }

    const h2 = line.match(/^##\s+(.+)$/);
    if (h2) {
      sectionNumber += 1;
      out.push(`<section style="margin:42px 8px 20px;"><span style="display:block;font-size:80px;font-weight:700;color:rgba(0,0,0,.08);line-height:1;letter-spacing:-2px;">${String(sectionNumber).padStart(2, '0')}</span><strong style="display:block;font-size:24px;color:#000;line-height:1.3;margin-top:-48px;">${inlineMarkdown(h2[1])}</strong></section>`);
      continue;
    }

    const h3 = line.match(/^###\s+(.+)$/);
    if (h3) {
      out.push(`<p style="font-size:18px;color:#000;font-weight:700;line-height:1.6;margin:28px 8px 12px;padding-left:12px;border-left:4px solid #000;">${inlineMarkdown(h3[1])}</p>`);
      continue;
    }

    const blue = line.match(/^\[BLUE\](.+)\[\/BLUE\]$/i);
    if (blue) {
      out.push(`<p style="font-size:16px;color:#333;line-height:2;margin:0 8px 16px;"><span style="color:#007AAA;font-weight:bold;">${inlineMarkdown(blue[1])}</span></p>`);
      stats.blue += 1;
      continue;
    }

    const green = line.match(/^\[GREEN\](.+)\[\/GREEN\]$/i);
    if (green) {
      out.push(`<p style="font-size:16px;color:#333;line-height:2;margin:0 8px 16px;"><span style="background-color:#73FCD6;font-weight:bold;">${inlineMarkdown(green[1])}</span></p>`);
      stats.green += 1;
      continue;
    }

    const bold = line.match(/^\[BOLD\](.+)\[\/BOLD\]$/i);
    if (bold) {
      out.push(`<p style="font-size:16px;color:#333;line-height:2;margin:0 8px 16px;"><span style="color:#111;font-weight:bold;">${inlineMarkdown(bold[1])}</span></p>`);
      stats.bold += 1;
      continue;
    }

    const quote = line.match(/^>\s+(.+)$/);
    if (quote) {
      out.push(`<p style="font-size:16px;color:#000;font-weight:700;line-height:2;margin:22px 8px;padding:10px 16px;background:rgba(0,0,0,.06);border-radius:8px;">${inlineMarkdown(quote[1])}</p>`);
      stats.cards += 1;
      continue;
    }

    const list = line.match(/^[-*]\s+(.+)$/);
    if (list) {
      out.push(`<p style="font-size:16px;color:#333;line-height:1.9;margin:0 8px 10px;padding-left:18px;"><span style="color:#000;font-weight:700;margin-right:8px;">•</span>${inlineMarkdown(list[1])}</p>`);
      continue;
    }

    const numbered = line.match(/^(\d+)\.\s+(.+)$/);
    if (numbered) {
      out.push(`<p style="font-size:14px;color:#666;line-height:1.75;margin:0 8px 8px;padding-left:4px;"><span style="color:#000;font-weight:700;margin-right:6px;">${numbered[1]}.</span>${inlineMarkdown(numbered[2])}</p>`);
      continue;
    }

    const standaloneStrong = line.match(/^\*\*([^*]+)\*\*$/);
    if (standaloneStrong) {
      out.push(`<p style="font-size:16px;color:#333;line-height:2;margin:0 8px 16px;"><strong style="color:#111;font-weight:700;">${inlineMarkdown(standaloneStrong[1])}</strong></p>`);
      stats.bold += 1;
      continue;
    }

    out.push(`<p style="font-size:16px;color:#333;line-height:2;margin:0 8px 16px;">${inlineMarkdown(line)}</p>`);
  }

  out.push('</section>');
  return { html: out.join(''), stats };
}

function assertRendered(html) {
  const unresolved = [
    /\[(?:BLUE|GREEN|BOLD)\]/i,
    /\[\/(?:BLUE|GREEN|BOLD)\]/i,
    /(?:^|>)\s*&gt;\s*(?:<|$)/i,
    /\*\*[^*]+\*\*/,
  ];
  for (const pattern of unresolved) {
    if (pattern.test(html)) throw new Error(`Unresolved formatting marker: ${pattern}`);
  }
}

async function apiJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`${response.status}: ${text.slice(0, 500)}`);
  }
  if (!response.ok || body.errcode) {
    throw new Error(`${body.errcode ?? response.status}: ${body.errmsg ?? response.statusText}`);
  }
  return body;
}

async function getAccessToken(appId, appSecret) {
  const query = new URLSearchParams({ grant_type: 'client_credential', appid: appId, secret: appSecret });
  const body = await apiJson(`${API}/token?${query}`);
  return body.access_token;
}

function mimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

async function uploadContentImage(accessToken, filePath) {
  const data = await fs.readFile(filePath);
  const form = new FormData();
  form.append('media', new Blob([data], { type: mimeType(filePath) }), path.basename(filePath));
  const result = await apiJson(`${API}/media/uploadimg?access_token=${encodeURIComponent(accessToken)}`, { method: 'POST', body: form });
  if (!result.url) throw new Error(`Content image upload failed: ${filePath}`);
  return result.url;
}

async function uploadCover(accessToken, filePath) {
  const data = await fs.readFile(filePath);
  const form = new FormData();
  form.append('media', new Blob([data], { type: mimeType(filePath) }), path.basename(filePath));
  const result = await apiJson(`${API}/material/add_material?access_token=${encodeURIComponent(accessToken)}&type=thumb`, { method: 'POST', body: form });
  if (!result.media_id) throw new Error(`Cover upload failed: ${filePath}`);
  return result.media_id;
}

const args = parseArgs(process.argv);
for (const key of ['markdown', 'cover', 'title', 'author', 'digest', 'output']) {
  if (!args[key]) throw new Error(`Missing --${key}`);
}

const markdownPath = path.resolve(args.markdown);
const coverPath = path.resolve(args.cover);
const outputPath = path.resolve(args.output);
const markdown = await fs.readFile(markdownPath, 'utf8');
assertReaderReady(markdown);
const article = parseMarkdown(markdown, markdownPath);
await Promise.all([fs.access(coverPath), ...article.images.map((item) => fs.access(item.filePath))]);

if (args.dryRun) {
  const mockUrls = new Map(article.images.map((item) => [item.source, pathToFileURL(item.filePath).href]));
  const rendered = renderHtml(article, mockUrls);
  assertRendered(rendered.html);
  const previewPath = outputPath.replace(/\.json$/i, '.html');
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await fs.writeFile(previewPath, rendered.html, 'utf8');
  const result = {
    ok: true,
    action: 'dry-run',
    title: args.title,
    digestChars: [...args.digest].length,
    htmlChars: rendered.html.length,
    imageCount: article.images.length,
    styles: rendered.stats,
    previewPath,
  };
  await fs.writeFile(outputPath, JSON.stringify(result, null, 2), 'utf8');
  console.log(JSON.stringify(result));
  process.exit(0);
}

const appId = process.env.WECHAT_APPID;
const appSecret = process.env.WECHAT_APPSECRET;
if (!appId || !appSecret) throw new Error('Missing WECHAT_APPID/WECHAT_APPSECRET');

const accessToken = await getAccessToken(appId, appSecret);
const imageUrls = new Map();
for (const item of article.images) {
  imageUrls.set(item.source, await uploadContentImage(accessToken, item.filePath));
}

const rendered = renderHtml(article, imageUrls);
assertRendered(rendered.html);
const thumbMediaId = await uploadCover(accessToken, coverPath);
const created = await apiJson(`${API}/draft/add?access_token=${encodeURIComponent(accessToken)}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({
    articles: [{
      title: args.title,
      author: args.author,
      digest: [...args.digest].slice(0, 120).join(''),
      content: rendered.html,
      thumb_media_id: thumbMediaId,
      show_cover_pic: 0,
      need_open_comment: 1,
      only_fans_can_comment: 0,
    }],
  }),
});

const verified = await apiJson(`${API}/draft/get?access_token=${encodeURIComponent(accessToken)}`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ media_id: created.media_id }),
});
const saved = verified.news_item?.[0] ?? {};
const result = {
  ok: true,
  action: 'publish',
  media_id: created.media_id,
  title: saved.title,
  author: saved.author,
  body_image_count: (saved.content?.match(/<img\b/gi) || []).length,
  images_uploaded: article.images.length,
  has_cover: Boolean(saved.thumb_url || saved.thumb_media_id),
  styles: rendered.stats,
  markdown_path: markdownPath,
  cover_path: coverPath,
};
await fs.mkdir(path.dirname(outputPath), { recursive: true });
await fs.writeFile(outputPath, JSON.stringify(result, null, 2), 'utf8');
console.log(JSON.stringify(result));
