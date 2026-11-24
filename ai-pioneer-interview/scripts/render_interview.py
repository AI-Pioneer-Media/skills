#!/usr/bin/env python3
"""Build the approved interview layout locally. No network or publishing side effects."""
import argparse
import base64
import hashlib
import html
import json
import shutil
from pathlib import Path
from urllib.parse import urlparse


BODY = 'font-size:15px;color:#151515;line-height:2;margin:0 8px 16px;letter-spacing:.3px;'


def esc(value):
    return html.escape(str(value), quote=True)


def web_url(value):
    parsed = urlparse(value)
    if parsed.scheme not in ('http', 'https') or not parsed.netloc or parsed.username:
        raise ValueError('Expected a public http(s) source or recommendation URL')
    return value


def build(input_path, output_path):
    data = json.loads(input_path.read_text(encoding='utf-8-sig'))
    for field in ('title', 'guest', 'cover', 'highlights', 'sections', 'conclusion', 'sources'):
        if not data.get(field):
            raise ValueError('Missing required input: ' + field)
    for source in data['sources']:
        web_url(source['url'])
        if not source.get('rights'):
            raise ValueError('Record the verified reuse conditions for each source')
    if output_path.exists() and any(output_path.iterdir()):
        raise ValueError('Output directory must be empty; use a new version directory')
    # Resolve all files and links before writing any output.
    def local(value):
        path = Path(value)
        path = path if path.is_absolute() else input_path.parent / path
        path = path.resolve()
        if not path.is_file() or path.suffix.lower() not in ('.png', '.jpg', '.jpeg'):
            raise ValueError('Missing local PNG/JPEG: ' + str(path))
        raw = path.read_bytes()
        if not (raw.startswith(b'\x89PNG\r\n\x1a\n') or raw.startswith(b'\xff\xd8\xff')):
            raise ValueError('File does not have a PNG/JPEG signature: ' + str(path))
        return path
    brand = Path(__file__).resolve().parents[2] / 'ai-pioneer-1019' / 'assets'
    header = local(data['header']) if data.get('header') else local(str(brand / 'header-card.jpg'))
    cover = local(data['cover'])
    for item in data.get('opening_images', []):
        local(item['image'])
        if item.get('source_url'):
            web_url(item['source_url'])
    for section in data['sections']:
        if not section.get('title') or not section.get('blocks'):
            raise ValueError('Every section needs a title and its complete blocks')
        for block in section['blocks']:
            if 'image' in block:
                local(block['image'])
                if block.get('source_url'):
                    web_url(block['source_url'])
            elif not isinstance(block.get('text'), str):
                raise ValueError('Every dialogue block needs text')
    for item in data.get('recommendations', []):
        web_url(item['url'])
        local(item['image'])
    if data.get('ending'):
        local(data['ending'])
    if data.get('content_source_url'):
        web_url(data['content_source_url'])

    output_path.mkdir(parents=True, exist_ok=True)
    assets = output_path / 'assets'
    assets.mkdir(exist_ok=True)
    pictures = []
    texts = []
    def remember(text):
        texts.append(text)
        return esc(text).replace('\n', '<br>')
    def image(path, alt='', caption='', source_url='', margin='24px 0 10px'):
        path = local(str(path))
        name = f'{len(pictures):02d}' + path.suffix.lower()
        target = assets / name
        shutil.copyfile(path, target)
        token = f'__INTERVIEW_IMAGE_{len(pictures):03d}__'
        pictures.append({'local_path': 'assets/' + name, 'placeholder': token})
        markup = f'<section style="margin:{margin};line-height:0;"><img src="{token}" alt="{esc(alt)}" style="display:block;width:100%;max-width:100%;height:auto;border:0;"></section>'
        if caption:
            label = esc(caption)
            if source_url:
                label = f'<a href="{esc(web_url(source_url))}" style="color:#888;">{label}</a>'
            markup += '<p style="font-size:12px;color:#888;line-height:1.7;text-align:center;margin:0 8px 24px;">' + label + '</p>'
        return markup
    def figure(item):
        return image(item['image'], item.get('caption', ''), item.get('caption', ''), item.get('source_url', ''))
    def paragraph(text, speaker=''):
        label = ''
        if speaker:
            color = '#D93D28' if speaker == data['guest'] else '#151515'
            label = f'<strong style="font-weight:700;color:{color};">{esc(speaker)}：</strong>'
        return '<p style="' + BODY + '">' + label + remember(text) + '</p>'
    def heading(number, text):
        return (f'<h2 style="font-size:28px;line-height:1.3;letter-spacing:0;font-weight:700;color:#D93D28;margin:36px 0 9px;">{number:02d}</h2>'
                '<h3 style="font-size:18px;line-height:1.5;letter-spacing:0;font-weight:700;color:#151515;margin:0 0 19px;">' + esc(text) + '</h3>')
    parts = [image(header, 'AI PIONEER', margin='0'), image(cover, data['guest'], margin='0 0 24px')]
    parts.append('<p style="font-size:17px;font-weight:700;color:#AB1942;line-height:1.6;margin:0 8px 24px;">HIGHLIGHTS</p><section style="margin:0 8px 26px;padding:18px 14px;background:#F4F4F4;border-radius:8px;">')
    parts.extend(paragraph(text) for text in data['highlights'])
    parts.append('</section>')
    parts.extend(figure(item) for item in data.get('opening_images', []))
    for number, section in enumerate(data['sections'], 1):
        parts.append(heading(number, section['title']))
        parts.extend(figure(block) if 'image' in block else paragraph(block['text'], block.get('speaker', '')) for block in section['blocks'])
    parts.append(heading(len(data['sections']) + 1, '最后'))
    parts.extend(paragraph(text) for text in data['conclusion'])
    if data.get('attribution'):
        parts.append('<p style="font-size:12px;color:#888;line-height:1.7;margin:24px 8px;">' + esc(data['attribution']) + '</p>')
    parts.append('<p style="font-size:11px;color:#D93D28;line-height:1.8;letter-spacing:4px;text-align:center;margin:40px 0 32px;">全文完</p>')
    if data.get('recommendations'):
        parts.append('<p style="margin:0;color:#D93D28;font-size:11px;letter-spacing:2px;line-height:1.6;text-align:center;">CONTINUE READING</p><p style="margin:7px 0 20px;font-size:20px;font-weight:700;line-height:1.6;color:#151515;text-align:center;">往期推荐</p>')
        for item in data['recommendations']:
            parts.append('<a href="' + esc(item['url']) + '">' + image(item['image'], item['title'], margin='0 0 18px') + '</a>')
    if data.get('ending'):
        parts.append(image(data['ending'], '与AI先行者同行', margin='24px 0 0'))
    content = '<section id="wechat-content" style="font-family:-apple-system,BlinkMacSystemFont,\'PingFang SC\',\'Microsoft YaHei\',Arial,sans-serif;font-size:15px;line-height:2;color:#151515;word-break:break-word;background:#fff;">' + '\n'.join(parts) + '</section>'
    (output_path / 'content.html').write_text(content, encoding='utf-8')
    embedded = content
    for item in pictures:
        path = output_path / item['local_path']
        mime = 'image/png' if path.suffix == '.png' else 'image/jpeg'
        embedded = embedded.replace(item['placeholder'], 'data:' + mime + ';base64,' + base64.b64encode(path.read_bytes()).decode('ascii'))
    page = '''<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>__TITLE__</title><style>body{margin:0;background:#eee}.tools,main{max-width:677px;margin:auto}.tools{padding:16px;box-sizing:border-box;background:#151515;color:white;font:14px/1.7 sans-serif}button{padding:9px;margin:4px}main{background:white}img{max-width:100%}</style><section class="tools"><b>__TITLE__</b><p>仅复制下方正文；标题、摘要单独填写。粘贴微信后检查图片。</p><button id="copy">复制公众号正文</button><button id="select">选中正文</button><span id="status"></span></section><main>__CONTENT__</main><script>
const box=document.getElementById('wechat-content');
function selectBody(){const r=document.createRange();r.selectNodeContents(box);const s=getSelection();s.removeAllRanges();s.addRange(r);}
document.getElementById('select').onclick=selectBody;
document.getElementById('copy').onclick=async()=>{try{await navigator.clipboard.write([new ClipboardItem({'text/html':new Blob([box.outerHTML],{type:'text/html'}),'text/plain':new Blob([box.innerText],{type:'text/plain'})})]);document.getElementById('status').textContent='已复制，请粘贴后检查图片';}catch(e){selectBody();document.getElementById('status').textContent='已选中正文，请按 Ctrl+C 或 Cmd+C';}};
</script></html>'''
    page = page.replace('__TITLE__', esc(data['title'])).replace('__CONTENT__', embedded)
    (output_path / '公众号排版-可复制.html').write_text(page, encoding='utf-8')
    manifest = {'title': data['title'], 'author': data.get('author', 'AI Pioneer'), 'digest': data.get('digest', ''),
                'content_html_path': 'content.html', 'cover_path': pictures[1]['local_path'],
                'content_source_url': data.get('content_source_url', ''), 'body_images': pictures}
    (output_path / 'article.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding='utf-8')
    report = {'images': len(pictures), 'interview_sections': len(data['sections']),
              'dialogue_blocks': sum('text' in block for section in data['sections'] for block in section['blocks']),
              'body_font_px': 15, 'line_height': 2, 'letter_spacing_px': .3,
              'content_text_sha256': hashlib.sha256('\n'.join(texts).encode('utf-8')).hexdigest(),
              'source_count': len(data['sources']), 'publicly_published': False,
              'notes': ['本地构建，不代表已完成事实核验、听校、微信图片上传或平台保存。']}
    (output_path / 'build-report.json').write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding='utf-8')
    return report


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('input', type=Path)
    parser.add_argument('output', type=Path)
    args = parser.parse_args()
    print(json.dumps(build(args.input.resolve(), args.output.resolve()), ensure_ascii=False))
