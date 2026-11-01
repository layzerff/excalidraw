# Milestone validation — 2026-10-17

## 2026-11-01 · v0.5.0 发布验证

- 正式版本由 preview.9 升级版本号，保持产品功能范围；保留既有测试及已知限制。
- 25 段演示来自用户 new 白板只读副本，所有操作在临时工作区；网页和视频位于模板旁的独立区域，视频再切换到居中放大的播放场景。字体/填充以模板内对应素材聚焦；字幕和指针为录制标注。
- 每段 WebP 均检查多帧与完整解码；保留原生字号四档，实际字号/密度数值变化校验，交叉填充保持两方向；真实 YouTube 播放、进度和切场景暂停检查通过。在线素材使用真实公共包，WebDAV/NAS 演示使用本机服务，不冒充设备实机。
- v0.5.0 的 58 项测试、最终 Mac 实包字号/素材库/密度像素/完整桌面回归、最终 Node/Chrome 网页存取与备份均通过。25 个 WebP 全部多帧、逐帧完整解码；不保留 GIF。
- 本地旧构建已按用户授权清理，preview.9 保留；源码、原文档、当前正式构建及历史文档保留。


## 2026-11-01 · 0.4.2-preview.9 本地验证

- 58 项单元/存储/服务/图标测试通过；新增本地素材跨文档一次性迁移、目录校验、路径迁移原文件保留、防覆盖、备份结构与恢复、防止删除后旧文档复活测试。
- 真实 Electron 字号专项通过：保留四档，比例 20→80 线性变化；数字框键盘/Tab 输入 65，新文字继承；大球标绑定文字按 40→80 比例变化并保持圆形。六主题截图检查，数字输入收窄到 46px。
- 素材专项通过：逐项名称本地/在线搜索、加载状态、根目录折叠、右键建文件夹/移入素材、原生目录选择器替身指定新路径后真实迁移文件与重载保留。拖宽、Ctrl＋滚轮、小图自动多列、最小尺寸、冻结标题与网格边界检查通过；无列数选择器。
- 原有素材导入、v1 在线预览、原生 MIME 拖放、离线保存、名称/标签及重启专项通过；本轮完整桌面与 Node/Chrome 网页版存取/备份回归通过。
- 最终 Mac 实包字号输入/继承、素材单击插入/逐项搜索/缩放/文件夹/路径迁移专项和完整桌面回归通过；最终 Node/Chrome 存取回归通过。203 个前后端脚本/样式/入口/图标逐项与源码及 Win 包一致。Mac 严格签名通过；ZIP、Windows 安装版/免安装版压缩结构及内嵌 app.asar 校验通过，附四包 SHA-256。
- Windows 与 NAS 设备未实机验证；仅本地预览，不推送或发布 GitHub。


## 2026-11-01 · 0.4.2-preview.8 本地验证

- 57 项单元/存储/资源/服务测试通过。构建通过；版本锁定的原生补丁在未匹配预期位置时中止构建。
- 只读核对用户问题白板：411 个有效元素，约 9428×6179 的几何范围，无极端远离元素；未修改原文档。原生全览向下取整是显示异常根因。
- 实际 Electron 验证低于 10% 的正常全览、约 10¹² 坐标边界适配及其后 5%/50% 连续滚轮变化；设置保存反馈有效，球标创建保持正圆，GitHub 图标可见。
- 素材专项用“包名不匹配、条目名称 OneDrive 匹配”的 fixture 验证逐项名称检索；真实公共在线目录也检索到包含 OneDrive 的素材内容和缩略图。未逐一验收全部在线素材包；部分包只提供图元文字而无独立名称。首次逐包下载受网络影响，显示进度及失败数量。
- 统一搜索、分区结果、整体焦点框、拖宽、六列适配、冻结标题折叠、根级网页入口、六主题与重启持久化交互通过。
- 演示原生线条风格及边框设置可操作，实际红色笔迹像素存在，原文档仍零元素；普通绘图/密度像素专项、球标相对字号继承、填充/滚轮专项和素材导入/拖放回归通过。源码完整桌面回归曾通过；先前演示快捷键撤销偶发性仍保留为跟踪事项。
- 最终 Mac 实包的全览/设置/球标、素材逐项搜索与布局、演示原生样式、绘图密度像素以及完整桌面回归均通过；本地 Node/Chrome 网页版存取与备份通过。修正了原生空库居中规则造成的搜索栏上方多余留白。
- Mac/Win 202 个脚本/样式/入口/图标文件与当前源码逐项一致；Windows 安装器内嵌 app.asar 与已验证文件一致，安装版和免安装版压缩结构通过；Mac 严格签名和 ZIP 完整性检查通过，四个包附 SHA-256。
- 仅本地构建，未推送 GitHub、创建标签或 Release；Mac 临时签名未公证，Windows/NAS 真机仍待验证。


## 2026-11-01 · 0.4.2-preview.7 本地修复

- 54 项单元/图标/存储/服务测试通过。Mac 专用底图为不透明标准 tile；应用内和 Windows 仍使用原始透明素材。实际 macOS 26 NSWorkspace 渲染验证灰底去除、外框完整，不靠放大裁切；未安装 Xcode，也未采用会影响严格签名验证的 Finder 自定义资源。
- 新增真实绘图回归：矩形/圆/菱形/直线/画笔分别设置非默认密度，连续拖出后保留几何；矩形/圆/菱形依次设置背景和交叉填充，再来回调密度，仍保留尺寸与样式；原生绘图撤销/重做、拖动缩放、关闭重启后已有图形多次密度调整均通过。密度本身不加入专用撤销，按用户最终要求执行。
- 追加画面检查发现：RoughJS/hachure-fill 的逐像素扫描用 iteration % gap === 0 判断落线，小数 gap 会漏线，且受随机步距选择影响而表现为整片空白或交叉只剩一组。现改为越过间距区间时落线，同时修复 bundled RoughJS 与独立 hachure-fill 两条路径。10%–200% 每个密度检查两方向，8 个小数密度 × 20 个种子检查双线方向；原生整数间距几何逐点不变。
- 实际静态画布像素（不依赖导出或 fillStyle 字段）验证矩形在 25/70/150/175% 下均存在两方向红色线条；矩形/圆/菱形的交叉填充真实截图检查通过。SVG/实心/演示密度专项通过，滑块拖动输入单调，fillStyle 保留。
- 素材库真实交互通过：保持打开，单关闭按钮；原生多选右键菜单按鼠标坐标定位；删除先确认、可取消；两按钮等宽等高；网页入口位于在线目录底部；六主题真实截图检查。缩放步长 15% 保存并重启保留。
- 画布/拼音搜索与原生高亮、全览右键专项通过；NAS Chrome 服务器存取/备份往返通过。
- 完整桌面回归前两次分别停于全屏演示图层反向拖动和临时画笔快捷键撤销，日志保留。临时画布现只在自己的原生编辑器内处理键盘，落笔时聚焦该编辑器并打断视口动画，避免全局快捷键/编辑器焦点混用；最终实现两次源码完整回归通过，覆盖画笔撤销/重做、原生绘图、场景、文件/备份与重启；但最终实包再次停于临时画笔快捷键撤销（预期 0 笔，仍为 1 笔）。此问题仍未解决，不将源码两次通过解释为偶发问题已消失。先前全屏拖动偶发性也不据此宣称彻底消失。
- 最终 Mac 实包的绘图/密度/素材库布局专项通过；完整回归未全部通过，仍有上述临时画笔快捷键撤销问题；Mac/Win 200 个脚本/样式、入口与当前源码一致，Mac 严格签名检查通过；安装包和 NAS ZIP 完整性、SHA256 校验通过。Windows/NAS 真机尚未验证。
- 本轮仅本地，未推送、未创建 GitHub 标签或 Release。


## 2026-11-01 · 0.4.2-preview.6 本地更新

- 最终构建、50 项单元/资源/存储测试通过，新增拼音/换行文本范围、原生高亮几何、球标相对字号、素材名称/标签、填充密度和比例滚轮测试。
- 搜索真实画布像素回归通过：文字/全拼/首字母/混合拼音、六主题画布与列表高亮、选中定位、清空高亮不写文档；全览右键保留视图且只抑制那次菜单。
- 球标真实原生 S/M/L/XL 调整通过：放大球标的各档字号均随图形变化，普通文字仍使用原生固定档位，下一球标继承尺寸和字体。
- WebDAV 实际 PROPFIND/PUT/GET 测试通过：未配置时本机网络在线事件不会显示在线；服务成功绿灯，503 失败灰灯，恢复服务重新连接变绿；移除设置后灰灯。约每分钟和窗口聚焦复查，仅做状态探测，不自动同步。
- 素材库实际测试通过：独立搜索、名称/标签持久化、v1/v2 兼容、展开缩略图、原生 MIME 拖入画布、保存后重开使用。真实官方目录联网读取到 232 个素材包，展开 R Icons 并显示预览；没有逐一验收全部素材包，部分历史素材可能缺少图像资源。
- 填充真实 SVG 与画布回归通过：斜线和交叉线密度变化，交叉始终保留 fillStyle 且 SVG 含两组线，实心导出完全一致。滑块按 1% 调节，32ms 合并预览，实际拖动值单调无回跳，鼠标/失焦与辅助输入完成最终提交并可通过原生撤销按钮一次撤销。0.18.1 预览版本先同步恢复手势基线再捕获最终值，避免预览被原生未提交版本过滤；两次源码测试和最终 Mac 实包通过。测试直接点击原生撤销按钮，避免额外的选区点击形成独立历史。
- 演示画笔提供同一密度控件，临时内容不进入文档。六主题均检查密度控件可见、边界与实际截图；在线素材面板打开时工具栏避让并可水平滚动，不覆盖搜索框。
- 滚轮真实测试通过：按比例细调、单事件限幅、保留原生鼠标锚点；此前绘图/撤销/场景/动画/文件/备份/重启及 NAS Chrome 往返曾通过；本次最终补跑完整桌面回归两次均停在演示临时画笔快捷键撤销（预期 0 笔，实际仍 1 笔）。此项保留为未解决问题，不宣称完整回归通过。
- Mac 图标可见范围扩大，按比例留透明安全边距；ICNS 资源和四边全部透明防裁边检查通过。
- Mac 最终实包填充/缩放/素材/搜索交互均通过；Windows 与真实 NAS/Docker、所有社区素材包仍待实机验收。Mac 为临时签名，未公证。未上传 GitHub。


## 2026-11-01 · 0.4.2-preview.5 本地更新

- 最终构建与 41 项单元/存储/服务测试通过，覆盖 HTTPS 校验、显式站点授权、远程文件访问拒绝、素材库来源/重定向校验、当前会话安装令牌以及语言字典。
- `iteration5.e2e.mjs` 在源码 Electron 与最终 Mac 实包均通过：搜索文字并定位、中英文切换与重启保留、工具栏拖动及重启顺序、HTTPS 网页重开前零请求、拒绝/重新授权、拒绝 HTTP、普通网页无法访问父页面和 workspace、本地素材导入及当前会话安装确认。
- Cmd+S 和 Ctrl+S 分别在实际平移后验证修订写入和当前视图保存；此前完整桌面绘图/撤销/场景/动画打断/文件导入导出/备份恢复/重启回归通过。
- 六种主题逐一检查真实截图：工具图标中心差 <2px；工作区三排行高均 30px、相邻间隔 6px、搜索至根目录 8px。
- 实际本机 WebDAV PROPFIND/PUT/GET、加密凭据保存、状态下拉立即上传第二份备份、恢复到新文件夹及密码不进入备份通过。在线/离线事件更新圆点、窄侧栏菜单不越界通过。
- 视频原生拖动/缩放/删除/撤销、编辑与演示播放和进度、切场景暂停，以及自动整理回归通过。NAS Node/Chrome 保存、重载、手动视图保存和文件/备份往返通过。
- Mac/Windows 最终包版本均为 0.4.2-preview.5，共 200 个前后端脚本/样式资源逐项一致，新 Logo 与源文件一致；Mac 临时签名和压缩包、Windows 安装器压缩结构、NAS ZIP 完整性检查通过。
- 素材库桌面回传协议已写入 Mac Info.plist 和 Windows 打包配置；使用 macOS 实际自定义 URL 启动已回到当前运行的 Mac 实包，并要求安装确认。Windows 实际协议启动及浏览器安装按钮、不同第三方网站登录/跨域/防嵌入、真实 NAS/Docker 与 Windows 运行仍需实机验收；通用网页不提供统一自动暂停。
- 未提交、推送或发布 GitHub Release。Mac 仍为临时签名，未公证。


## 2026-10-31 · 0.4.2-preview.4 本地更新

- 构建和 36 项单元/存储/更新测试通过。更新测试覆盖语义版本、正式/测试渠道、拒绝降级、平台资产选择、SHA-256 校验、下载后篡改、错误重定向、缺少校验、取消下载。
- 实际 Electron `iteration4.e2e.mjs` 通过：Logo 设置、WeChat/Discord、球标手动宽高与字体继承、删除元素及跟随场景提示/不再提示、撤销与重做联动。
- 同一场景切换流程连续往返六次，临时画笔 DOM/编辑器实例保持不变；不再把旧 savedView 在切场景时重灌主视口。绘图/临时画笔/文件导入导出/备份恢复完整回归通过。
- 全览测试使用相距 100000 场景单位的内容，原生滚轮可低于 10%，显示仍为正比例；中键双击进入抓手全览，再次双击恢复原编辑比例。仅浏览过程未写文档修订。
- NAS Node/Chrome 文件打开、保存和备份回归通过。
- 实际只读核对 GitHub：v0.4.1/v0.4.0 均标记 prerelease。更新模块从假定旧版 0.4.0 正确发现 v0.4.1 arm64 安装包及 GitHub SHA-256。没有新建/修改 Release，也没有下载或执行网络安装器作为测试。
- 当前更新能力为自动检查、可选自动下载和校验；Windows 安装器启动待实机验证。当前 Mac 临时签名和 Windows 免安装版只提供手动替换入口；NAS 容器仍由管理员更新。
- Mac 最终包内的 GitHub 测试渠道检查界面通过实际网络验证，高版本正确提示没有更新；Mac/Win 共 197 个前后端脚本与样式资源逐项一致。尺寸元数据的宽/高也有导入校验保护。
- 待验证：不同 GPU 的逐帧闪烁、极大白板性能、Windows 实机安装及正式签名的 Mac 自动替换。


## 2026-10-31 · 0.4.2-preview.3 本地更新

- 构建与 27 项单元/存储/服务测试通过；球标手动编号校验、文字字体/颜色继承、定位等有独立测试。
- 实际 Electron 及打包后 Mac 均通过球标测试：1/2/3 连续放置，手动改为 7 后放置 7/8，圆形与绑定文字组合、正圆、Esc、撤销重做、重启后下一编号 9。
- 四种主题几何检查：原生工具/视频/球标 SVG 中心偏差 <0.6px；顶部操作按钮字体相同、高度一致；WebDAV 标题与说明按钮中心对齐。查看实际截图修正了编号设置被原生容器遮挡的问题。
- 完整 desktop.e2e 回归通过；NAS 部署目录真实 Node/Chrome 文件打开、保存、刷新、备份往返通过。Mac/Windows 192 个 JS/CSS/MJS 资源逐项一致，包版本均为 0.4.2-preview.3，Mac 签名校验通过。
- DS918+ 指南提供独立 PDF/HTML、Compose 和 Alpine/musl 专用 Dockerfile；Node 官方将 x64/musl 列为 Experimental，指南要求先进行实机 Node/SQLite 预检。未宣称已在真实 DS918+、Docker 或 Windows 验收。
- 图文指南保存在工作区 output/pdf，不随代码自动上传 GitHub；群晖操作图为自制示意，应用图为本机实际截图。


## 2026-10-30 · 0.4.2-preview.2 本地更新

- 构建通过。单元/资源/存储/服务测试 25 项通过；包括三种布局、整组/绑定文字/Frame 保持相对位置，以及 NAS 鉴权、跨站拒绝、修订冲突、备份恢复和重启持久化。
- `video-arrange.e2e.mjs`：阻塞播放器响应期间仍能原生拖动/缩放视频、中键平移；随后加载真实媒体测试 fixture，验证编辑与全屏演示播放/进度、切场景暂停、删除撤销、框选纵向等距整理、联动演示场景及 WebDAV 说明。fixture 不是外部平台可用性证据。
- `desktop.e2e.mjs` 完整回归通过：绘图、撤销重做、框选、场景排序/中断导航、演示临时画笔、文件导入导出、PDF、工作区备份恢复、关闭时保存与重启恢复。
- `web.e2e.mjs`：真实本地 Node 服务 + Chrome，验证绘图保存到 NAS SQLite、刷新恢复、手动保存视图、完整白板下载后重新打开保留场景，以及工作区备份下载。
- 新原生播放器容器实际联网：YouTube 与 Bilibili 各一个样本可播放，读取 currentTime 增长后调用暂停成功（约 0.85s / 0.30s）。这不保证所有地区、视频和账号内容可播放。
- 完整回归期间暴露的全屏排序指针释放与画笔焦点问题已处理，最终回归通过。视频使用官方 `restoreElements` 产生完整元素字段；播放器没有覆盖整个画布的交互层。
- 本地截图：自动整理面板、WebDAV 气泡、NAS 工作区已更新；未将视频 fixture 画面用作官方播放器展示。
- 打包后 Mac 视频/整理/演示测试通过；NAS 部署包实际 Node/Chrome 往返测试通过；Mac/Win 192 个 JS/CSS/MJS 资源逐项一致，版本均为 0.4.2-preview.2，压缩包完整性与 Mac 签名校验通过。WebDAV 开发运行时的实际上传/恢复与密钥加密验证通过；Mac 新签名包在“保存设置”步骤超时，可能涉及钥匙串首次授权，原因需人工核查，未自动处理系统密码。
- 待验证：用户真实 NAS、Docker 镜像构建、Windows 实机、复杂外连箭头的整理效果、不同浏览器的原生 PDF 打印保存。
- 网页 Bilibili 无公开暂停 API：切场景重载停止播放，可能重置进度。YouTube 使用播放器消息，桌面媒体暂停通过隔离 frame 完成。


## 2026-10-30 — development only, not a published binary

- Production build, syntax checks, 21 unit/resource checks, workspace regression and full desktop editing/export/backup regression passed. Schema migration adds creation time and manual position transactionally; historical creation times are approximated from their previous updated time. Legacy backup restoration and metadata retention are covered.
- Actual pointer-based same-parent sorting checks preserve parent IDs and persist across restart; name sorting uses numeric Chinese collation. Long titles truncate independently of the fixed-size tree icons. A real Mac UI capture is in `directory-sorting.png`.
- WebDAV UI exercised against a real local HTTP DAV fixture: encrypted settings, PROPFIND collection check, authenticated PUT/GET, credentials excluded from JSON backup, confirmation and additive restore, secret hidden from generic settings IPC, and removal of settings. Redirects are rejected, PUT uses If-None-Match, response size/time are bounded. Real NAS vendors, HTTPS self-signed certificate workflows, digest/OAuth authentication and automatic/two-way sync remain unverified or unsupported. Only Basic authentication is implemented; no certificate-verification bypass.
- Video fixture uses real HTML media and actual iframe controls in editing/fullscreen: play, pause and seek; manual and automatic scene changes pause playback without resetting currentTime. Reopening the document retains video elements. The remote frame has no workspace bridge. Network policy tests reject arbitrary hosts and renderer networking; approved player-frame resource requests are allowlisted.
- Real YouTube and Bilibili public sample players loaded and played in the Mac development app; media currentTime advanced and native pause retained it on both providers. The app supplies its bundle identity as the YouTube Referer and keeps the app toolbar outside the player area. Real provider seeking, all videos/regions/accounts, Windows playback, loss/recovery of network and provider-specific restrictions require broader verification. Small players must be zoomed to the minimum player viewport. PDF/image exports are static; they do not embed a playable video or guarantee video thumbnails.
- Existing 0.4.1 installers and tags are unchanged. No mind-map code or dependency has been added; that assessment stays outside the repository.

## 0.4.1 — release validation, 2026-10-25

- Final follow-label alignment was approved from an actual app screenshot: the muted label stays on the title row, right-aligned at 70% opacity. Added `rebuild-follow.e2e.mjs` verifies rebuilding a scene from the current canvas selection, unchanged title/ID, no-selection protection and persistence after restart. Rebuilt Mac arm64 and Windows x64 packages include both refinements; targeted linked-scene/trash and rebuild-follow checks passed on the final Mac package. Earlier five-suite results below predate these final UI/menu additions.
- Production build and all 18 unit/resource checks passed, including linked-scene range/binding/geometry updates, backup round-trip, malformed binding rejection and transactional trash purge of nodes/revisions/link settings.
- Final Mac arm64 packaged app passed all five suites, sequentially: `linked-scenes.e2e.mjs`, `local-update.e2e.mjs`, `appearance.e2e.mjs`, `workspace.e2e.mjs`, and the complete `desktop.e2e.mjs`.
- Actual native grouping, pointer dragging, undo/redo, deletion and undo-deletion updated linked scene bounds correctly. Linked IDs survived restart. Unit checks cover new group members, missing content and backup restoration. Geometry uses the official getCommonBounds API (including rotated content); there is no claim of exhaustive rotation/complex-bound-text coverage.
- Trash UI verified cancellation without deletion, confirmation and restart persistence. Only internal trashed records, revisions and file-link settings are purged; associated files and existing backups are untouched. Nested deleted folders are detached before transactional deletion to preserve foreign-key integrity.
- Layout checks verify Region and Selected Elements on the same row, Current View below; all four themes retain subdued directory highlights to the right of guide lines without the inset crescent, and hidden-sidebar corner controls remain separated across 1000/1200/1440px widths.
- Earlier local 0.4.1 checks for fit-all without autosave, Shift scene deletion confirmation, large single/two-page PDF output and temporary-file cleanup remain green. The complete suite also passed native drawing and ink undo/redo, scene ordering/fullscreen/autoplay, imports/exports, external file conflict protection, backup/restore, storage migration and restart. Prior intermittent ink/fullscreen-drag failures are historical observations; this passing run does not establish their root cause was fixed.
- Mac ad-hoc signing and Windows x64 cross-builds complete; Windows runtime, Authenticode signing and Apple notarization remain unverified/unconfigured. README contains product features and real current screenshots; history and test details stay in dedicated documents.

## 0.4.1 — earlier local-only validation, 2026-10-25

- Production build and 15 unit/resource checks passed. New scene-range checks cover forward/reverse ranges, reordered scenes and missing anchors. ICO/ICNS structure, Mac visible bounds and transparent corners are checked.
- Actual Mac arm64 packaged `local-update.e2e.mjs` passed: double-middle-click fits two distant rectangles entirely within the viewport without creating an autosave revision; manual Save then verifies the resulting viewport. Shift selection, cancellation, confirmed batch deletion and unchanged drawing elements were checked in both editing and fullscreen; deleting the last presentation scenes exits presentation and survives restart.
- Large-image PDF regression passed with an image data URL over 4,000,000 characters: single and two-page outputs have valid PDF headers; pdfinfo confirms one/two landscape A4 pages. Invalid-image export fails without creating an output file and removes its temporary directory. The fix uses local PNG/HTML files, waits for image decoding and cleans up the print window/files.
- Actual packaged appearance checks cover four themes, 1000/1200/1440px window widths, hidden-right-sidebar corner spacing and actual export-menu clicks. Tree highlight pseudo-element begins to the right of the deepest indentation guide and has no inset/crescent marker in every theme. Theme preferences and independent sidebar restart checks continue to pass.
- Packaged workspace regression passed ancestor highlighting, moves/restart, context forms, indentation, transparent logo corners, read-only editing protection, automatic loop wrap/stop and preferences.
- Mac/Windows packages are local delivery only. No 0.4.1 GitHub Release, tag or software asset upload is authorized. Only CHANGELOG.md and NEXT-ITERATION.md are synchronized as requested. No Windows runtime or distribution signing/notarization; earlier full-suite temporary-ink undo/fullscreen-drag intermittence is not claimed fixed.

## 0.4.0 — 2026-10-25

- Production build and all 15 unit/resource checks passed. New checks cover four complete theme definitions, safe preference fallback, readable text contrast and center-preserving 100% zoom.
- Actual final Mac arm64 packaged application passed `appearance.e2e.mjs`: four themes without document/revision mutations, per-theme directory icons, identical fixed 20px palette, aligned header controls, computed subdued tree backgrounds, independent sidebars and restart persistence, real double-middle-click 100% zoom without autosave, custom menu and removal of Help header links. Mac shortcut labels and simulated Win32 navigator labels were checked; the latter is not a Windows runtime test.
- Packaged workspace regression passed directory ancestors, move/restart, menus/forms, indentation, transparent logo corners, read-only pointer/Delete protection and automatic loop wrap/stop/persistence. The final tree highlight priority correction was separately checked by computed styles and screenshots in all four themes.
- Complete packaged regression is **not fully green**: attempts stopped at the previously observed native temporary-ink undo assertion, and two attempts at the reverse fullscreen scene drag. A subsequent slower real-pointer drag run passed the two directions but stopped at native ink undo. These failures remain open; no claim is made that this version fixes them. A separate diagnostic run excluding only the failing native-ink undo/redo block passed the later flows: native main-editor undo/redo, library import, file/export/import, PDF/region outputs, external-file conflict protection, backup/restore, storage migration, close flush and restart. That diagnostic pass cannot substitute for a full pass.
- Both Windows x64 NSIS and portable outer archives passed 7-Zip tests; Mac deep/strict ad-hoc signature passed. Bundled versions are 0.4.0, Mac ICNS matches source, and all 193 packaged JS/CSS files match byte-for-byte across Mac/Windows. MIT and third-party notices are present. No Windows runtime, Authenticode signing or Apple notarization.
- README theme and menu images are captured from the final running packaged application. The 0.4.0 logo silhouette is refined and alpha bounds are checked, but no fresh Finder side-by-side comparison was completed for this artwork.
- Published three binaries on the GitHub v0.4.0 pre-release. GitHub asset SHA-256 values match the local delivery files: Mac `aea345333ef7ddf7295696bf7b0d148e83a81f03864892e306a05ab3b7c58186`, Windows Setup `ae72238bf6fb91ebefc23b3178f7e05750249aec108779072145636f98389a18`, Windows Portable `d8af6cc50741dd2f10b50634fe9b89e0eeb9680e3a6d050c4a32c4a34a722e33`. The installers and corrected `v0.4.0` tag correspond to development commit `c15b4396b52e1566a4da2e3e047cff531b2c1075`. The initially incorrect web-created tag was corrected with explicit user authorization using a guarded one-time workflow ([successful run](https://github.com/layzerff/excalidraw/actions/runs/40178526840)); the workflow was immediately removed in commit `f5ef5b01359f1ddaa626a467d7d618f69d14228d`. No installer asset changed during the correction.

## 0.3.0 — 2026-10-25

- Production build and 12 unit/resource checks passed, including regular/retina ICNS entries and decoded RGBA bounds for the Mac platform icon (transparent padding and approximately 832px artwork).
- Actual Mac arm64 packaged application passed the extended workspace regression: keyboard-triggered row-local menu, action groups without embedded fields, destructive styling, independent focused rename form, successful rename, non-empty-folder error in the popover, cancel without deletion, Home/End/Escape focus navigation, choosing a move target without moving until confirmation, ancestor highlighting, native read-only protection, looping presentation, uniform fonts and restart preferences.
- The first complete editor regression attempt stopped at the previously observed native temporary-ink undo assertion. A second full packaged run passed drawing/undo/redo, scene selection/reordering/navigation, fullscreen layers/autoplay/ink, file links/conflict protection, graphics/PDF/document exports/imports, backup/restore, migration, close-time flush and restart. This is not a claim that the underlying intermittent ink-history issue was fixed.
- Finder icon view on macOS 26.6.2 was inspected side-by-side with a system Calculator reference. The platform-specific ICNS showed comparable visible size and no obvious extra surrounding plate. The temporary reference link and task-created Finder window were cleaned up; no installed application was replaced and no icon cache was reset.
- Mac packaged ICNS matches the committed source; deep/strict ad-hoc signature verification and ZIP integrity checks passed. Windows main EXE, NSIS installer and portable launcher retain the approved custom icon, and both executable archive tests passed. All 193 packaged JS/CSS files match byte-for-byte between Mac and Windows. No Windows runtime test, Apple notarization or Authenticode signing.
- New menu screenshots are element captures from the running packaged app, not design mockups; overall and presentation/export screenshots were refreshed from actual regression runs.

## 0.2.2 — 2026-10-25

- Production build and all 11 unit/resource checks passed.
- Actual Mac arm64 packaged application passed `workspace.e2e.mjs`: loop off by default, wrap from last page to first while still playing, turning loop off stops at the last page, restart remembers the toggle without starting playback; read-only mode prevents real pointer drag and Delete from modifying native elements; transparent alpha at all four logo corners; larger SVG home/chevrons; existing nested-directory, ancestor-highlight, uniform-font and restart checks.
- Actual Mac packaged application also passed the full `desktop.e2e.mjs` regression on this iteration: native drawing and undo/redo, scene selection/order and animation, fullscreen layers/autoplay/native ink, graphic/PDF/document export and import, file links/conflict refusal, backup/restore, migration, close-time flush and restart. Earlier versions' intermittent native-ink undo failures remain historical observations; this is a passing run, not evidence that their underlying cause was fixed.
- Windows main EXE, NSIS installer and portable launcher contain the exact custom 256px PNG from the ICO; outer archive integrity checks passed. Mac ICNS matches the source and deep/strict ad-hoc signing passed. Windows runtime remains unverified; no Windows Authenticode or Apple notarization.
- Native tool-lock semantics were verified directly in the installed official Excalidraw 0.18.1 `LockButton` and Chinese locale: “绘制后保持所选的工具栏状态”. Independent read-only browsing uses official `viewModeEnabled`, not mass changes to element `locked` values.

## 0.2.1 — 2026-10-25

- Production build and 11 unit/resource tests passed (9 storage/navigation checks plus ICO/ICNS structure and sizes).
- `tests/workspace.e2e.mjs` passed on the actual macOS arm64 packaged application: two ancestor folders highlighted on launch, unrelated-folder click followed by reopening the active file, switching documents across branches, 28px indentation and two guide lines, moving the active document and restarting, uniform 14px controls/layers, and the loaded custom logo. Captured `workspace-021.png` and `presentation-021.png` from the running app.
- Windows main EXE, NSIS installer and portable launcher each contain the exact 256px PNG from the committed custom ICO. Mac bundled `icon.icns` is byte-identical to the committed ICNS. Both Windows executable archives passed integrity checks; Windows runtime and shell icon cache behavior remain unverified.
- Mac deep/strict ad-hoc signing passed; no Apple notarization or Windows Authenticode certificate.
- The broader `desktop.e2e.mjs` run stopped at the previously observed native presentation-ink undo assertion on two attempts. Earlier drawing, navigation, layers and uniform-control-font checks passed, but the full suite is **not green** in this iteration. This does not replace a complete regression pass; keep the ink-history issue open.

## 0.2.0 — 2026-10-20

- Production build and all 9 storage/navigation unit tests passed.
- Actual macOS arm64 packaged app passed the complete Electron regression: native drawing/undo/redo, scene selection/reordering, fullscreen layers/autoplay/native ink, export/import, backup/restore, closing and restart.
- New UI assertions passed: no top-level new-board button; root/folder context creation; folder icon and larger/bolder label; move menu; real file drag into a folder and back to root; keyboard sidebar resize; Save As file association; file-info path; manual write-back; external-change refusal preserving original bytes; system-picker reopening; migration and restart.
- Fast synthetic input during macOS fullscreen transitions produced intermittent scene-drag/ink-undo failures in preliminary runs. The packaged regression waits for the native fullscreen transition and new editor history baseline, and uses stepped real mouse input for scene drags. No claim is made that every transition-time race is resolved.
- macOS package version is 0.2.0; deep/strict ad-hoc signature verification passed. No Apple Developer ID notarization.
- Windows x64 NSIS installer and portable EXE built at 0.2.0; both outer archive integrity tests passed. Windows runtime remains unverified and no Authenticode certificate is configured.
- Real packaged screenshots updated under `docs/local-canvas/`; latest file-tree image is `files-current.png`.

Base: official Excalidraw fork `layzerff/excalidraw`, upstream commit `4c37956ba5f04ec342a9d9d5891a38f22c5b7b4e`. Implementation branch: `codex/local-canvas-p0`.

Validated on macOS Apple Silicon with Node 26.8.1, Electron 44.9.0 (Node 24.22.0, SQLite 3.53.4), React 18.3.1, official Excalidraw 0.18.1.

| Check | Result |
| --- | --- |
| Production renderer build | Passed |
| Storage and navigation unit tests | 9 passed |
| Real Electron editor regression | Passed |
| Built macOS application regression | Passed |
| Native rectangle / undo / redo | Passed |
| Scene region / capture view / title / order | Passed |
| Animated viewport and Escape interruption | Passed |
| Document switching and restart | Passed |
| Full document and standard Excalidraw export | Passed |
| Full document import | Passed |
| Workspace backup / non-overwriting restore | Passed |
| Close with pending save and recover on restart | Passed |
| Production dependency audit | 4 low; 0 moderate/high/critical |
| Windows build and runtime | x64 NSIS/portable cross-build and archive checks passed; runtime not run |
| Full upstream editor test suite | Not run; editor source unchanged |
| Public release signing and notarization | Not configured |

The desktop regression uses real pointer and keyboard events and real filesystem/SQLite operations. Native open/save dialogs alone are replaced with predetermined paths in the isolated test profile. Screenshot: `desktop/test-results/desktop.png` (generated, not committed).

Current deliverable is a runnable development milestone, not a signed public release. Follow-up coverage: text/IME, arrows, freehand, frames, image clipboard, library import, stylus/touch, very large boards, Windows installer and full native-feature regression. Scene-area adjustment is implemented by redrawing the region; precision handles are not yet implemented. All remote editor services are disabled.

## Scene/presentation update

Expanded real Electron regression verifies Excalifont/Virgil/Xiaolai font faces load offline, the 0.5-second option, real bidirectional handle dragging, sidebar hiding/showing, fullscreen enter/exit, temporary ink creation/clearing on next page and unchanged document elements. A compatible local library fixture is imported twice to verify deduplication, then retained through document export/import, backup restore and restart.

PDF smoke tests cover scene pages and the whole-board path; generated samples are under test-results/ for visual inspection. Current export rasterizes the board, so searchable text/vector output is not claimed. Third-party library testing covers the standard format fixture, not all remote catalogs and image dependencies. Windows, IME/stylus, huge boards and arbitrary user fonts remain unvalidated.

Final macOS packaged regression passed after the PDF scale correction, single top-right panel toggle and removal of the header font menu. Native text input was exercised with `ABCabc 中文手写` through the canvas font controls. Whole-board PDF and both scene pages were rendered with Poppler and visually inspected: complete lettering, correct board placement and no clipped content. The first scene intentionally contains no artwork; the second contains the rectangle. Current screenshots: `docs/local-canvas/desktop-current.png`, `docs/local-canvas/presentation-current.png`. All 9 storage/navigation tests passed.

## macOS archive integrity correction

The previous archive passed ZIP CRC checks but the application retained an incomplete Electron signature (`code has no resources but signature indicates they must be present`). The `afterPack` hook now ad-hoc signs the complete bundle and requires deep/strict verification before archives are created. The new ZIP was extracted into a fresh temporary directory; its application passes `codesign --verify --deep --strict` and the full real Electron regression. Ad-hoc integrity signing is not Developer ID certification or notarization, and does not establish Gatekeeper trust for downloaded apps.

## Context menus, native ink, export scope and save behavior

The final signed macOS bundle passed the expanded real Electron regression. Verified: scene context-menu rename/move, inline Enter commit and Escape cancellation, pointer-captured bidirectional ordering, removal of scene library import/count/action buttons, and Save located after the two create buttons in the workspace row.

Presentation uses the official native freedraw engine and native styling panel in an independent editor. Actual strokes, native undo/redo, color selection, page-change cleanup and exit were exercised; original document elements remain unchanged. No temporary editor data is connected to save/import/export/backup. Local library import regression now uses the original editor's file-drop path rather than the removed scene button.

The unified export menu was tested with full document, Excalidraw, whole-board PDF, scene PDF and a manually selected region. Region PNG dimensions are checked against the selected bounds (540 × 160 px for a 270 × 80 region at 2×); region SVG and PDF files are generated. PNG and rendered PDF were visually checked for complete Chinese/English lettering and correct cropping. Editable formats intentionally preserve the entire document.

Database revisions remain unchanged after interrupted scene animation, completed animation and wheel panning. Cmd/Ctrl+S and the workspace Save button commit the current view. A subsequent pan followed by a real shape color edit autosaves the changed color while retaining the previously manually saved viewport. Existing switching, restart, backup/restore and close-time content flush checks still pass. All 9 storage/navigation unit tests passed. Developer ID notarization and Windows runtime testing remain outstanding.

## 2026-10-18 presentation and storage regression

Expanded real Electron tests repeat clicks on the active whiteboard and press Save before entering fullscreen, reproducing the old API-null trigger. Navigation and presentation remain operational. The editing sidebar has no duration selector; presentation starts at the first scene and exposes exactly 500/1000/1500/2000 ms. Actual autoplay advances to the final scene and stops. The fullscreen Layers panel is exercised with real bidirectional pointer dragging and context-menu inline renaming. Native ink drawing, undo/redo and original-document isolation remain covered after these actions.

Save As produces a full document containing scenes. The actual storage-location panel is checked against the isolated test profile. The test migrates the workspace and backups through the UI, closes the application while editing is locked, relaunches using the profile's storage-location pointer, and verifies the active document's scene/text data and new displayed database path. The original workspace is retained; nonempty destinations are rejected by the implementation. External-drive disconnect/reconnect and Windows runtime validation remain outstanding.

Final result: the signed macOS packaged application passed the complete expanded desktop regression, including actual fullscreen-layer dragging, first-page entry, auto advance/stop, repeated-document-click recovery, native undo/redo, Save As and storage migration across restart. All 9 storage/navigation unit tests also passed. Updated real screenshots are stored under docs/local-canvas/.

Save/dwell refinement adds actual button bounding-box assertions: Save lies below the create row and aligns vertically with Save As. The autoplay test confirms a default three-second dwell, selects one second, and observes automatic advancement and stopping at the last page, separately from the selected 500 ms movement duration.

## Windows x64 cross-build — 2026-10-18

Built with `npm run build` followed by `npx electron-builder --win --x64` on macOS Apple Silicon. Electron 44.9.0 Windows x64 runtime was bundled successfully. Outputs: NSIS installer (126,703,552 bytes) and portable EXE (126,536,621 bytes). Both outer NSIS archives pass 7-Zip integrity tests. The unpacked application executable is PE32+ x86-64; app.asar contains 449 entries, including main/preload scripts, 238 WOFF2 fonts, Excalidraw MIT license and third-party notices. PE certificate tables are empty (no Authenticode signature). No Wine/Windows host was available, so actual installation/startup, input methods, fullscreen, PDF printing and storage migration on Windows remain unverified.

The installer's embedded `app-64.7z` was extracted and its integrity test also passed (73 files, 408,086,267 uncompressed bytes). Copies placed in task outputs have matching SHA-256 values: installer `26648d197c7b01d16c267ac3691762c71d65ebd2cb9bdba3cea01da6eb7a010b`; portable `de3e42a3504c3d9de00d819f08402e469ce6656a2d08a1068762020db277df5d`.
