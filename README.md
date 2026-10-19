# Local Canvas · 本地无限画布

基于官方 MIT 授权的 Excalidraw React 组件，使用 React + Electron + SQLite 构建 Windows/macOS 本地优先白板。在保留原生绘图体验的基础上，增加本地文档管理、场景导航与全屏演示。

[开发源码与运行说明](https://github.com/layzerff/excalidraw/tree/codex/local-canvas-p0/desktop) · [修改清单](https://github.com/layzerff/excalidraw/blob/codex/local-canvas-p0/desktop/NEXT-ITERATION.md) · [更新记录](https://github.com/layzerff/excalidraw/blob/codex/local-canvas-p0/desktop/CHANGELOG.md) · [验证记录](https://github.com/layzerff/excalidraw/blob/codex/local-canvas-p0/desktop/VALIDATION.md) · [原版介绍](README.upstream.md)

## 与原版的区别

比较对象为上游开源编辑器及组件。原生绘图、文字、箭头、自由画笔、Frame 和撤销重做继续由官方组件提供。

| 功能 | Local Canvas 的扩展 |
| --- | --- |
| 本地文档工作区 | 根目录/文件夹右键新建，文件树就地菜单改名与移动，支持拖入文件夹及拖回根目录；文件夹加粗与折叠，左右侧栏可调整宽度 |
| 保存与备份 | 内容变更自动保存，平移、缩放和场景导航不触发写入；手动保存（Cmd/Ctrl+S）同时记录当前视图；完整备份包含图片、场景及素材库 |
| 同一白板内的场景 | 框选区域或保存当前视图，编辑标题、调整区域、拖动排序；点击后平滑移动并缩放，动画可打断 |
| 紧凑场景侧栏 | 单行标题、拖动排序，右键进入改名/重框等操作；标题原位编辑，双栏图标切换显示 |
| 导航时长 | 编辑侧栏固定 0.5 秒；演示中的手动翻页与自动播放可选 0.5、1、1.5、2 秒 |
| 全屏场景演示 | 从排序第一项开始，底部手动翻页或自动演示；图层面板可拖拽排序、右键原位改名，退出恢复编辑视图 |
| 文件打开与保存 | 系统窗口选择文件，手动保存写回原文件；另存为选择新位置，“文件信息”查看路径。内容自动保存到本机恢复副本，外部文件变更时拒绝覆盖 |
| 演示临时画笔 | 直接使用 Excalidraw 原生自由画笔和样式面板，支持描边、背景、粗细及透明度；翻页或退出清除 |
| 集中导出 | 右上角统一入口，可框选区域导出 PNG、SVG、PDF；支持整板、场景分页 PDF 及完整可编辑文档 |
| 字体与素材库 | 沿用画布原生字体面板，支持手写字体及离线中文回退；本地 `.excalidrawlib` 导入、合并及随文档保存 |
| 离线使用 | 编辑器资源与字体随包提供，无需连接 Excalidraw+；当前未开放云同步及在线素材库安装 |

## 编辑与场景管理

当前桌面版本：**0.2.0**。左侧保留文件树、保存/另存为、打开文件；备份、恢复及工作区迁移折叠在“工作区管理”。

![Local Canvas 0.2.0 实机文件树：文件夹图标、就地操作与简化工作区](docs/local-canvas/files-current.png)

![Local Canvas 实机界面：本地文件树、原生画布及紧凑场景列表](docs/local-canvas/desktop-current.png)

## 全屏演示

![实机全屏演示：底部翻页及临时画笔，左侧为 Excalidraw 原生画笔样式面板](docs/local-canvas/presentation-current.png)

临时画笔允许连续书写多笔，翻页及退出时清除；不写入文档、备份或 PDF。编辑和备份仍使用完整文档或 `.excalidraw` 格式。

![演示图层面板：排序与右键场景操作，底部可选自动演示及移动时长](docs/local-canvas/layers-current.png)

自动演示每页停留可选 1、2、3、5、10、15、30 秒（默认 3 秒），与移动时长分别设置，到最后一页停止；打开图层面板或启用临时画笔时暂停自动播放。工作区第一行是“＋白板、＋文件夹”，第二行固定为“保存、另存为”。

## 区域导出

![统一导出菜单：框选范围与 PNG、SVG、PDF 格式](docs/local-canvas/export-current.png)

PNG、SVG、PDF 支持指定区域。PDF 以高分辨率图像嵌入页面；完整文档和 `.excalidraw` 保存整张白板，保留可编辑内容。

## 运行

应用代码位于 `codex/local-canvas-p0` 分支，默认分支同步说明与图片。

```sh
git clone --branch codex/local-canvas-p0 https://github.com/layzerff/excalidraw.git
cd excalidraw/desktop
npm ci --workspaces=false
npm run build
npm start
```

当前为开发版，已在 macOS Apple Silicon 验证；Windows 实机验证、发布签名及完整输入法/手写笔回归待完成。Revezone 风格的任意自定义字体上传仍在后续清单，当前提供原生中英文字体。具体完成范围见[修改清单](https://github.com/layzerff/excalidraw/blob/codex/local-canvas-p0/desktop/NEXT-ITERATION.md)。

Windows x64 安装版（NSIS）与免安装版已完成交叉构建及包完整性检查，内容与当前开发分支一致；尚未在 Windows 实机启动，也未进行 Windows 代码签名。界面截图来自 macOS 打包应用测试。

## 上游与许可证

感谢 [Excalidraw](https://github.com/excalidraw/excalidraw)。保留 [MIT LICENSE](LICENSE)；第三方依赖及字体声明随桌面构建生成。
