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

## 共建方式

新增技能单独建目录，并提供 `SKILL.md`；脚本放 `scripts/`，参考资料放 `references/`。修改写作规则或发布脚本时，建议通过 Pull Request 说明修改原因，由另一位成员核对后合并。

请勿提交 `.env`、API 密钥、Cookie、账号凭证或含此类信息的运行结果。本仓库公开可见。