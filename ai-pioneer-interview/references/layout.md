# 访谈发布版样式与构建

## 排版顺序

品牌 banner → 本期人物主视觉 → HIGHLIGHTS 与浅灰导读块 → 必要人物/现场图片及来源 → 编号主题与连续问答 → 短结尾 → 全文完 → 往期推荐 → 与AI先行者同行品牌卡。

顶部红色 banner 是独立组件。其下的 `cover` 使用已按 [1019 规范](../../ai-pioneer-1019/references/cover.md) 完成的横版人像主视觉，版式对照[本栏目定稿](tao-lin-hero.jpg)。不要把含 banner 的首屏截图或蓝底证件照直接作为 `cover`。封面包含生成式处理时，图源署名区分原始人物照片与本号的封面制作。

品牌尾卡复用 `ai-pioneer-1019/assets/ending-card.jpg`。单独放在最后一张推荐卡的链接之外，置于可复制正文容器内，并随正文图片进入草稿上传清单。

| 元素 | 最终案例参数 |
| --- | --- |
| 正文 | 15px，墨黑 #151515，line-height:2，letter-spacing:.3px，margin:0 8px 16px |
| Highlights 标签 | 17px 粗体，#AB1942，line-height:1.6，margin:0 8px 24px |
| 导读块 | #F4F4F4，8px 圆角，padding:18px 14px，margin:0 8px 26px |
| 独立章节号 | 28px 朱红 #D93D28 粗体，行高1.3，margin:36px 0 9px |
| 章节标题 | 18px 黑色粗体，行高1.5，margin:0 0 19px |
| 发言者 | 主持人姓名黑粗体；受访者姓名朱红粗体；后续发言黑色常规体 |
| 图注 | 12px 灰 #888，居中，行高1.7，margin:0 8px 24px |
| 全文完 | 11px 朱红，字距4px，居中，margin:40px 0 32px |
| 推荐区 | 朱红英文标签11px，黑色标题20px；真实推荐卡整图可点击 |

图片100%宽、自动高度；左右缩进只在段落加一层。不要复制微信页面里反复嵌套的外层 section、固定 635.2px 宽度、空 img 和平台运行脚本；复制其视觉参数即可。

## 输入与命令

Python 3 标准库即可运行，无需安装字体或图片库。按下列结构准备本期 JSON，图片路径相对于输入文件。代码中的示意文本应替换为真实内容；源材料核验和版权判断由编辑完成。

```json
{
  "title": "本期标题",
  "digest": "本期摘要",
  "guest": "本期嘉宾姓名",
  "cover": "hero.jpg",
  "highlights": ["主张与背景。", "有冲突的具体观点。", "相邻的重要限定。"],
  "opening_images": [{"image":"portrait.jpg","caption":"官方人物照及必要署名","source_url":"https://example.org/official-photo"}],
  "sections": [{"title":"忠实于本节的主题","blocks":[
    {"speaker":"采访者","text":"完整问题。"},
    {"speaker":"本期嘉宾姓名","text":"完整回答第一段。"},
    {"text":"回答继续，不重复补姓名。"}
  ]}],
  "conclusion": ["用一个追问收束。", "落到读者的一个具体思考。"],
  "sources": [{"url":"https://example.org/interview","kind":"official-transcript","rights":"本期已核实的翻译使用条件"}],
  "recommendations": [{"title":"真实往期标题","url":"https://mp.weixin.qq.com/s/真实链接","image":"recommendation-card.jpg"}]
}
```

- `recommendations[].image` 是已由**真实原封面＋朱红标题栏**组成的整张卡，不是待编造的封面。通常选2篇，缺素材时先记录待补，不用假标题假链接充数。
- `header` 可指定本期品牌 banner；默认从相邻 `ai-pioneer-1019` 取。省略 `ending` 时自动使用同目录的 `ending-card.jpg`。需要更换品牌物料时，可传自定义图片路径。
- 章节 `blocks` 也可放 `{image,caption,source_url}`。图片插在确有信息价值的位置；不要设置每章图数配额。
- 文字是纯文本；构建器 HTML 转义，不会把用户内容当代码，也不自动删节。要强调时先保持文字完整，局部格式另做有针对性的修改。
- 许可要求公开归属/说明改动时，可填 `attribution` 字符串，渲染在正文末的简短小字；完整证据清单留工作区。`content_source_url` 仅在用户需要“阅读原文”时填。

```bash
python <repo>/ai-pioneer-interview/scripts/render_interview.py <issue>/input.json <issue>/render-v1
```

输出 `content.html`（上传占位符）、`article.json`（草稿清单）、`公众号排版-可复制.html`（内嵌图片）、`assets/`、`build-report.json`。输出目录须为空；下一版本另建目录。脚本不访问网络，也不存草稿。

本地复制按钮使用剪贴板富文本；受浏览器权限限制时使用“选中正文”，再复制。正文长时不要把整页工具条也粘入编辑器。

## 视觉与内容检查

在390/430px浏览器宽度各看首屏、问答和尾部。核对 15px 正文、28/18px 章节、短导读、姓名色、自然断句、图注及推荐跳转；无横向溢出、空段堆积、破图、剪裁掉人脸或复制工具条。必要时使用环境已有 Chromium/Playwright 截图，切勿因安装某工具失败就声称无法排版。

对比源稿问答顺序及关键数字。长访谈可以很长，编辑评论必须短；不能为了缩短页面删正文或把它渲染成不可选中的长图。
