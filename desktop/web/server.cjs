// Single-user NAS service. Uses the same validated, revisioned SQLite store as
// the desktop app. No remote filesystem path is accepted from the browser.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const {
  downloadLibrary,
  libraryCatalog,
} = require('../electron/libraries.cjs');
const { Store, payload } = require('../electron/store.cjs');
const webdav = require('../electron/webdav.cjs');

function startServer(options = {}) {
  const directory = path.resolve(
    options.directory || process.env.LOCAL_CANVAS_DATA || './web-data',
  );
  const dist = fs.realpathSync(options.dist || path.join(__dirname, '../dist'));
  const username = options.username || process.env.CANVAS_USERNAME;
  const password = options.password || process.env.CANVAS_PASSWORD;
  if (!username || username.includes(':') || !password || password.length < 12)
    throw new Error('请设置 CANVAS_USERNAME 和至少 12 字符的 CANVAS_PASSWORD');
  fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
  const store = new Store(path.join(directory, 'workspace.sqlite'));
  const backups = path.join(directory, 'backups');
  fs.mkdirSync(backups, { recursive: true, mode: 0o700 });
  const keyfile = path.join(directory, '.webdav-key');
  if (!fs.existsSync(keyfile))
    fs.writeFileSync(keyfile, crypto.randomBytes(32), {
      flag: 'wx',
      mode: 0o600,
    });
  const key = fs.readFileSync(keyfile);
  function encrypt(value) {
    const iv = crypto.randomBytes(12),
      cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    return Buffer.concat([
      iv,
      cipher.update(value, 'utf8'),
      cipher.final(),
      cipher.getAuthTag(),
    ]).toString('base64');
  }
  function decrypt(value) {
    const bytes = Buffer.from(value, 'base64'),
      decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        key,
        bytes.subarray(0, 12),
      );
    decipher.setAuthTag(bytes.subarray(-16));
    return Buffer.concat([
      decipher.update(bytes.subarray(12, -16)),
      decipher.final(),
    ]).toString('utf8');
  }
  let changed = true;
  function snapshot() {
    if (!changed) return;
    const filename = path.join(backups, `workspace-${Date.now()}.json`);
    fs.writeFileSync(filename + '.tmp', JSON.stringify(store.backup()), {
      mode: 0o600,
    });
    fs.renameSync(filename + '.tmp', filename);
    changed = false;
    fs.readdirSync(backups)
      .filter((f) => /^workspace-\d+\.json$/.test(f))
      .sort()
      .slice(0, -30)
      .forEach((f) => fs.unlinkSync(path.join(backups, f)));
  }
  snapshot();
  const timer = setInterval(() => {
    try {
      snapshot();
    } catch (e) {
      console.error('备份失败', e.message);
    }
  }, 600000);
  timer.unref();
  const { LibraryStore } = require('../electron/library-store.cjs');
  const materials = new LibraryStore(store, directory);
  async function dav(method, filename, body) {
    const settings = JSON.parse(store.getSetting('webdavConfig') || 'null'),
      secret = store.getSetting('webdavSecret');
    if (!settings || !secret) throw new Error('请先保存 WebDAV 连接设置');
    return webdav.request(settings, decrypt(secret), method, filename, body);
  }
  const ops = {
    libraryCatalog: () => libraryCatalog(),
    libraryRead: (id) => materials.open(id),
    librarySave: (items) => materials.save(items),
    libraryOrganize: (folders, assignments) =>
      materials.organize(folders, assignments),
    libraryStorageInfo: () => ({ ...materials.info(), managed: true }),
    changeLibraryStorage: () => {
      throw Error(
        'NAS 版请修改容器 /data 的持久化映射；浏览器不能选择服务器目录',
      );
    },
    downloadLibrary: (value) => downloadLibrary(value),
    list: () => store.list(),
    read: (id) => store.read(id),
    create: (...args) => store.create(...args),
    rename: (...args) => store.rename(...args),
    move: (...args) => store.move(...args),
    reorder: (...args) => store.reorder(...args),
    trash: (...args) => store.trash(...args),
    emptyTrash: () => store.emptyTrash(),
    save: (id, data, revision) => store.save(id, data, revision),
    backup: () => store.backup(),
    restore: (value) => store.restore(value),
    importData: (parent, title, data) => {
      payload(data);
      return store.create('document', parent, title, data);
    },
    getSetting: (key) =>
      String(key).startsWith('webdav')
        ? null
        : ['sidebarWidths', 'collapsedFolders'].includes(key)
          ? JSON.parse(store.getSetting(key) || 'null')
          : store.getSetting(key),
    setSetting: (key, value) => {
      if (
        typeof key !== 'string' ||
        key.length > 100 ||
        key.startsWith('webdav') ||
        key.startsWith('documentFile:') ||
        key === 'libraryDirectory'
      )
        throw new Error('无效设置');
      store.setSetting(
        key,
        ['sidebarWidths', 'collapsedFolders'].includes(key)
          ? JSON.stringify(value)
          : value,
      );
    },
    storageInfo: () => ({
      folder: directory,
      database: path.join(directory, 'workspace.sqlite'),
      backups,
    }),
    fileInfo: () => ({
      file: null,
      database: path.join(directory, 'workspace.sqlite'),
    }),
    webdavInfo: () => {
      const v = JSON.parse(store.getSetting('webdavConfig') || 'null');
      return v
        ? { ...v, hasPassword: !!store.getSetting('webdavSecret') }
        : null;
    },
    webdavSave: (input) => {
      const value = webdav.config(input),
        previous = JSON.parse(store.getSetting('webdavConfig') || 'null');
      if (
        !input.password &&
        (previous?.url !== value.url || previous?.username !== value.username)
      )
        throw new Error('连接变更后需重新输入密码');
      const secret = input.password
        ? encrypt(input.password)
        : store.getSetting('webdavSecret');
      if (!secret) throw new Error('请输入密码');
      store.transaction(() => {
        store.setSetting('webdavConfig', JSON.stringify(value));
        store.setSetting('webdavSecret', secret);
      });
      return true;
    },
    webdavForget: () =>
      store.db
        .prepare(
          "DELETE FROM settings WHERE key IN ('webdavConfig','webdavSecret')",
        )
        .run(),
    webdavTest: () => dav('PROPFIND'),
    webdavBackup: async () => {
      const name = `local-canvas-${Date.now()}-${crypto.randomUUID()}.json`;
      await dav('PUT', name, JSON.stringify(store.backup()));
      return name;
    },
    webdavRestore: async (name) => store.restore(await dav('GET', name)),
  };
  const expected = crypto
    .createHash('sha256')
    .update(
      'Basic ' + Buffer.from(`${username}:${password}`).toString('base64'),
    )
    .digest();
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript',
    '.mjs': 'text/javascript',
    '.css': 'text/css',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.woff2': 'font/woff2',
    '.json': 'application/json',
    '.txt': 'text/plain; charset=utf-8',
    '.md': 'text/plain; charset=utf-8',
  };
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Cache-Control', 'no-store');
    const actual = crypto
      .createHash('sha256')
      .update(req.headers.authorization || '')
      .digest();
    if (!crypto.timingSafeEqual(expected, actual)) {
      res.writeHead(401, {
        'WWW-Authenticate': 'Basic realm="Local Canvas", charset="UTF-8"',
      });
      res.end('需要登录');
      return;
    }
    try {
      if (req.url === '/api/workspace') {
        if (
          req.method !== 'POST' ||
          req.headers['x-local-canvas'] !== '1' ||
          !req.headers['content-type']?.startsWith('application/json') ||
          req.headers['sec-fetch-site'] === 'cross-site'
        )
          throw new Error('拒绝跨站或无效请求');
        // A reverse proxy may supply HTTPS, so compare the origin host, not protocol.
        if (
          req.headers.origin &&
          new URL(req.headers.origin).host !== req.headers.host
        )
          throw new Error('来源不匹配');
        let size = 0;
        const chunks = [];
        for await (const c of req) {
          size += c.length;
          if (size > 210 * 1024 * 1024) throw new Error('请求超过 210 MB');
          chunks.push(c);
        }
        const { action, args } = JSON.parse(Buffer.concat(chunks));
        if (
          !Object.hasOwn(ops, action) ||
          !Array.isArray(args) ||
          args.length > 10
        )
          throw new Error('未知操作');
        const value = await ops[action](...args);
        if (
          ![
            'list',
            'read',
            'backup',
            'getSetting',
            'storageInfo',
            'fileInfo',
            'webdavInfo',
            'downloadLibrary',
            'libraryCatalog',
            'libraryRead',
            'libraryStorageInfo',
            'webdavTest',
          ].includes(action)
        )
          changed = true;
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({ value: value ?? null }, (_, v) =>
            typeof v === 'bigint' ? Number(v) : v,
          ),
        );
        return;
      }
      if (!['GET', 'HEAD'].includes(req.method)) {
        res.writeHead(405);
        res.end();
        return;
      }
      const pathname = decodeURIComponent(
        new URL(req.url, 'http://localhost').pathname,
      );
      const file = path.resolve(
        dist,
        '.' + (pathname === '/' ? '/index.html' : pathname),
      );
      if (
        !file.startsWith(dist + path.sep) ||
        !fs.existsSync(file) ||
        !fs.statSync(file).isFile() ||
        !fs.realpathSync(file).startsWith(dist + path.sep)
      ) {
        res.writeHead(404);
        res.end('未找到');
        return;
      }
      res.writeHead(200, {
        'Content-Type': types[path.extname(file)] || 'application/octet-stream',
      });
      if (req.method === 'HEAD') res.end();
      else fs.createReadStream(file).pipe(res);
    } catch (e) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
  });
  server.requestTimeout = 45000;
  server.headersTimeout = 15000;
  server.on('close', () => {
    clearInterval(timer);
    snapshot();
    store.close();
  });
  server.listen(
    options.port ?? Number(process.env.PORT || 8080),
    options.host || process.env.HOST || '127.0.0.1',
  );
  return server;
}
module.exports = { startServer };
if (require.main === module) {
  const server = startServer();
  server.on('listening', () =>
    console.log(`Local Canvas Web 已启动，端口 ${server.address().port}`),
  );
  for (const signal of ['SIGINT', 'SIGTERM'])
    process.on(signal, () => server.close(() => process.exit(0)));
}
