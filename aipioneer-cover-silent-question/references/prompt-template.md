# 静默一问：提示词与案例

## 可复用模板

将花括号替换为本次真实输入，删除不适用的可选行。模板变量不是要印在图片上的文字。案例图片为视觉参考，不是文字来源。

```text
Use case: identity-preserve for editing an existing F cover; ads-marketing for a new cover
Asset type: one finished flat AI PIONEER editorial cover, landscape approximately 2.35:1, not a device or social-media UI mockup.
Topic: {本篇文章实际讨论的问题}
Input images: identify each image by role. Current subject photo = identity reference; bundled example = style reference only. Preserve the CURRENT subject's recognizable face and natural expression, not the example person's identity.
Art direction: Quiet monochrome portrait plus ONE short editorial question. Seamless white background, full-head black-and-white portrait on rightmost 35–40%, natural texture and generous top margin. Add exactly one single-line Chinese question at x=10%, around y=43–50%, near-black #1D1D1F refined medium-weight sans serif, occupying 30–38% of width. Tiny gray AI PIONEER and optional smaller subject name at lower-left. Keep vast uninterrupted whitespace. No subheadline, icons, lines, texture, frames, accent colors or extra words. The question is editorial copy, not a quotation.
Text whitelist (verbatim, nothing else):
{逐行列出本图必须出现的精确文字；不要填未核实的信息}

For an existing F edit target: add only the specified question; preserve the portrait, pose, size, position, background and existing signature as closely as possible.
Constraints: follow the specified composition. Do not invent quotations, endorsements or numerical evidence. No source-platform logos, watermark or unrequested copy. Preserve the original if editing; deliver a new version.
```

## 随包案例

![H 静默一问](../assets/example.png)

- 制作日期：2026-09-14；由内置图像生成工具制作。
- 选题：给 AI 打分的人——满分越来越多，榜单还剩多少参考价值？
- 本例人物为 Rayan Krishnan。身份素材取自 [a16z 访谈视频约 23:19](https://www.youtube.com/watch?v=WO9c9qxDxzU&t=1399s)，仅用于本次封面设计演绎。原始视频截图未随包分发。
- 主句：“高分，就够了吗？”（/ 表示换行，不印出）
- 常用文字白名单：AI PIONEER；高分，就够了吗？；经核验的人名（可选）。机构或栏目标签仅在用户提供并需要时加入。
- 从 F 静默人物案例编辑而来，增加“高分，就够了吗？”。A–G 原图未覆盖。
- 案例是布局与气质基准，不是对所有新文章固定使用同一人物／文案的要求。
- 生成图不是采访现场的新照片，也不表示人物为 AI Pioneer 背书；真实人物、品牌与原始素材的权利不因本仓库发布而转让。实际使用者自行确认其使用场景下的素材权限。
- 已查看横版效果；未认证所有微信公众号裁切位。实际投放前按目标展示位预览。

## 本案例实际编辑提示词

```text
Use case: identity-preserve. Edit the supplied finished AI PIONEER cover to create variant H "静默一问". This supplied image is the edit target, not merely inspiration. Keep its full landscape 2.35:1 canvas, white seamless background, the exact same monochrome man on the right (Rayan Krishnan), face, glasses, hair, beard, pose, lighting, clothing, scale and placement unchanged. Keep the tiny existing lower-left AI PIONEER and Rayan Krishnan unchanged. Change ONLY ONE thing: add the Chinese question "高分，就够了吗？" as ONE SINGLE LINE at x=10% of canvas, vertically around y=43%, with an elegant refined medium-weight sans-serif font, near-black #1D1D1F, modest size approximately 6% of canvas height and the whole line occupying about 30-34% of canvas width. Not bold display lettering, not condensed. Keep vast uninterrupted white space around this small question. Text must be exact: 高分，就够了吗？ . No quotation marks. No subtitles, no icons, no lines, no textures, no shapes, no dates, no labels, no extra text, no Apple logo. The question is editorial copy, not an attributed quote. This is a finished flat publication cover, no frame, no device or scene mockup. Preserve the quiet restrained photographic design; do not fill the whitespace. Output one image.
```
