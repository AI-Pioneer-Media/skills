# 人物封面与首图

先查看 `assets/approved-cover-reference.jpg` 和 `assets/logo-original.jpg`。前者是 Jack Clark 视觉定稿，**不是每期必须使用的人物或文字**。图片是生成式设计参考，不意味着人物为品牌背书。

使用当前环境的内置 GPT 图像生成/编辑工具，并遵循可用 imagegen 技能的工具规则。无此工具时交付提示词与已完成版式，明确封面未生成；不能把旧图冒充新图。不要为此把 API 密钥写进仓库。封面编辑先查看输入原图，指定所有参考图路径。

## 构图锁定

- 宽高比约 2.34:1，参考 1918 × 820。白底；左边窄朱红竖条；真实参考人物左半，胸像/半身，保留自然面部细节，可采用定稿的灰阶人像或自然低饱和色彩。朱红与白构成整体视觉，不改成全黑底或纯黑白方案。
- 右半留白，墨黑高对比衬线字标 AI PIONEER，下面大号人物姓名；用人物适合的中英文姓名，避免强制不自然拆字。
- 姓名下方写本期真实职务，如 `Anthropic 联合创始人`。朱红 #D93D28，高对比衬线/宋体，与参考原红色人物标签的字体气质一致；不做胶囊、灰块、描边或粗黑无衬线标签。1918 宽时约 65–75px，按长短微调。
- 图形 Logo 只在最右上，参考约 100px，距顶部/右侧约 55px，浅灰水印。使用提供的四角星轮廓；不要贴原件黑方块，不另造 Logo。
- **移除封面里的“AI先行者”或“AI 先行者”字样**，职务取代其位置。正文栏目标签不受此约束。
- 同一张图作为微信封面和正文首图。检查大图及手机缩略图的姓名和职务；方形平台展示若确实需要，另适配，不声称横图自动兼容所有裁切。

## 可复用生成提示

把括号字段换成本期已核实信息，再发送给图像工具：

> Create an editorial portrait cover for AI PIONEER. Use the supplied approved cover as the layout and typography reference, the supplied portrait as the identity reference, and the supplied four-point star as the brand symbol. Wide 2.34:1 composition, white background, narrow vermilion #D93D28 stripe on the left. Natural portrait of [PERSON] on the left, generous clean space on the right. On the right, elegant high-contrast serif AI PIONEER wordmark and large [DISPLAY NAME] in near-black #151515. Under the name, set exactly “[VERIFIED ROLE]” in vermilion #D93D28, refined Songti/high-contrast serif, comfortably readable on one line where possible. Small faint gray four-point-star watermark in the extreme upper-right with ample margins, no black square behind it. No “AI先行者” or “AI 先行者” text on the cover. No frosted glass, translucent panels, pills, borders or extra slogans. Preserve recognizable facial features and natural detail. Do not invent other text, roles or affiliations.

素材、角色与文字冲突时以当期核实资料为准。英文品牌与职务文字必须逐字人工核对；发现乱码时继续修正，不能只靠“已生成”判定完成。
