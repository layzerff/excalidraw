# Local Canvas 网页版 / NAS 部署

这是单账号 NAS 工作区：浏览器运行同一套画布，文件树、白板内容、场景和素材库保存到 NAS 的 SQLite。桌面版与网页版的数据库彼此独立，通过完整白板或工作区 JSON 迁移；不是桌面工作区自动同步，也不提供多人实时协作。网页必须经 HTTP(S) 服务打开，不能双击 index.html。

## NAS 需要具备什么

- 支持 Docker/Container Manager（64 位 x86_64 或 ARM64），或安装 Node.js 24.13+。目前没有在用户的真实 NAS 上试装，Docker 镜像也需在 NAS 首次构建验证。
- 分配一个可持久写入的本地目录，放 SQLite、备份和加密密钥。数据库不要放在 SMB/WebDAV 远程挂载盘；不同容器不要共用同一个数据库。
- 内网开放选定端口，示例为 8088。通过域名使用时，在 NAS 反向代理配置 HTTPS 和有效证书，保留原始 Host，转发到容器 8080。建议独立域名根路径，如 `https://canvas.example.com/`，暂不支持路径前缀部署。
- 设置独立账号和至少 12 字符密码。内置 HTTP Basic 登录保护；公网使用必须 HTTPS，优先经 VPN 访问。NAS 与浏览器都需要能够访问相应视频站点，视频流量在浏览器端，不经过 NAS 转码。
- 反向代理允许单次约 210 MB 请求、至少 60 秒超时，以导入大备份。文档上限 100 MB，WebDAV 备份上限 200 MB。

## Docker Compose

部署压缩包解压后已有 `dist/`，无需在 NAS 安装 npm 依赖。如果使用源码，先在 `desktop` 运行 `npm ci --workspaces=false && npm run build`。

进入解压目录的 `web/`，创建 `.env`（不要上传 GitHub）：

```dotenv
CANVAS_USERNAME=your-user
CANVAS_PASSWORD=请替换为足够长的随机密码
```

创建持久化目录，允许容器 node 用户（UID/GID 1000）读写：

```sh
mkdir -p data
sudo chown 1000:1000 data
chmod 700 data
chmod 600 .env
docker compose up -d --build
```

如果 NAS 不允许修改所有者，可按 NAS 用户实际 UID/GID 设置 Compose 的 `user: "UID:GID"`，并让 data 属于该用户；不要简单设为全员可写。

打开 `http://NAS内网IP:8088`，输入上述账号密码。保存路径为 `web/data/workspace.sqlite`（容器内 `/data/workspace.sqlite`），工作区管理→保存位置可以确认服务实际使用位置。升级时保留 data 与 .env，只替换程序文件、重建容器；不要删除持久化目录。

## 无 Docker 的 Node 启动

在解压根目录启动 Node，配置进程管理器/系统服务维持运行：

```sh
export CANVAS_USERNAME=your-user
# 在服务管理器安全配置 CANVAS_PASSWORD，避免写入共享脚本
export LOCAL_CANVAS_DATA=/你的NAS本地目录/local-canvas-data
export HOST=0.0.0.0
export PORT=8088
node web/server.cjs
```

缺少账号或密码不足 12 字符会拒绝启动。默认 HOST 是 127.0.0.1；设置 0.0.0.0 后才允许其他设备访问。

## 文件打开、保存与恢复

- “打开文件…”在浏览器选择 `.canvas.json` / `.excalidraw`，导入 NAS 工作区，保留 Local Canvas 场景信息。可以选择浏览器可见的 NAS 共享文件。
- 编辑自动保存到 NAS；显示“已保存到 NAS 工作区”才表示服务器已确认写入。切文档/演示/导出前等待保存。网络失败保持未保存状态，可重试或“导出未保存副本”；不要在错误状态强制关闭页面。断网或进程强退仍可能丢失尚未提交的编辑。
- 手动保存还记录当前视图。浏览器自动保存到 NAS 不会自动覆盖你最初选择的本地文件。
- “另存为”：支持 File System Access API 的 HTTPS 浏览器可选路径并在会话内手动写回；其他浏览器或普通内网 HTTP 使用浏览器下载。浏览器不能透露本地完整路径，具体位置由浏览器下载设置决定，不能声称已写回原始文件。
- 完整文档/工作区 JSON 可与桌面版互相导入。浏览器 PDF 入口打开系统打印界面，目标选“另存为 PDF”；不采用 Electron 的直接 PDF 文件写入方式。图片/PDF 不包含可播放视频。
- WebDAV 仍是手动备份，服务端访问 NAS WebDAV 目录，避免浏览器 CORS 限制。密码用 AES-256-GCM 加密；密钥在 data/.webdav-key，需保护并随完整 data 迁移。导出的 JSON 备份不含连接密码。
- 每次启动及有改动时每 10 分钟生成工作区 JSON 快照，正常关闭也保存快照，最多保留 30 份。重要操作前仍建议点击“备份工作区”下载一份。
- 多浏览器写同一白板会触发版本冲突保护，拒绝覆盖；这不是协作服务。导出未保存副本后重新打开处理冲突。

## 视频与交互

顶部绘图工具栏的视频图标或画布菜单都可添加 YouTube/Bilibili 链接。直接显示播放器，默认不自动播放；编辑时单击边缘可选择，拖动/缩放使用原生手柄，Delete 删除，撤销可恢复。双击中心操作原生播放控件，点击空白或“返回画布编辑”退出操作。演示时直接操作播放器。

切换场景会暂停视频。桌面版通过隔离的官方播放器 frame 暂停媒体并保留进度；网页版 YouTube 使用播放器命令，Bilibili 因官方未公开暂停 API，切场景会重新载入播放器停止声音，回到该视频可能需要重新拖动进度。播放器若被区域、网络或嵌入权限限制，应按其提示处理；应用无法保证所有链接可用。

## 部署验证状态

已在本机启动实际 Node 服务，用 Chrome 验证登录、绘图保存、重新载入、完整文件下载再打开和工作区备份；接口验证未登录拒绝、跨站拒绝、版本冲突、恢复及服务重启持久化。Docker 文件已提供，但当前环境无 Docker，容器构建和真实 NAS/手机浏览器兼容待验证。

[Node SQLite 文档](https://nodejs.org/docs/latest-v24.x/api/sqlite.html) · [Docker 目录挂载说明](https://docs.docker.com/engine/storage/bind-mounts/) · [YouTube 播放器 API](https://developers.google.com/youtube/iframe_api_reference) · [Bilibili 外链播放器参数](https://player.bilibili.com/)

## 密码安全边界

WebDAV 密码在 NAS 数据库中是密文，但密钥保存在同一数据目录。管理员或能完整读取该目录的人可能解密；这不能代替磁盘权限、磁盘加密和 NAS 安全配置。JSON 工作区备份排除 WebDAV 密码。

当前网页登录密码从环境变量读取；Compose 使用 `.env` 时其中是明文，不是密码哈希。限制 `.env` 读取权限，勿提交代码库；容器/主机管理员仍可读取环境变量。HTTP Basic 认证本身不加密，只有 HTTPS 保护传输。此预览版暂无登录限速、MFA、独立多用户权限及完整安全审计，不应直接作为公网服务。后续正式部署需要调整密码配置、登录防护与强制 HTTPS。

### DS918+ 等旧内核机型

DS918+ 的 Apollolake 平台使用较旧 Linux 内核；Node 24 的 glibc 构建要求 Linux 4.18+。针对该机型提供 `web/Dockerfile.ds918`（官方 `node:24-alpine`、musl 路线）。Node 官方将 Linux x64/musl 标为 Experimental，仍须先在 NAS 执行 Node/SQLite 容器检查并验收，不能仅凭 Docker 套件支持认定可用。不要为此降级到过期 Node 或修改 DSM 内核。详细图文指南及专用 Compose 模板随本地交付提供。
