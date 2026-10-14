# 闲棋 · 无广告小游戏合集

在原 2048 仓库上增加中国象棋（标准 / 让一马 / 两种残局练习）、五子棋、翻翻棋和揭棋。四种棋类均为双人同屏，支持 iPad 触摸、对坐文字、棋盘翻转、悔棋、认输、和棋和各自独立存档。2048 保留原玩法、道具及 `plain2048.*` 存档键，入口改为 `2048.html`。

纯 HTML / CSS / JavaScript，无构建步骤、后端、账号和外部运行时依赖。GitHub Pages 继续选择 `main` 分支的根目录，原网址现在是合集首页。

## 本地运行和验证

安装 Node.js 后，在仓库根目录运行：

```sh
node tests/engine.test.mjs
node tests/assets.test.mjs
node tests/serve.mjs
```

打开服务器打印的网址。测试脚本没有第三方依赖。浏览器自动化测试需使用 Playwright，见 `tests/browser.cjs`。

## 文件结构

- `index.html` / `collection.css`：合集首页与棋类界面样式。
- `2048.html` / `style.css` / 原 `js/*.js`：原版 2048。
- `board.html` / `js/games/app.mjs`：四种棋类共用的 SVG 界面；棋盘随屏幕缩放，点击直接绑定棋盘位置。
- `js/games/xiangqi-rules.mjs`：借鉴 MIT 许可项目的象棋走法和将军检查。
- `js/games/engine.mjs`：各玩法、随机开局、终局和存档验证。
- `about.html`：实际采用的规则、保存说明及开源致谢。
- `sw.js` / `manifest.webmanifest`：覆盖全部游戏的离线缓存与主屏幕配置。

## 规则边界

五子棋为15×15自由规则，长连也获胜。暗棋为4×8，炮隔一子吃明子，暗子不能被吃。揭棋的明士、明象允许过河，被吃的暗子不公开。

象棋 / 揭棋检查所有基本走法、送将、照面、将死和困毙；单方连续长将重复三次判负，其余三次重复判和；120步不吃子或揭子判和。暗棋80步不翻子或吃子判和。长捉等赛事细则不自动裁决，由双方协商。悔棋最多保存最近100步，隐蔽棋类需双方确认。存档只是本地浏览器数据，无法跨设备同步，也不防开发者工具查看。

## 开源来源

象棋规则参考 [Hanazar-Games/XiangQi-webgame](https://github.com/Hanazar-Games/XiangQi-webgame)，固定参考提交 `a0ba4b97e39a3045c06961edea78c600fcae89ff`，已保留 `licenses/Hanazar-Games-MIT.txt`。原 2048 的 MIT 许可继续保留于 `LICENSE`。规则来源及改写内容见 `about.html`。
