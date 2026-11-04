'use strict';
const vscode = require('vscode');
const engine = require('./engine');

function activate(context) {
  const output = vscode.window.createOutputChannel('Cursor 中文界面');
  context.subscriptions.push(output);
  const settings = () => vscode.workspace.getConfiguration('cursorZh');
  const root = vscode.env.appRoot;
  const state = context.globalStorageUri.fsPath;
  const report = async (manual = false) => {
    try {
      const result = engine.apply(root, state);
      output.appendLine(JSON.stringify(result));
      if (result.status === 'busy') {
        if (manual) vscode.window.showInformationMessage('另一个 Cursor 窗口正在补齐中文界面，请稍后查看状态。');
        return;
      }
      if (result.status === 'applied') {
        const choice = await vscode.window.showInformationMessage('中文界面资源已更新并备份。请完整退出并重新打开 Cursor；单独重载窗口可能继续使用旧资源。', '查看重启说明');
        if (choice) vscode.commands.executeCommand('cursor-zh-hans-pro.showGuide');
      } else if (manual) vscode.window.showInformationMessage('中文资源已是当前版本，无需再次修复。');
    } catch (error) {
      output.appendLine('修复未完成：' + error.message);
      vscode.window.showWarningMessage('Cursor 中文界面自动修复未完成：' + error.message);
    }
  };
  const command = (id, fn) => context.subscriptions.push(vscode.commands.registerCommand('cursor-zh-hans-pro.' + id, fn));
  command('applyPatch', () => report(true));
  command('status', () => {
    try {
      const r = engine.inspect(root);
      vscode.window.showInformationMessage(`Cursor ${r.version}；增强汉化${r.current ? '已就绪' : '待修复'}；词典 ${r.terms} 条；升级自动修复${settings().get('autoApply', true) && settings().get('enabled', true) ? '开启' : '关闭'}。`);
    } catch (error) { vscode.window.showWarningMessage(error.message); }
  });
  command('showGuide', () => vscode.commands.executeCommand('markdown.showPreview', vscode.Uri.joinPath(context.extensionUri, 'README.md')));
  command('restore', async () => {
    const choice = await vscode.window.showWarningMessage('恢复后将关闭增强翻译，基础中文语言包继续保留。', {modal:true}, '恢复原始界面资源');
    if (!choice) return;
    try {
      await settings().update('enabled', false, vscode.ConfigurationTarget.Global);
      const result = engine.restore(root, state);
      output.appendLine(JSON.stringify(result));
      const guide = await vscode.window.showInformationMessage(result.status === 'busy' ? '另一个窗口正在修改，请稍后重试恢复。' : '已恢复当前版本的原始界面资源。请完整退出并重新打开 Cursor。', '查看说明');
      if (guide) vscode.commands.executeCommand('cursor-zh-hans-pro.showGuide');
    } catch (error) { vscode.window.showErrorMessage('恢复未完成：' + error.message); }
  });
  if (settings().get('enabled', true) && settings().get('autoApply', true)) void report();
}

module.exports = {activate, deactivate() {}};
