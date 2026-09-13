# AI Pioneer Skills

AI Pioneer 公众号的写作、视频素材转稿与排版工作流。

[品牌物料与 Logo](https://github.com/AI-Pioneer-Media/brand-assets) · [组织主页](https://github.com/AI-Pioneer-Media)

## 技能目录

| Skill | 用途 | 配套内容 |
| --- | --- | --- |
| [ai-pioneer-deep-writing](ai-pioneer-deep-writing/SKILL.md) | AI / 科技领域深度公众号写作，重视争点、事实核验、证据链与真实配图 | 质量检查 Python 脚本、标杆文章参考、Codex 配置 |
| [aipioneer-yotube](aipioneer-yotube/SKILL.md) | 将 YouTube 访谈、演讲或播客重组为中文深度文章 | 写作与排版规范、示例、质量门槛、预览及草稿上传脚本 |
| [aipioneer-style](aipioneer-style/SKILL.md) | 公众号排版与视觉组件 | v1–v4 样式文档、现有 HTML 模板与元数据 |

保留 `aipioneer-yotube` 的原始拼写，以兼容现有调用。每个技能目录包含完整配套文件，不要只复制 `SKILL.md`。

## 安装与同步

```bash
git clone https://github.com/AI-Pioneer-Media/skills.git
```

将需要的技能目录复制到你的 Codex 技能目录（通常是用户目录下的 `.codex/skills/`），重新开始会话后使用对应技能。已有同名技能时，先比较本地修改再合并。

调用示例：

```text
使用 $ai-pioneer-deep-writing 根据这些材料写一篇 AI Pioneer 深度文章。
使用 $aipioneer-yotube 将这个 YouTube 视频转为公众号文章，先生成预览。
使用 $aipioneer-style 按 AI Pioneer 样式排版这篇文章。
```

## 运行条件与外部依赖

本次为 2026-09-09 的原始技能同步，保留源文件内容。文档中的 macOS / Windows 绝对路径和示例素材路径属于原作者环境，使用时替换为自己的技能安装目录、工作目录和素材位置。

- **深度写作**：质量检查脚本使用 Python 3.10+ 标准库。从本仓库根目录可运行：

  ```bash
  python ai-pioneer-deep-writing/scripts/deep_quality_check.py /path/to/article.md --strict
  ```

  文档提及的 `scripts/wechat_draft_upload.py` 属于外部工作区工具，未包含在本仓库。

- **YouTube 转稿**：预览与上传脚本使用 Node.js，需支持全局 `fetch`、`FormData` 和 `Blob`。字幕准备工具 `youtube-ai-pioneer-draft/scripts/prepare_youtube_material.py` 不在本次三个技能目录内，未随包上传；使用前需另行配置，或自行准备可信字幕、元数据和缩略图。
- **预览与发布**：`publish_aipioneer_yotube.mjs` 加 `--dry-run` 只生成预览；正式写入公众号前需用户明确授权，并通过 `WECHAT_APPID`、`WECHAT_APPSECRET` 环境变量配置自己的账号。
- **样式模板**：HTML 中的 `image.jpg`、`header.png` 等为素材占位路径，使用时替换；文档中的 `npx aipioneer-publisher` 命令依赖另行安装的发布器，本仓库不包含该发布器，也未验证该命令的外部包可用性。
- **风格选择**：`aipioneer-style/SKILL.md` 是纯黑 v1 默认入口，v2–v4 为其他版本参考；YouTube 技能有独立的蓝色判断与荧光绿结论规范，按所选工作流使用。

## 品牌物料

从 [brand-assets](https://github.com/AI-Pioneer-Media/brand-assets) 获取原图，并保存到文章项目使用的本地路径。

| 用途 | 品牌仓库文件 |
| --- | --- |
| 图形 Logo | `logos/ai-pioneer-symbol-white-on-black.jpg` |
| 字标 | `logos/ai-pioneer-wordmark-white-on-black.jpg` |
| 文末品牌介绍 | `brand/ai-pioneer-introduction.png` |
| 文末关注引导 | `wechat/ai-pioneer-follow-banner.png` |
| 文末星标指南 | `wechat/ai-pioneer-star-guide.png` |

文末按「资料说明 → 品牌介绍 → 关注 → 星标」排列。文章示例使用的图片文件名可能不同，请按用途对应；头图、封面和正文证据图按具体文章准备。

## 封面风格库（A–H）

2026-09-14 新增 8 个独立封面 Skill。A–G 原方案与原图全部保留，H「静默一问」是在 F「静默人物」基础上增加一句短问题。每款包含设计约束、可复用提示词、原尺寸 PNG 案例与 Codex 调用配置；可只安装其中任意一款。

| 款式 | Skill | 视觉特征 |
| --- | --- | --- |
| A 先锋拼贴 | [aipioneer-cover-collage](aipioneer-cover-collage/SKILL.md) | 黑白撕纸、薄荷绿标记与大字人物拼贴 |
| B 薄荷绿刊物 | [aipioneer-cover-mint](aipioneer-cover-mint/SKILL.md) | 薄荷绿整底、黑框刊头与醒目提问大字 |
| C 蓝色研究档案 | [aipioneer-cover-blueprint](aipioneer-cover-blueprint/SKILL.md) | 深蓝工程网格、双色人像与研究档案构图 |
| D 黑白人物志 | [aipioneer-cover-portrait](aipioneer-cover-portrait/SKILL.md) | 黑白人物特写、薄荷绿方括号与杂志刊头 |
| E 白色发布会 | [aipioneer-cover-white](aipioneer-cover-white/SKILL.md) | 自然低饱和人像、两行短句与大面积留白 |
| F 静默人物 | [aipioneer-cover-silent](aipioneer-cover-silent/SKILL.md) | 右置黑白人像、极小署名与无主标题留白 |
| G 一句话 | [aipioneer-cover-type](aipioneer-cover-type/SKILL.md) | 不放人物，只用一句短文案与极简文字留白 |
| H 静默一问 | [aipioneer-cover-silent-question](aipioneer-cover-silent-question/SKILL.md) | 保留静默黑白人物，只增加一句简短问题 |

E–H 是留白系列：E 为自然彩色人物＋两行短句；F 为黑白人物、无主标题；G 为纯文字、无人像；H 为黑白人物＋一句问题。D 虽是黑白人物，但保留大刊头和绿色方括号，不与 F 合并。

### 案例图库

以下保留各方案原尺寸图，点击可查看原图。案例中的人物与标题仅演示风格；新选题使用自己的素材。生成式人物图为设计演绎，不是新的纪实照片或人物背书。A、C 原图有生成器额外添加的小字，已在对应 Skill 中明确不将其继承为品牌规范。

#### A · 先锋拼贴

[![A 先锋拼贴](aipioneer-cover-collage/assets/example.png)](aipioneer-cover-collage/assets/example.png)

[使用规则](aipioneer-cover-collage/SKILL.md) · [提示词与素材说明](aipioneer-cover-collage/references/prompt-template.md)

#### B · 薄荷绿刊物

[![B 薄荷绿刊物](aipioneer-cover-mint/assets/example.png)](aipioneer-cover-mint/assets/example.png)

[使用规则](aipioneer-cover-mint/SKILL.md) · [提示词与素材说明](aipioneer-cover-mint/references/prompt-template.md)

#### C · 蓝色研究档案

[![C 蓝色研究档案](aipioneer-cover-blueprint/assets/example.png)](aipioneer-cover-blueprint/assets/example.png)

[使用规则](aipioneer-cover-blueprint/SKILL.md) · [提示词与素材说明](aipioneer-cover-blueprint/references/prompt-template.md)

#### D · 黑白人物志

[![D 黑白人物志](aipioneer-cover-portrait/assets/example.png)](aipioneer-cover-portrait/assets/example.png)

[使用规则](aipioneer-cover-portrait/SKILL.md) · [提示词与素材说明](aipioneer-cover-portrait/references/prompt-template.md)

#### E · 白色发布会

[![E 白色发布会](aipioneer-cover-white/assets/example.png)](aipioneer-cover-white/assets/example.png)

[使用规则](aipioneer-cover-white/SKILL.md) · [提示词与素材说明](aipioneer-cover-white/references/prompt-template.md)

#### F · 静默人物

[![F 静默人物](aipioneer-cover-silent/assets/example.png)](aipioneer-cover-silent/assets/example.png)

[使用规则](aipioneer-cover-silent/SKILL.md) · [提示词与素材说明](aipioneer-cover-silent/references/prompt-template.md)

#### G · 一句话

[![G 一句话](aipioneer-cover-type/assets/example.png)](aipioneer-cover-type/assets/example.png)

[使用规则](aipioneer-cover-type/SKILL.md) · [提示词与素材说明](aipioneer-cover-type/references/prompt-template.md)

#### H · 静默一问

[![H 静默一问](aipioneer-cover-silent-question/assets/example.png)](aipioneer-cover-silent-question/assets/example.png)

[使用规则](aipioneer-cover-silent-question/SKILL.md) · [提示词与素材说明](aipioneer-cover-silent-question/references/prompt-template.md)

### 封面调用示例

```text
用 $aipioneer-cover-silent-question 为这篇访谈做封面，使用我提供的人物照片，问题写“高分，就够了吗？”。
用 $aipioneer-cover-silent 制作静默人物版，不放主标题。
用 $aipioneer-cover-type 只做一句话纯文字封面。
```

这些 Skill 独立于公众号上传工具：生成图片不会自动替换或发布文章。默认使用环境中的内置图像生成工具，不需要为此在仓库配置密钥；没有可用工具时只能交付提示词，不能声称已生成图片。横版案例约 2.35:1，方形展示位需另行适配。所有新封面包使用相对资源路径，不依赖作者电脑目录。

## 共建方式

新增技能单独建目录，并提供 `SKILL.md`；脚本放 `scripts/`，参考资料放 `references/`。修改写作规则或发布脚本时，建议通过 Pull Request 说明修改原因，由另一位成员核对后合并。

请勿提交 `.env`、API 密钥、Cookie、账号凭证或含此类信息的运行结果。本仓库公开可见。
