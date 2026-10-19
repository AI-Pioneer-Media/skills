# 保存到微信草稿箱

用户要求送草稿箱即授权该次存草稿；会话已有授权时不要重复询问。只做预览的请求不自动上传，存草稿也不等于公开群发。脚本只允许 stable_token、图片素材上传、draft/add、draft/update、draft/get，没有发布或删除接口。

## 本机账号配置

随包脚本用于 **Windows PowerShell 7**，沿用已验证的本地 DPAPI 配置：

`%LOCALAPPDATA%/AIPioneer/wechat/account.json`

字段为 `account_name`、`app_id`、`app_secret_dpapi`。本机已有配置时直接复用，不读取或显示密钥明文。`app_secret_dpapi` 由该 Windows 用户使用 `Read-Host -AsSecureString` 安全输入后经 `ConvertFrom-SecureString` 产生；它绑定本机用户，不适合复制到另一台机器。新电脑通过自己的安全配置渠道配置，确认所用账号是用户授权的账号。

凭据、AppSecret、Token、Cookie、账号 JSON 以及草稿快照/回执不进 Git。认证和业务请求仅发往 `https://api.weixin.qq.com`，关闭重定向；错误输出不打印可能含 Token 的完整请求 URL。IP 白名单和接口权限由账号实际配置决定；失败时依据安全错误码处理，不转而绕过受限后台页面。

## 新草稿

以下命令从技能目录执行，路径替换成本期工作目录：

```powershell
pwsh -NoProfile -File scripts/Save-WeChatDraft.ps1 -ArticleJsonPath /work/issue/render-v1/article.json -OutputDirectory /work/issue/upload-v1
```

## 更新已授权的同篇草稿

先读取当前草稿快照，并与此前本地版本比较，保护用户在后台做的修改。快照是扁平 article 对象，含 `media_id`，不是带 `news_item` 的原始响应。

```powershell
pwsh -NoProfile -File scripts/Get-WeChatDraft.ps1 -MediaId TARGET_DRAFT_ID -OutputPath /work/issue/before-update.json
pwsh -NoProfile -File scripts/Save-WeChatDraft.ps1 -ArticleJsonPath /work/issue/render-v2/article.json -OutputDirectory /work/issue/upload-v2 -UpdateMediaId TARGET_DRAFT_ID -ExpectedDraftSnapshot /work/issue/before-update.json
```

ID 必须来自当前任务的草稿结果或用户指定，技能不固定本次示例草稿 ID。脚本在写入前再次比对标题、作者、摘要、正文、封面和原文链接；发现变化则停止，不覆盖变化后的草稿。只支持单篇图文草稿。

## 回读与重试

成功须满足 `draft-receipt.json` 的 `verified: true`。脚本保存已上传 HTML、更新前快照和读回 HTML，并核对标题、作者、摘要、封面、可见正文及图片顺序。微信可能把 `src` 改成 `data-src`、图片 `/0` 改成 `/640`、短文章链接改成带参数的正式链接；不要求 HTML 字节完全相同。

再次渲染微信实际读回内容：

```bash
node scripts/preview.cjs /work/issue/render-v2 /work/issue/upload-v2/retrieved-content.html
```

检查微信中的推荐链接仍对应目标文章，不能只核对链接数量。渲染报告检查原封面卡片、结尾图片及手机宽度；浏览器预览是辅助，不能声称等同微信所有机型实测。

同一输入的完成日志可重新核验，但不重复创建草稿。输入有变化使用新输出目录。网络超时或不确定响应可能已经写入成功：保留日志，查清远端状态后继续。不要删除/编辑日志、修改输入哈希或盲目重跑来绕过不确定状态保护。脚本不会自动删除旧草稿，删除需要用户明确指定。

## 已验证基础

发布器来自 2026-10-19 已成功上传、更新、读回验证的工作流。打包时只进行本地构建、预览、语法及验证检查；不因打包技能而再次改动真实草稿。未来接口变化按真实响应更新脚本，不把历史成功当作永久权限保证。
