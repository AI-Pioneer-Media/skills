# 输入、生成与预览

## 运行准备

需要 Node.js 20+、Playwright、Chromium 和 sharp。在技能目录执行：

```bash
npm install
npx playwright install chromium
```

如果 Codex 已提供依赖运行时，可直接使用其 Node，并用 `NODE_PATH` 指向该运行时的 `node_modules`；不要把本机缓存绝对路径写入共享模板。默认中文字体依赖系统，Windows 的 Microsoft YaHei 与 SimSun 最接近定稿；其他系统安装可用中文字体后检查截图。不要未经许可随仓库分发字体文件。

已安装 Chrome 而未安装 Playwright Chromium 时，可将环境变量 `PLAYWRIGHT_CHANNEL` 设置为 `chrome`；构建与预览脚本均支持，默认仍使用 Playwright Chromium。

## 输入 JSON

在本期工作目录创建 `input.json`。所有素材路径相对于该 JSON。以下为结构示意，姓名、职务、链接、封面必须换成当期核实的真实内容，示例不是可直接上传的文章。

```json
{
  "title": "本期微信标题",
  "headline": "正文主标题第一行\n第二行",
  "digest": "本期摘要。",
  "person": {"name": "人物姓名", "role": "已核实的当前职务"},
  "hero_path": "hero.jpg",
  "intro": ["完整导语。"],
  "sections": [
    {
      "title": "第一节标题",
      "paragraphs": ["第一段完整正文。", "第二段完整正文。"],
      "quote": {"text": "可选的观点提炼。", "attribution": "编辑提炼"}
    },
    {"title": "第二节标题", "paragraphs": ["第二节完整正文。"]}
  ],
  "conclusion": ["文章自身的结语。", "结语的第二段。"],
  "recommendations": [
    {"title": "真实往期标题一", "url": "https://mp.weixin.qq.com/s/替换为真实文章", "cover_path": "previous-cover-1.jpg", "published_at": "2026-10-11"},
    {"title": "真实往期标题二", "url": "https://mp.weixin.qq.com/s/替换为真实文章", "cover_path": "previous-cover-2.jpg"}
  ]
}
```

- `sections` 按文章实际数量填写，正文保留完整。`quote` 可省略；引用标注真实来源，编辑提炼明确写 `编辑提炼`。
- `sections[].title` 只填标题文字，不带序号。构建器自动输出独占一行的 `01 / 02 / …`（28px 朱红），下一行输出标题（18px 朱红）。演讲整理采用「人物姓名：发言主题」，其他文章按自身内容命名；不要把此模式强加给所有选题。
- `recommendations` 2–3 条，日期未知则省略。封面从对应公开文章的原始封面/可信资产获取，不能拿正文任意配图代替。`cover_position` 可选 CSS object-position 值，如 `center top`，用于保护原封面重要区域。
- `content_source_url` 默认空，仅用户确需微信“阅读原文”时填写真实链接。不给文末自动添加参考资料组件。
- 输入文字会 HTML 转义，不接受用 HTML 字符串代替正文。换行用 JSON 的 `\n`。
- 自定义正文图片或特殊内容可在构建后的 `content.html` 添加行内样式组件，并给 `article.json.body_images` 增加本地路径与唯一占位符。同步更新 `preview.html`，重新检查；不要外链未经上传的正文图片。标准样例是 5 张图（banner、首图、2 张推荐、结尾），不是限制文章只能有 5 张图。

正文采用 15px / 1.75、字距 1.5px，段间距 12px；最外层正文容器只设置一次左右 16px 内缩进。已有稿件只改样式时，可直接在最新 HTML 上应用 [视觉规范](design.md)，无需重新组织为人物文章的 JSON。

新增正文图片与图注可用下面的组件，放在相关段落之后。图注是独立段落，不能继承标题加粗、朱红或正文的 1.5px 字距；图片保留比例，图注统一居中：

```html
<p style="margin:20px 0 6px;line-height:0;"><img src="__BODY_IMAGE_1__" alt="图片实际内容" style="display:block;width:100%;height:auto;" /></p>
<p style="margin:6px 0 18px;font-size:12px;line-height:1.6;letter-spacing:0;text-align:center;font-weight:400;color:rgba(21,21,21,0.6);">真实图片说明与必要的来源</p>
```

## 构建与检查

```bash
node scripts/build.cjs /work/issue/input.json /work/issue/render-v1
node scripts/preview.cjs /work/issue/render-v1
```

输出目录必须不存在或为空，防止覆盖上一版和上传回执。输出包括：

- `content.html`：微信行内样式正文，待替换图片占位符。
- `article.json`：可直接交给草稿脚本的上传清单，使用相对路径。
- 清单中的 `layout` 保存排版版本与章节数，供手机检查使用，不发送给微信。手动增减章节时同步 `layout.section_count`。
- `hero.jpg`、`header-card.jpg`、`ending-card.jpg`、`recommendation-N.jpg`。
- `recommendation-N.html` 及真实原封面副本：便于检查/调整推荐卡片。
- `preview.html`、390/430px 的长图、首屏与尾屏截图、检查结果 JSON。

构建检查采用已验证工作流的保守上传边界：标题最多 32 字，摘要 120 字，图片每张小于 1MB，HTML 少于 20000 字符。超出时脚本保留预览并报错；不要通过默默删正文来通过检查。优化重复样式或有意识地调整内容，必要时核实当时微信接口边界。固定素材保持原样，图像转 JPEG 是编码，不改变设计。

## 人工视觉检查

打开截图检查：第一眼能识别人物；姓名与职务在手机上可读；banner 品牌和 slogan 对齐；首图左侧朱红与 banner 左边齐平、图内无白边；首图后没有重复人名或职务行；序号独占一行，章节标题紧随其后，正文没有误套标题样式；图注居中，图片前后无连续空段落；正文无横向滚动；往期封面裁切不损坏标题；每张推荐都有真实跳转；文末有完整结语和品牌卡片。脚本检查结构、图片加载、溢出，以及新版生成稿的实际计算字号、行高、字距、缩进和标题层级，并额外输出正文截图；不能代替审美与事实检查。微信读回样式若被平台改写，先检查实际效果与返回 HTML，再修复，不能只凭本地通过就宣称平台效果一致。

修改固定 banner/结尾源 HTML 后需重新用 Chromium 渲染为对应尺寸 JPG，并查看实际图片；不能只改源文件却仍发旧 JPG。用户未要求修改固定品牌组件时直接复用。
