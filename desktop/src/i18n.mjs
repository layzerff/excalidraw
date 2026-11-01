// Shell UI only. Native Excalidraw uses its own en/zh-CN language bundles.
let language = 'zh-CN';
export function setLanguage(value) {
  language = value === 'en' ? 'en' : 'zh-CN';
}
export function getLanguage() {
  return language;
}
export const EN = Object.fromEntries(
  `
字号比例|Font scale
字号比例数值|Font scale value
本地素材库|Local library
新建素材文件夹|New asset folder
重命名文件夹|Rename folder
删除文件夹（保留素材）|Delete folder (keep assets)
素材目标文件夹|Asset destination folder
确认移动|Confirm move
素材文件夹名称|Asset folder name
素材保存位置|Asset storage
当前素材库文件|Current library file
默认素材位置|Default asset location
默认位于工作区的 materials 文件夹。更改位置会复制素材与文件夹结构，并保留原文件。|The default is the workspace materials folder. Changing location copies assets and folders, keeping the original file.
NAS 版请在容器配置中修改 /data 映射目录。|On NAS, change the /data mount in the container configuration.
更改素材保存位置|Change asset location
Ctrl + 滚轮调整素材大小|Ctrl + wheel to resize previews
滚轮缩放步长|Wheel zoom step
每个标准滚轮刻度的相对缩放幅度；触控板按移动量平滑调整。|Relative zoom per standard wheel tick; trackpads scale smoothly with movement.
关闭素材库|Close library
素材操作|Asset actions
项已选|selected
选择素材|Select asset
导出所选素材|Export selected assets
删除所选素材|Delete selected assets
删除素材|Delete assets
仅从素材库移除，不影响画布上已插入的图形。|Remove from the library only; inserted canvas shapes are unaffected.
确定删除|Confirm deletion
打开网页素材库|Open web library
保存设置|Save settings
设置已保存|Settings saved
Ctrl/Cmd + 滚轮或触控板捏合时生效；不改变缩放按钮。设置即时生效并自动保存。|Applies to Ctrl/Cmd + wheel and trackpad pinch, not the zoom buttons. Changes apply and save automatically.
搜索本地和在线素材|Search local and online assets
本地素材|Local assets
本地素材库为空|Your local library is empty
没有匹配的本地素材|No matching local assets
没有匹配的在线素材|No matching online assets
Excalidraw 在线素材库|Excalidraw online library
正在搜索在线素材|Searching online assets
部分素材包加载失败，在线结果不完整|Some packages failed to load; online results are incomplete
素材加载失败|Asset could not be loaded
素材栏宽度|Library panel width
排列|Layout
素材排列列数|Library columns
自动|Auto
最多|Up to
列|columns
随宽度自动适配|Adapts to panel width
网络连接状态；在线不表示 WebDAV 已连接或正在同步。|Network status; online does not mean WebDAV is connected or syncing.
WebDAV 未配置|WebDAV not configured
WebDAV 已配置，尚未验证连接|WebDAV configured; connection not tested
WebDAV 正在传输|WebDAV transferring
WebDAV 最近连接成功|Last WebDAV connection succeeded
WebDAV 最近操作失败|Last WebDAV operation failed
连接状态|Connection status
连接详情|Connection details
WebDAV 已连接|WebDAV connected
WebDAV 未连接|WebDAV disconnected
状态按 WebDAV 实际连接验证，约每分钟复查。立即同步上传完整备份，不进行双向合并或覆盖。|Status reflects authenticated WebDAV checks, repeated about every minute. Sync uploads a full backup without two-way merging or overwriting.
立即同步（上传备份）|Sync now (upload backup)
在线|Online
离线|Offline
）|)
正在打开…|Opening…
正在保存…|Saving…
已保存到 NAS 工作区|Saved to NAS workspace
已保存到本机|Saved locally
保存失败|Save failed
已保存到原文件|Saved to original file
已另存为文件|Saved as a file
请运行桌面应用：先 npm run build，再 npm start。浏览器预览不具备本地存储接口。|Run the desktop app with npm run build, then npm start.
请创建白板|Create a board first
场景 |Scene 
元素场景 |Linked scene 
先在画布选中元素或组合，再点“选择元素”添加场景|Select elements or a group, then choose Select elements to add a scene.
所选元素或组合包含锁定元素，请先解锁|Unlock the selected elements before arranging them.
已整理 |Arranged 
 个元素或组合| elements or groups
并添加到演示列表| and added to presentation
先在画布选中元素或组合，再右键场景选择“重建跟随”|Select elements, then right-click a scene and choose Relink.
已按当前所选元素或组合重建场景跟随|Scene relinked to the current selection
编辑器尚未准备好，请重新选择白板后重试|Editor is not ready. Reopen the board and try again.
新建文件夹|New folder
新建白板|New board
移动到文件夹|Move to folder
根目录|Root
左侧栏宽度|File sidebar width
右侧栏宽度|Scene sidebar width
展开|Expand
收起|Collapse
操作|Actions
 操作| actions
打开设置|Open settings
设置|Settings
Canvas 标志|Canvas logo
有可用更新 |Update available 
本地无限画布 · v|Local infinite canvas · v
工作区|Workspace
NAS · 网页版|NAS · Web
离线 · 本机|Offline · Local
本机工作区|Local workspace
文档保存到 NAS 工作区；WebDAV 仅用于手动备份|Documents are stored on NAS. WebDAV is for manual backups.
文档保存到本机；WebDAV 仅用于手动备份|Documents are stored locally. WebDAV is for manual backups.
保存内容与当前视图（Cmd/Ctrl+S）|Save content and current view (Cmd/Ctrl+S)
保存|Save
另存为|Save as
打开文件…|Open file…
搜索画布文字|Search canvas text
显示更多素材|Show more assets
未命名素材|Unnamed asset
拖入画布|Drag onto canvas
保存素材|Save asset
名称与标签|Name and tags
搜索当前素材库|Search current library
搜索素材：名称、标签、文字|Search names, tags, text
当前素材库|Current library
素材名称|Asset name
标签（逗号分隔）|Tags (comma-separated)
素材标签|Asset tags
在线素材库|Online libraries
展开素材包后，可将缩略图拖入画布。保存素材后可离线使用。|Expand a package, then drag a thumbnail onto the canvas. Save assets for offline use.
搜索在线素材目录|Search online catalog
正在加载…|Loading…
填充密度|Fill density
100% 为原生默认密度；实心保持铺满|100% is the native default; solid fills remain unchanged
拼音|Pinyin
搜索|Search
画布搜索结果|Canvas search results
匹配结果|Matches
未找到匹配文字|No matching text
未配置|Not configured
已配置 · 手动备份|Configured · Manual backups
正在传输…|Transferring…
最近操作成功|Last operation succeeded
最近操作失败|Last operation failed
右键新建白板或文件夹；拖入此处移回根目录|Right-click to create a board or folder. Drop here to move to root.
目录排序|Sort files
自定义（拖拽排序）|Custom (drag to reorder)
名称 A–Z|Name A–Z
创建时间（从早到晚）|Created (oldest first)
工作区管理|Workspace tools
保存位置|Storage location
WebDAV 设置|WebDAV settings
导入文档|Import document
回收站|Trash
备份工作区|Back up workspace
恢复备份|Restore backup
隐藏文件栏|Hide file sidebar
显示文件栏|Show file sidebar
选择或创建一张白板|Select or create a board
框选后自动等距整理|Select a region to arrange elements evenly
自动整理|Arrange
文件信息|File info
画布只读：禁止移动、编辑和删除全部元素；仍可平移缩放|Read-only: pan and zoom without editing elements
解除只读|Exit read-only
画布只读|Read-only
界面主题|Theme
重试保存|Retry save
导出未保存副本|Export unsaved copy
嵌入网页 / 视频|Embed web / video
自动整理元素|Arrange elements
把想法放在同一张画布上|Bring your ideas together
创建白板，自由绘制，再用场景整理你的思路。|Create a board, draw freely, and organize your ideas into scenes.
创建第一张白板|Create your first board
全览定位：拖动画布，双击中键恢复编辑比例；右键保留当前视图|Overview: pan, double-middle-click to restore editing zoom; right-click to keep this view
返回当前中心编辑|Edit at current center
拖出导出区域|Draw an export region
框住需要整理的完整元素|Enclose the elements to arrange
拖出场景区域|Draw a scene region
· Esc 取消|· Esc to cancel
场景|Scenes
为同一张白板保存不同区域，点击场景平滑导航。|Save regions of this board and navigate between them.
▶ 演示|▶ Present
＋ 框选区域|＋ Draw region
先选中画布中的元素或组合，场景将跟随它们移动|Select elements or groups; the scene will follow them.
＋ 选择元素|＋ Select elements
添加当前视图为场景|Add current view as scene
拖动排序|Drag to reorder
场景标题|Scene title
跟随关联元素和组合|Follows linked elements and groups
跟随|Linked
拖拽排序 · Shift 连选 · 双击改名 · 右键操作。|Drag to reorder · Shift-select · Double-click to rename · Right-click for actions
改名|Rename
重框（解除跟随）|Reframe (unlink)
重框|Reframe
以画布当前选中的元素或组合重新建立跟随|Relink to the elements or groups currently selected
重建跟随|Relink
上移|Move up
删除已选场景（|Delete selected scenes (
删除场景|Delete scene
导出|Export
导出选项|Export options
范围：|Scope:
已框选区域|Selected region
整张白板|Entire board
框选导出区域|Select export region
导出 PNG|Export PNG
导出 SVG|Export SVG
导出 PDF|Export PDF
场景 PDF|Scenes PDF
可编辑格式保存完整白板，包含区域外内容。|Editable formats include the entire board, including content outside the region.
导出完整文档|Export full document
导出 .excalidraw|Export .excalidraw
关闭导出|Close export
隐藏场景|Hide scenes
显示场景|Show scenes
图层|Layers
暂停自动演示|Pause autoplay
自动演示|Autoplay
循环演示|Loop presentation
开启后自动演示到末页会返回首页继续播放|After the last scene, return to the first and continue.
循环|Loop
：开|: On
：关|: Off
移动|Transition
演示移动时长|Transition duration
秒|s
停留|Dwell
自动演示停留时间|Autoplay dwell time
上一场景|Previous scene
下一场景|Next scene
临时画笔|Temporary pen
清除|Clear
退出演示|Exit presentation
白板|Board
文件夹|Folder
重命名|Rename
移入回收站|Move to trash
‹ 返回操作|‹ Back to actions
文件名称|File name
取消|Cancel
保存名称|Save name
移动到|Move to
只调整工作区目录，不移动磁盘上的关联文件。|This changes the workspace folder, without moving linked files on disk.
移动到此处|Move here
移入回收站？|Move to trash?
可在工作区回收站恢复。磁盘上的关联文件不会被删除；非空文件夹需先移出内容。|Restore from workspace trash. Linked files remain on disk. Empty folders before deleting them.
删除|Delete
个场景？| scenes?
只删除所选场景的导航区域，不删除白板上的文字或图形。|Delete scene navigation only. Board text and shapes remain.
另有|And
个场景。| more scenes.
确认删除|Confirm deletion
文件位置：|File location:
尚未另存为独立文件，请使用“另存为”选择位置。|Use Save as to choose a location for a standalone file.
内容自动保存到本机工作区；手动保存同时记录当前视图，并写回已关联的文件。|Content autosaves to the workspace. Manual save also records the view and updates the linked file.
本机恢复副本：|Recovery copy:
关闭|Close
回收站为空。|Trash is empty.
恢复|Restore
确认清空回收站|Confirm empty trash
永久清空回收站？|Permanently empty trash?
将删除|Delete
项及其历史版本，无法在回收站恢复。磁盘上的关联文件和已有备份保留。| items and their revisions permanently. Linked files and existing backups remain.
取消清空|Cancel
确认永久清空|Permanently empty
清空回收站|Empty trash
按视觉边界等距排列，组合、绑定文字和画框内容一起移动。可用撤销恢复。|Arrange visual bounds evenly. Groups, bound text, and frame contents move together. Undo is supported.
框选元素|Select region
已选择|Selected
个元素| elements
整理模式|Arrangement
纵向整理|Vertical
横向整理|Horizontal
阵列整理|Grid
元素间距|Spacing
整理后添加到演示列表（跟随所选元素）|Add to presentation after arranging (linked to selection)
应用整理|Apply arrangement
已恢复默认球标尺寸|Default balloon size restored
跟随场景已删除|Linked scenes deleted
所关联的元素已删除，同时移除了以下场景：|The linked elements were deleted, removing these scenes:
关闭提示后，撤销元素删除也会恢复对应场景。|Undo the element deletion to restore the corresponding scenes.
以后不再提示|Do not show again
知道了|Got it
网页或视频地址|Web page or video URL
请输入有效的 HTTPS 地址，不能包含用户名或密码|Enter a valid HTTPS URL without a username or password.
添加到画布|Add to canvas
工作区保存位置|Workspace storage
自动保存到 NAS 服务器 SQLite 工作区。打开文件从浏览器选择；另存为下载文件或由浏览器文件窗口选择位置。浏览器不会透露本地完整路径。|Autosaved to the NAS SQLite workspace. Open files using the browser picker; Save as downloads or lets you choose a file. Browsers do not expose full local paths.
自动保存到本机 SQLite 工作区；另存为可选择完整白板文件的位置。|Autosaved to the local SQLite workspace. Save as lets you choose a board file location.
自动备份：|Automatic backups:
已完整迁移，原位置保留。请重启使用新工作区。|Migration complete. The original remains. Restart to use the new workspace.
重启应用|Restart app
更改工作区位置|Change workspace location
请输入名称|Enter a name
确定|Confirm
尚未检查|Not checked
正在检查…|Checking…
发现新版本|Update available
未发现比当前更新的所选渠道版本|No newer version found in this channel
正在下载…|Downloading…
下载和校验完成|Downloaded and verified
更新失败|Update failed
设置界面主题|Settings theme
界面语言|Language
简体中文|简体中文
减少场景切换动画|Reduce scene motion
打开白板时默认只读|Open boards read-only by default
删除元素及其跟随场景后显示提示|Notify after deleting elements and their linked scenes
双击中键全览并切到抓手；再次双击中键恢复编辑比例，右键保留当前视图并继续编辑。|Double-middle-click for an overview and pan. Repeat to restore editing zoom, or right-click to keep the current view and edit.
重置球标尺寸|Reset balloon size
软件更新|Software updates
网页版由 NAS 管理员替换部署包并重新构建容器；浏览器不会自动修改 NAS 程序文件。|NAS administrators update the deployment package and rebuild the container. The browser does not modify server program files.
当前版本：|Current version: 
读取中…|Loading…
来源：|Source: 
本项目 GitHub Releases|Project GitHub Releases
更新渠道|Update channel
正式版|Stable
正式版和测试版|Stable and preview
启动后自动检查更新（之后每 6 小时检查）|Check after startup, then every 6 hours
发现新版本后自动下载并校验|Automatically download and verify updates
适用于本设备的安装包已找到。|An installer is available for this device.
该发布没有适合本设备的安装包。|No installer is available for this device.
检查更新|Check for updates
下载并校验|Download and verify
取消下载|Cancel download
启动安装|Start installer
打开已校验的安装包|Show verified package
查看全部发布|View all releases
安装前保存工作区。当前 Mac 包尚无 Developer ID 签名，下载后需手动替换应用；Windows 安装版可启动安装程序，免安装版需手动替换。不会自动降级或在编辑中退出。|Save before installing. Mac and Windows portable packages require manual replacement. Windows Setup can start the installer. No automatic downgrade or exit while editing.
更新说明|Release notes
关闭设置|Close settings
自增球标|Numbered balloon
自增球标：点击放置，Esc 退出|Numbered balloon: click to place, Esc to exit
球标设置|Balloon settings
下一编号|Next number
下一球标编号|Next balloon number
点击画布放置 · Esc 退出|Click to place · Esc to exit
修改编号后从该数字继续|Continue from the number you enter
调整工具栏顺序|Reorder toolbar
调整工具栏顺序：开启后拖动图标，再次点击完成|Reorder toolbar: enable, drag icons, then click again to finish
浏览在线素材库|Browse online libraries
导入素材库文件|Import library file
加载外部网页|Load external pages
加载外部网页？|Load external pages?
这些站点将收到你的网络请求，可能使用 Cookie 或加载其他资源。只批准你信任的内容；本次批准仅在当前文档打开期间有效。|These sites receive your network requests and may use cookies or load other resources. Approve trusted content only. Approval lasts while this document is open.
允许加载|Allow loading
保持阻止|Keep blocked
安装素材库|Install library
安装素材库？|Install library?
从官方目录下载并合并到当前白板素材库。请遵守素材许可。|Download from the official catalog and merge into this board's library. Follow the asset license.
下载并安装|Download and install
支持 HTTPS 网页、NAS 页面及 YouTube、Bilibili 视频。添加即表示允许加载该站点；打开已有文档时会重新询问。单击边缘选择、拖动或缩放，Delete 删除；双击中心操作网页或播放器。网站可能禁止嵌入，可在浏览器打开。仅专门适配的视频支持切换场景自动暂停。|Supports HTTPS pages, NAS pages, YouTube, and Bilibili. Adding a URL allows loading; reopening a document asks again. Select the border to move, resize, or Delete. Double-click the center to interact. Sites may block embedding; open them in a browser instead. Only adapted videos support pause on scene changes.
双击此区域后可操作按钮|Double-click this area to use the buttons
外部内容尚未加载|External content is blocked
选择是否加载|Choose whether to load
在浏览器打开|Open in browser
页面加载失败|Page failed to load
网站禁止嵌入或未显示？|Blocked or not displaying?
WebDAV 功能设置说明|WebDAV help
如何设置 WebDAV|Set up WebDAV
在 NAS 开启 WebDAV 服务，创建专用账号和备份文件夹，授予读写权限。|Enable WebDAV on your NAS. Create a dedicated account and backup folder with read/write permissions.
填写目录完整 URL（包括端口和文件夹路径），如 https://nas.example.com:5006/canvas/，优先使用有效 HTTPS 证书。|Enter the full folder URL, including port and path, such as https://nas.example.com:5006/canvas/. Prefer a valid HTTPS certificate.
填写账号密码，保存并测试连接，再上传工作区备份。测试检查读取，上传验证写权限。|Enter credentials, save, and test before uploading. The test checks reading; upload verifies writing.
恢复时输入上传得到的完整 JSON 文件名。内容会导入新文件夹，现有白板保留。|To restore, enter the complete uploaded JSON filename. Content imports into a new folder; existing boards remain.
这是手动备份，不是双向自动同步。密码不包含在导出的备份中。401/403 请核查账号和权限，404 请核查路径。|Manual backup, without two-way synchronization. Passwords are excluded from exports. Check credentials for 401/403 and paths for 404.
手动备份与恢复。不会自动同步或覆盖本机工作区；恢复内容导入新文件夹。请填写已存在的远程目录。|Manual backup and restore. No automatic synchronization or workspace overwrite. Restored content goes into a new folder. Use an existing remote directory.
服务器目录 URL|Server folder URL
WebDAV 地址|WebDAV URL
用户名|Username
WebDAV 用户名|WebDAV username
密码|Password
WebDAV 密码|WebDAV password
已保存，留空保留原密码|Saved; leave blank to keep the password
允许 HTTP（账号和备份将明文传输，仅用于可信网络）|Allow HTTP (credentials and backups travel unencrypted; trusted networks only)
连接设置已在 NAS 加密保存|Connection settings encrypted on NAS
连接设置已加密保存|Connection settings encrypted
保存设置|Save settings
连接成功（已验证目录访问；写入权限由上传验证）|Connected (directory access verified; upload checks write permission)
测试连接|Test connection
备份上传成功：|Backup uploaded: 
上传工作区备份|Upload workspace backup
恢复远程备份文件名|Restore backup filename
远程备份文件名|Remote backup filename
下载会读取上述连接的文件，验证格式后导入本机。大于 200 MB 的备份暂不支持。|Download validates and imports the file. Backups larger than 200 MB are not supported.
已恢复到新的文件夹|Restored into a new folder
确认下载并导入|Confirm download and import
取消恢复|Cancel restore
恢复指定备份|Restore backup
处理中…|Working…
已移除本机连接设置|Local connection settings removed
移除连接|Remove connection
 视频| video
视频加载失败|Video failed to load
重试|Retry
返回画布编辑 · Esc|Return to canvas · Esc
`
    .trim()
    .split('\n')
    .map((line) => {
      const i = line.indexOf('|');
      return [line.slice(0, i), line.slice(i + 1)];
    }),
);
const ZH = Object.fromEntries(Object.entries(EN).map(([zh, en]) => [en, zh]));
export function translate(value) {
  if (typeof value !== 'string') return value;
  if (language === 'en') {
    if (EN[value] !== undefined) return EN[value];
    const trimmed = value.trim();
    return EN[trimmed] !== undefined
      ? value.replace(trimmed, EN[trimmed])
      : value;
  }
  return ZH[value] || value;
}
