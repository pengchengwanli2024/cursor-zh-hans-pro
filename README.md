# Cursor 中文界面增强包

一个包含基础中文语言包与 Cursor 专属界面翻译的社区插件。当前词典对齐 **Cursor 3.28.7 / Code OSS 1.128**，支持智能体窗口、设置、自定义中心、项目、任务、画布、文件操作和动态提示。

Community Simplified Chinese UI extension for Cursor. Includes an MIT-licensed base language pack, native Cursor NLS translations, a conservative renderer translator, version-isolated backups, tests and reproducible VSIX packaging. Not affiliated with Anysphere or Microsoft.

## 安装

从 [Releases](https://github.com/pengchengwanli2024/cursor-zh-hans-pro/releases) 下载 VSIX，在 Cursor 命令面板运行 **Extensions: Install from VSIX…**，或使用：

```sh
cursor --install-extension cursor-zh-hans-pro-1.2.1.vsix
```

本插件已包含基础中文资源。请卸载其他简体中文语言包，避免同一语言存在多个提供者，造成重启后翻译来源不一致。

在命令面板运行 **Configure Display Language**，选择 **中文（简体）/ zh-cn**。在编辑器模式启动本插件，执行 **Cursor 中文：立即修复界面汉化**，按提示完整退出并重新打开 Cursor。当前构建会缓存工作台资源，单独重载窗口可能继续使用旧资源。

## 当前覆盖

- 基础编辑器中文与内置扩展翻译资源。
- 当前构建全部 **681 个 Glass 原生语言键**，包含项目、成员、子智能体、看板、画布、文件、目标、迁移、权限和归档提示。
- 一万余条界面词典；补充 Cursor 设置、自定义中心、套餐、语音、侧栏、空状态与按钮提示。
- 带参数文案、标点和空白变化、分段动画，以及包含链接或命令的整句翻译。

681 个语言键的注册覆盖是静态数据核对，不等于所有业务状态都已逐页验收。模型名、品牌名、快捷键、协议名、代码和用户内容应保留原文。第三方网页、扩展自带网页和尚未收录的服务端新文案可能仍显示英文。

## 启动检测与更新

`cursorZh.autoApply` 默认开启。**自动修复由编辑器模式的扩展启动触发。** 当前 Cursor 独立智能体窗口只启动其指定扩展，因此仅打开独立智能体窗口时，本插件不会自行启动；需要在编辑器模式启动一次，或手动执行修复命令。已应用的翻译资源可以在独立智能体窗口生效。

插件会检测当前安装资源是否被软件升级覆盖，并从当前版本资源生成补丁。需要完整重启时会提醒，不强制重启或停止正在工作的智能体。启动结构不再兼容时停止修改并报告原因。未来版本的词条和结构适配需要更新插件；本项目不承诺任意未来版本始终完整中文。

本地 VSIX 不会自行从 GitHub 下载更新。新版本通过 Releases 发布，按需安装。

## 恢复

- **Cursor 中文：查看汉化状态**：检查版本、资源和词条状态。
- **Cursor 中文：立即修复界面汉化**：重新应用当前词典。
- **Cursor 中文：恢复原始界面资源**：关闭自动应用并移除当前安装中追加的运行时翻译。

卸载前请先恢复原始界面资源。只禁用或卸载扩展，不会自动移除已写入安装目录的资源。基础中文资源与显示语言设置独立保留；要恢复完整英文，再将显示语言改为 English。

## 实现与数据边界

原生翻译使用标准语言包接口。补充运行时翻译需要修改工作台启动资源及对应资源校验值。按安装位置、版本、提交和原始资源内容隔离备份，恢复只移除当前文件中本插件追加的代码，不用旧版本备份覆盖新版。没有提权、二进制补丁、重签名、常驻监控或翻译服务请求。

运行时跳过编辑器、终端、输入框及常见的对话正文容器；翻译整句时保留链接、命令、参数和事件处理器。语言包不收集界面、账号、项目或对话数据。macOS 当前构建为本机验证范围；Windows/Linux 未做实机验收。

## 开发与许可证

```sh
npm ci
npx playwright install chromium
npm test
npm run package
```

生成的 VSIX 位于 `releases/`，运行时不依赖 npm 包。详情见 [参与翻译](CONTRIBUTING.md) 与 [更新记录](CHANGELOG.md)。

代码与翻译采用 MIT License。基础中文源于 [microsoft/vscode-loc](https://github.com/microsoft/vscode-loc)，部分 Cursor 词典源于 [rongwei-lab/cursor-chinese](https://github.com/rongwei-lab/cursor-chinese)。完整来源与版权声明见 [THIRD-PARTY-NOTICES.md](THIRD-PARTY-NOTICES.md) 和 `LICENSES/`。
