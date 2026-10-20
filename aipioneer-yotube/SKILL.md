---
name: aipioneer-yotube
description: 将 YouTube 科技访谈、演讲或播客转成 AI Pioneer 风格的中文微信公众号深度文章，并按用户最终定稿的蓝色判断、荧光绿核心结论、灰底总结卡片和短段落版式生成预览；用户明确要求上传或发布到公众号草稿箱时再执行上传。
---

# AIPioneerYotube

把一条 YouTube 链接处理成可直接使用的 AI Pioneer 公众号文章。目标不是翻译字幕或按时间轴复述，而是围绕一个读者问题重组素材，形成有事实、有机制、有章节推进、有行动结尾的中文深度稿。

默认工作区为 `D:\公众号`；用户指定其他目录时以用户要求为准。

## 工作流

1. **获取视频材料**
   - 运行同级 `youtube-ai-pioneer-draft/scripts/prepare_youtube_material.py`（按实际安装目录定位），保存元数据、字幕和缩略图。
   - 无字幕时依次尝试官方字幕、视频说明、演讲者或机构发布的文字稿；仍不足时说明证据缺口，不凭空补全观点。
   - 不在聊天中粘贴完整字幕。

2. **建立文章主线**
   - 先写一句“本文只解决什么问题”，再筛选素材。
   - 不按访谈顺序机械排列。将材料重组为：冲突或问题 → 判断方法 → 机制与案例 → 更高层影响 → 读者行动。
   - 每章结尾必须提出下一章需要回答的问题，使章节形成因果链，而不是独立摘要合集。
   - 写作前读取 [写作方法](references/writing-method.md)。需要判断强调层级或复刻最终稿语言时，再读取 [最终稿修改记录](references/final-draft-delta.md)。

3. **核验事实**
   - 对人物身份、数字、论文、产品能力、发布日期和直接引语做来源核验；技术事实优先使用视频原话、论文和机构官方页面。
   - 字幕里的自动识别错误不能直接采用。无法确认会议名、日期或数字时，降低表述精度并明确归属，例如“Jeff 在访谈中回忆”。
   - 翻译或意译不得伪装成逐字引语。只有能在原视频或文字稿中定位的内容才使用引号。

4. **写成公众号文章**
   - 长访谈通常写 4500—7500 个中文字符；素材不足时宁可缩短，不用同义反复凑篇幅。
   - 标题优先使用“人物 + 读者冲突/具体问题”，让读者一眼知道与自己有什么关系。
   - Markdown 顺序固定为：H1 → AI Pioneer 头图 → YouTube 缩略图 → 图注 → 开场 → 正文章节 → 参考资料 → 关于/关注/星标三张尾图。
   - 不插入开头的商务合作横幅。内容图片只保留能证明场景、人物、产品或数据的图片。
   - 使用以下段落级排版标记；一个段落只使用一种主强调：
     - `[BLUE]判断、追问或章节内的小结[/BLUE]`
     - `[GREEN]全篇最值得记住的结论[/GREEN]`
     - `[BOLD]关键动作、定义或问题[/BOLD]`
     - `> 阶段性收束` 渲染为灰底卡片
   - 完整版式与用量规则见 [排版规范](references/layout-spec.md)。

5. **预检**
   - 正文只放给读者看的内容。段尾的“官方任务说明”“某机构方法说明”“原视频，时间码”等来源链接统一移至文末参考资料；不要把来源标签裸露成半句话。自然的“某人在访谈中说”、必要的事实归属与图片来源仍保留。
   - 内部检索标记、编辑批注、核验过程记录、未完成占位符不得进入文章。逐段通读最终 HTML 的可见文字，而非仅检查 Markdown 或链接有效性。
   - 发布脚本先运行 `scripts/reader-quality.mjs` 的读者正文检查；失败时停止预览／上传并修改源稿，不能静默删字或绕过。规则回归测试：`node --test scripts/reader-quality.test.mjs`。
   - 检查标题承诺与正文一致、所有本地图片存在、引用可追溯、章节之间有显式过渡、结尾只有一个主要动作。
   - 用 `scripts/publish_aipioneer_yotube.mjs --dry-run` 生成 HTML 预览。
   - 检查预览中不存在未解析的 `[BLUE]`、`[GREEN]`、`[BOLD]`、Markdown 星号或孤立的 `>`。
   - 按 [质量门槛](references/quality-gate.md) 核稿；存在硬性问题时不得上传。

6. **保存或上传**
   - 仅给 YouTube 链接、未出现“上传、发布、草稿箱、放到公众号”等授权时：保存 Markdown 和预览，不写入公众号。
   - 用户明确要求上传或发布时：创建一条新草稿，不覆盖旧稿；使用 `WECHAT_APPID` 和 `WECHAT_APPSECRET` 环境变量，禁止把密钥写进 Skill、文章或命令输出。
   - 上传后读取草稿记录核对标题、作者、封面和正文图片数量。

## 常用命令

将 `<skills-root>` 替换为本机技能安装目录，`D:\公众号` 替换为实际文章工作区。

准备材料：

```powershell
& <bundled-python> "<skills-root>\youtube-ai-pioneer-draft\scripts\prepare_youtube_material.py" `
  --url "<youtube-url>" `
  --workspace "D:\公众号" `
  --slug "<topic-slug>"
```

预览：

```powershell
& <bundled-node> "<skills-root>\aipioneer-yotube\scripts\publish_aipioneer_yotube.mjs" `
  --markdown "D:\公众号\草稿\<slug>.md" `
  --cover "D:\公众号\配图\<slug>\01-youtube-thumbnail.jpg" `
  --title "<title>" `
  --author "AI Pioneer" `
  --digest "<digest>" `
  --output "D:\公众号\草稿\<slug>-preflight.json" `
  --dry-run
```

正式上传时删除 `--dry-run`，并把输出文件改为 `-公众号草稿箱-result.json`。

## 失败处理

- `40164 invalid ip`：报告错误中的准确 IP，请用户加入当前 AI Pioneer 公众号的 IP 白名单；不要切换到其他公众号配置。
- `40125 invalid appsecret`：停止并请用户更新正确密钥；不要猜测或轮试其他账号。
- 缺少字幕：列出可用证据和缺口，不能把二手总结当作视频原话。
- 上传失败时保留 Markdown 与预览，禁止删除或覆盖已有草稿。

## 完成报告

报告本地 Markdown 路径、预览路径、标题、正文图片数量；如已上传，再报告 `media_id` 和结果 JSON 路径。
