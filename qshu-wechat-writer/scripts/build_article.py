#!/usr/bin/env python3
"""Build a portable article preview from Markdown or an actual Page snapshot.

No network calls, Page writes or publishing. Asset provenance is supplied by
the writer; this script checks actual files and does not verify factual claims.
"""
import argparse
import hashlib
import html
import json
import math
import os
import re
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import quote, unquote, urlsplit

try:
    import markdown
    from PIL import Image
except ImportError as exc:
    raise SystemExit('Missing dependency: ' + exc.name + '. Use scripts/requirements.txt in a task environment.')

KINDS = {'screenshot', 'official-image', 'recorded-animation', 'user-provided', 'diagram', 'generated'}
IMAGE_MD = re.compile(r'!\[(.*?)\]\((.*?)\)', re.S)

def sha(data):
    return hashlib.sha256(data).hexdigest()

def local_path(value, base):
    parsed = urlsplit(value)
    if parsed.scheme and parsed.scheme != 'file':
        raise ValueError('Save the actual image locally first: ' + value)
    if parsed.scheme == 'file' and parsed.netloc:
        raise ValueError('Remote file hosts are unsupported')
    value = unquote(parsed.path if parsed.scheme == 'file' else value)
    path = Path(value)
    return (path if path.is_absolute() else base/path).resolve()

def inspect_asset(record, base):
    path = local_path(record['file'], base)
    if not path.is_file():
        raise ValueError('Missing image: ' + str(path))
    if record.get('kind') not in KINDS or not str(record.get('role', '')).strip():
        raise ValueError('Asset needs a supported kind and a narrative role: ' + path.name)
    source = record.get('source_url')
    if record['kind'] in {'screenshot', 'official-image', 'recorded-animation'}:
        if not source or urlsplit(source).scheme not in {'http', 'https'}:
            raise ValueError('Source URL required: ' + path.name)
    elif not source and not record.get('source_note'):
        raise ValueError('Source note required: ' + path.name)
    with Image.open(path) as im:
        im.verify()
    with Image.open(path) as im:
        info = {'format': im.format, 'width': im.width, 'height': im.height,
                'frames': getattr(im, 'n_frames', 1)}
        durations = []
        for frame in range(info['frames']):
            im.seek(frame)
            durations.append(im.info.get('duration', 0))
        info['duration_ms'] = sum(durations)
    if record['kind'] == 'recorded-animation' and info['frames'] < 2:
        raise ValueError('Recorded animation is a static file: ' + path.name)
    return {**record, 'path': path, 'sha256': sha(path.read_bytes()), 'bytes': path.stat().st_size, **info}

def load_assets(path):
    data = json.loads(path.read_text())
    if data.get('schema_version') != 1 or not isinstance(data.get('images'), list):
        raise ValueError('Asset manifest requires schema_version:1 and images:[]')
    assets = {}
    references = {}
    for record in data['images']:
        asset = inspect_asset(record, path.parent)
        if asset['path'] in assets:
            raise ValueError('Duplicate image record: ' + asset['path'].name)
        assets[asset['path']] = asset
        if record.get('reference'):
            ref = record['reference'].replace('\\:', ':', 1)
            if ref in references: raise ValueError('Duplicate Page image reference')
            references[ref] = asset
    cover = inspect_asset(data['cover'], path.parent) if data.get('cover') else None
    return assets, references, cover

def snapshot_markdown(path, references):
    snapshot = json.loads(path.read_text())
    content = snapshot.get('content')
    if not isinstance(content, dict) or not isinstance(content.get('blocks'), list):
        raise ValueError('Use actual read_page structuredContent with complete content.blocks')
    parts = []
    widths = {}
    for block in content['blocks']:
        if block.get('kind') == 'agent_instructions': continue
        if block.get('kind') != 'markdown': raise ValueError('Unsupported Page block kind')
        text = block['markdown']
        image = IMAGE_MD.fullmatch(text)
        if image:
            reference = image[2].replace('\\:', ':', 1)
            if reference not in references:
                raise ValueError('Page image has no actual local asset mapping')
            asset = references[reference]
            uri = asset['path'].as_uri()
            parts.append('![' + image[1] + '](' + uri + ')')
            width = ((block.get('metadata') or {}).get('image') or {}).get('width')
            if width: widths[asset['path']] = width
        else:
            parts.append(text if text.strip() else '<p><br/></p>')
    return content['title'], '\n\n'.join(parts), widths

class Typesetter(HTMLParser):
    def __init__(self, base, output, assets, widths, font_size):
        super().__init__(convert_charrefs=True)
        self.base = base; self.output = output; self.assets = assets; self.widths = widths
        self.font_size = font_size; self.parts = []; self.used = []; self.text = []
        self.suppressed = None; self.pstart = None; self.p_has_text = False
        self.pstyle = f'font-size:{font_size:g}px;color:#171717;line-height:1.9;letter-spacing:.02em;margin:0 0 17px;overflow-wrap:anywhere;'
        self.allowed = {'p', 'h2', 'h3', 'h4', 'a', 'strong', 'b', 'em', 'i', 'ul', 'ol', 'li',
                        'blockquote', 'pre', 'code', 'br', 'hr', 'table', 'thead', 'tbody', 'tr', 'th', 'td'}

    def handle_starttag(self, tag, attrs):
        if self.suppressed: return
        if tag in {'h1', 'script', 'style', 'iframe'}:
            self.suppressed = tag; return
        a = dict(attrs)
        if tag == 'img':
            path = local_path(a.get('src', ''), self.base)
            if path not in self.assets: raise ValueError('Image has no provenance record: ' + str(path))
            asset = self.assets[path]
            width = float(self.widths.get(path, asset.get('display_width', 572)))
            if not math.isfinite(width) or width <= 0: raise ValueError('Invalid image display width')
            radius = float(asset.get('border_radius', 6))
            if not math.isfinite(radius) or radius < 0: raise ValueError('Invalid image border radius')
            src = quote(os.path.relpath(path, self.output.parent).replace(os.sep, '/'), safe='/')
            if self.pstart is not None and not self.p_has_text:
                self.parts[self.pstart] = '<p style="text-align:center;margin:25px 0 28px;">'
            self.parts.append('<img src="' + html.escape(src, quote=True) + '" alt="'
                              + html.escape(a.get('alt', ''), quote=True) + '" style="display:block;width:100%;max-width:'
                              + f'{width}px;height:auto;margin:0 auto;border-radius:{radius:g}px;"/>')
            self.used.append(asset); return
        if tag not in self.allowed: return
        if tag == 'p':
            self.pstart = len(self.parts); self.p_has_text = False
            self.parts.append('<p style="' + self.pstyle + '">')
        elif tag in {'h2', 'h3', 'h4'}:
            size = 20 if tag == 'h2' else 18
            self.parts.append(f'<{tag} style="font-size:{size}px;color:#171717;line-height:1.5;font-weight:650;margin:30px 0 16px;">')
        elif tag == 'a':
            url = a.get('href', '')
            if urlsplit(url).scheme not in {'', 'https', 'http', 'mailto'}:
                raise ValueError('Unsupported link protocol')
            self.parts.append('<a href="' + html.escape(url, quote=True) + '" style="color:#2d6252;text-decoration:none;border-bottom:1px solid #aac4bb;">')
        elif tag in {'strong', 'b'}:
            self.parts.append(f'<{tag} style="font-weight:650;color:#111;">')
        elif tag in {'ul', 'ol'}:
            self.parts.append(f'<{tag} style="padding-left:22px;margin:0 0 18px;font-size:{self.font_size:g}px;line-height:1.9;">')
        elif tag == 'li': self.parts.append('<li style="margin:0 0 8px;">')
        elif tag == 'blockquote': self.parts.append('<blockquote style="margin:22px 0;padding:0 0 0 14px;border-left:2px solid #d8dfdb;color:#555;">')
        elif tag == 'pre': self.parts.append('<pre style="white-space:pre-wrap;overflow-wrap:anywhere;padding:14px;background:#f4f4f4;border-radius:6px;font-size:13px;line-height:1.7;">')
        elif tag == 'table': self.parts.append('<table style="width:100%;border-collapse:collapse;margin:18px 0;font-size:14px;line-height:1.7;">')
        elif tag in {'td', 'th'}: self.parts.append(f'<{tag} style="border:1px solid #ddd;padding:8px;text-align:left;">')
        elif tag == 'br': self.parts.append('<br/>')
        elif tag == 'hr': self.parts.append('<hr style="border:0;border-top:1px solid #ddd;margin:24px 0;"/>')
        else: self.parts.append('<' + tag + '>')

    def handle_endtag(self, tag):
        if self.suppressed:
            if tag == self.suppressed: self.suppressed = None
            return
        if tag == 'p': self.pstart = None; self.p_has_text = False
        if tag in self.allowed and tag not in {'br', 'hr'}: self.parts.append('</' + tag + '>')

    def handle_data(self, data):
        if self.suppressed: return
        if self.pstart is not None and data.strip(): self.p_has_text = True
        self.parts.append(html.escape(data)); self.text.append(data)

    def result(self):
        return '<section style="font-family:-apple-system,BlinkMacSystemFont,PingFang SC,Microsoft YaHei,sans-serif;">' + ''.join(self.parts) + '</section>'

class Check(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True); self.text = []; self.images = []; self.attrs = []
    def handle_data(self, data): self.text.append(data)
    def handle_starttag(self, tag, attrs):
        if tag == 'img':
            a = dict(attrs); self.images.append(a.get('src', '')); self.attrs.append(a)

def main():
    p = argparse.ArgumentParser(description=__doc__)
    source = p.add_mutually_exclusive_group(required=True)
    source.add_argument('--markdown', type=Path)
    source.add_argument('--snapshot', type=Path)
    p.add_argument('--assets', type=Path, required=True)
    p.add_argument('--output', type=Path, required=True)
    p.add_argument('--wechat-body', type=Path)
    p.add_argument('--report', type=Path)
    p.add_argument('--title')
    p.add_argument('--font-size', type=float, default=15)
    p.add_argument('--allow-no-images', action='store_true')
    args = p.parse_args()
    if not math.isfinite(args.font_size) or args.font_size <= 0: raise ValueError('Invalid font size')
    out = args.output.resolve(); manifest = args.assets.resolve()
    assets, references, cover = load_assets(manifest)
    input_path = (args.markdown or args.snapshot).resolve()
    if args.snapshot:
        title, content, widths = snapshot_markdown(input_path, references)
        base = input_path.parent
    else:
        content = input_path.read_text(); widths = {}; base = input_path.parent
        match = re.search(r'^#\s+(.+)$', content, re.M)
        title = match[1].strip() if match else args.title
    title = args.title or title
    if not title: raise ValueError('Provide a title or a Markdown H1')
    converted = markdown.markdown(content, extensions=['extra', 'sane_lists'])
    parser = Typesetter(base, out, assets, widths, args.font_size); parser.feed(converted); parser.close()
    if not parser.used and not args.allow_no_images: raise ValueError('No actual body images; use --allow-no-images only for a requested text-only article')
    unused = set(assets)-{i['path'] for i in parser.used}
    if unused: raise ValueError('Unused body image records: ' + ', '.join(sorted(p.name for p in unused)))
    body = parser.result(); check = Check(); check.feed(body)
    if re.sub(r'\s+', '', ''.join(check.text)) != re.sub(r'\s+', '', ''.join(parser.text)):
        raise ValueError('Rendering changed body text')
    expected = [i['path'] for i in parser.used]
    actual = [local_path(value, out.parent) for value in check.images]
    if actual != expected: raise ValueError('Rendering changed image order or local paths')
    preview = ('<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'
               + html.escape(title) + '</title></head><body style="margin:0;background:#fff;color:#171717;">'
               + '<article style="max-width:620px;margin:0 auto;padding:32px 22px 48px;">'
               + '<h1 style="font:650 25px/1.5 -apple-system,BlinkMacSystemFont,PingFang SC,sans-serif;margin:0 0 30px;">'
               + html.escape(title) + '</h1>' + body + '</article></body></html>')
    out.parent.mkdir(parents=True, exist_ok=True); out.write_text(preview)
    if args.wechat_body:
        body_path = args.wechat_body.resolve()
        body_path.parent.mkdir(parents=True, exist_ok=True)
        if body_path.parent != out.parent:
            body_parser = Typesetter(base, body_path, assets, widths, args.font_size)
            body_parser.feed(converted); body_parser.close()
            body_path.write_text(body_parser.result())
        else:
            body_path.write_text(body)
    def public(item): return {k: (str(v) if isinstance(v, Path) else v) for k,v in item.items()}
    result = {'title': title, 'input_sha256': sha(input_path.read_bytes()), 'font_size': args.font_size,
              'image_count': len(parser.used), 'gif_count': sum(i['format'] == 'GIF' and i['frames'] > 1 for i in parser.used),
              'blank_count': len(re.findall(r'<p\b[^>]*>\s*<br\s*/?>\s*</p>', body)),
              'body_text_sha256': sha(re.sub(r'\s+', '', ''.join(check.text)).encode()),
              'preview': str(out), 'body_text_and_image_paths_verified': True,
              'images': [public(i) for i in parser.used], 'cover': public(cover) if cover else None,
              'facts_verified_by_script': False, 'visual_preview_checked_by_script': False, 'public_publish': False}
    report = args.report or out.with_name('图文校验.json')
    report.parent.mkdir(parents=True, exist_ok=True); report.write_text(json.dumps(result, ensure_ascii=False, indent=2)+'\n')
    print(json.dumps({k: result[k] for k in ['title', 'image_count', 'gif_count', 'blank_count', 'font_size', 'body_text_and_image_paths_verified']}, ensure_ascii=False))

if __name__ == '__main__':
    try: main()
    except (ValueError, KeyError, OSError) as exc: raise SystemExit(str(exc)) from None
