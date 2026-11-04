# 参与翻译

请在 Issue 中提供 Cursor 版本、页面或操作入口、漏译的英文原文与建议译文。截图请先遮盖账号、项目、对话和凭据；无需上传应用资源文件、日志或个人配置。

1. 在 `dictionary.json` 补充词条，保留 `{0}`、`{1}` 等参数以及命令、链接和品牌名。
2. 涉及动态文字或富文本时，在 `test/runtime.test.js` 增加浏览器回归用例。
3. `npm ci`，然后 `npx playwright install chromium`，执行 `npm test`。
4. 使用已安装的 Chrome 测试时，可运行 `CURSOR_ZH_BROWSER_CHANNEL=chrome npm test`。
5. 生成 VSIX：`npm run package`。此操作只打包，不安装、不改动 Cursor。

原生语言键使用 `translations/main.i18n.json`。维护者在本机有 Cursor 和 Microsoft 基础中文包时，可显式传入两者路径运行 `scripts/build-languagepack.py` 重新对齐；此过程只读取语言键和翻译数据。不要提交原始应用 JS、应用备份、个人配置或未经清理的运行日志。

`scripts/audit-ui.cjs` 是可选的本机 DOM 核查工具，需要自行明确开启仅监听回环地址的调试接口；不提供截图或采集对话。它只报告与应用静态界面词条匹配的文字，不代表所有页面均已验收。核查完成后应正常退出并以常规方式重新打开 Cursor。
