const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const REPO = 'layzerff/excalidraw';
function version(value) {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(value || '');
  if (!m) return null;
  return { core: m.slice(1, 4).map(Number), pre: m[4]?.split('.') || [] };
}
function compare(a, b) {
  a = version(a);
  b = version(b);
  if (!a || !b) throw Error('无效版本号');
  for (let i = 0; i < 3; i++)
    if (a.core[i] !== b.core[i]) return Math.sign(a.core[i] - b.core[i]);
  if (!a.pre.length || !b.pre.length)
    return !a.pre.length && !b.pre.length ? 0 : !a.pre.length ? 1 : -1;
  for (let i = 0; i < Math.max(a.pre.length, b.pre.length); i++) {
    if (a.pre[i] === b.pre[i]) continue;
    if (a.pre[i] === undefined) return -1;
    if (b.pre[i] === undefined) return 1;
    const x = a.pre[i],
      y = b.pre[i],
      nx = /^\d+$/.test(x),
      ny = /^\d+$/.test(y);
    return nx && ny
      ? Math.sign(Number(x) - Number(y))
      : nx !== ny
        ? nx
          ? -1
          : 1
        : x > y
          ? 1
          : -1;
  }
  return 0;
}
function assetFor(release, platform, arch, portable) {
  const assets = release.assets || [];
  return assets.find((a) => {
    const n = a.name.toLowerCase();
    if (platform === 'darwin')
      return (
        n.endsWith('.zip') &&
        n.includes('mac') &&
        (arch === 'arm64'
          ? n.includes('arm64')
          : n.includes('x64') || n.includes('x86_64'))
      );
    if (platform === 'win32' && arch === 'x64')
      return (
        n.endsWith('.exe') &&
        (portable ? n.includes('portable') : n.includes('setup'))
      );
    return false;
  });
}
function selectRelease(releases, current, channel, platform, arch, portable) {
  const candidates = releases
    .filter(
      (r) =>
        !r.draft &&
        version(r.tag_name) &&
        (channel === 'preview' ||
          (!r.prerelease && !version(r.tag_name).pre.length)) &&
        compare(r.tag_name, current) > 0,
    )
    .sort((a, b) => compare(b.tag_name, a.tag_name));
  const r = candidates[0];
  if (!r) return null;
  const a = assetFor(r, platform, arch, portable);
  return {
    version: r.tag_name.replace(/^v/, ''),
    name: r.name || r.tag_name,
    notes: String(r.body || '').slice(0, 12000),
    releaseURL: `https://github.com/${REPO}/releases/tag/${encodeURIComponent(r.tag_name)}`,
    asset: a
      ? {
          name: a.name,
          url: a.browser_download_url,
          size: a.size,
          digest: a.digest,
        }
      : null,
    checksums: (r.assets || []).find((a) => a.name === 'SHA256SUMS.txt')
      ?.browser_download_url,
  };
}
function assetURL(url) {
  const u = new URL(url);
  if (
    u.protocol !== 'https:' ||
    u.username ||
    u.password ||
    u.hostname !== 'github.com' ||
    !u.pathname.startsWith(`/${REPO}/releases/download/`)
  )
    throw Error('更新下载地址不属于本项目 Release');
  return u;
}
async function request(url, fetcher = fetch, signal, timeout = 30000) {
  let u = new URL(url);
  for (let i = 0; i < 6; i++) {
    if (
      u.protocol !== 'https:' ||
      ![
        'api.github.com',
        'github.com',
        'release-assets.githubusercontent.com',
        'objects.githubusercontent.com',
      ].includes(u.hostname)
    )
      throw Error('更新服务重定向地址不受信任');
    const r = await fetcher(u.href, {
      redirect: 'manual',
      signal: signal
        ? AbortSignal.any([signal, AbortSignal.timeout(timeout)])
        : AbortSignal.timeout(timeout),
      headers: {
        'User-Agent': 'Local-Canvas-Updater',
        Accept: 'application/vnd.github+json',
      },
    });
    if ([301, 302, 303, 307, 308].includes(r.status)) {
      u = new URL(r.headers.get('location'), u);
      continue;
    }
    if (!r.ok)
      throw Error(
        r.status === 403 || r.status === 429
          ? 'GitHub 请求限额已用完，请稍后重试'
          : `GitHub 更新请求失败（${r.status}）`,
      );
    return r;
  }
  throw Error('更新服务重定向过多');
}
class Updates {
  constructor({
    directory,
    current,
    platform,
    arch,
    portable = false,
    fetcher = fetch,
  }) {
    Object.assign(this, {
      directory,
      current,
      platform,
      arch,
      portable,
      fetcher,
    });
    this.state = { status: 'idle', current };
  }
  info() {
    return {
      ...this.state,
      current: this.current,
      platform: this.platform,
      portable: this.portable,
      source: `https://github.com/${REPO}/releases`,
    };
  }
  async check(channel = 'stable') {
    if (this.busy) return this.info();
    this.busy = true;
    this.state = { status: 'checking' };
    try {
      let list = [];
      for (let page = 1; page <= 3; page++) {
        const r = await request(
            `https://api.github.com/repos/${REPO}/releases?per_page=100&page=${page}`,
            this.fetcher,
          ),
          rows = await r.json();
        if (!Array.isArray(rows)) throw Error('GitHub 更新信息格式无效');
        list.push(...rows);
        if (rows.length < 100) break;
      }
      this.candidate = selectRelease(
        list,
        this.current,
        channel,
        this.platform,
        this.arch,
        this.portable,
      );
      this.state = {
        status: this.candidate ? 'available' : 'latest',
        checked: new Date().toISOString(),
        candidate: this.candidate,
        channel,
      };
      return this.info();
    } catch (e) {
      this.state = { status: 'error', error: e.message };
      return this.info();
    } finally {
      this.busy = false;
    }
  }
  async download() {
    if (this.busy) throw Error('正在检查或下载更新');
    const c = this.candidate;
    if (!c?.asset) throw Error('此版本未提供适合本设备的安装包，请查看发布页');
    assetURL(c.asset.url);
    if (
      !Number.isSafeInteger(c.asset.size) ||
      c.asset.size < 1 ||
      c.asset.size > 1024 * 1024 * 1024
    )
      throw Error('更新包大小无效');
    this.busy = true;
    this.controller = new AbortController();
    this.state = {
      ...this.state,
      status: 'downloading',
      received: 0,
      error: null,
    };
    let partial;
    try {
      let expected = /^sha256:([a-f0-9]{64})$/i
        .exec(c.asset.digest || '')?.[1]
        .toLowerCase();
      if (!expected && c.checksums) {
        assetURL(c.checksums);
        const r = await request(
          c.checksums,
          this.fetcher,
          this.controller.signal,
        );
        const body = await r.text();
        if (body.length > 1000000) throw Error('校验文件过大');
        const row = body
          .split(/\r?\n/)
          .find(
            (line) => line.slice(64).trim().replace(/^\*/, '') === c.asset.name,
          );
        expected = /^[a-f0-9]{64}/i.exec(row || '')?.[0].toLowerCase();
      }
      if (!expected)
        throw Error(
          '发布包缺少 SHA-256 校验信息，不能自动下载安装；可查看发布页',
        );
      const dir = path.join(this.directory, c.version);
      fs.mkdirSync(dir, { recursive: true });
      const filename = path.basename(c.asset.name);
      if (filename !== c.asset.name || /[\\/]/.test(filename))
        throw Error('更新文件名无效');
      const target = path.join(dir, filename);
      partial = target + '.part';
      const response = await request(
          c.asset.url,
          this.fetcher,
          this.controller.signal,
          30 * 60 * 1000,
        ),
        hash = crypto.createHash('sha256');
      let length = 0;
      fs.rmSync(partial, { force: true });
      const file = fs.openSync(partial, 'wx', 0o600);
      try {
        for await (const chunk of response.body) {
          length += chunk.length;
          if (length > c.asset.size) throw Error('更新包超出声明大小');
          hash.update(chunk);
          let offset = 0;
          while (offset < chunk.length) {
            const n = fs.writeSync(file, chunk, offset, chunk.length - offset);
            if (!n) throw Error('更新包写入失败');
            offset += n;
          }
          this.state.received = length;
        }
        fs.fsyncSync(file);
      } finally {
        fs.closeSync(file);
      }
      if (length !== c.asset.size || hash.digest('hex') !== expected)
        throw Error('更新包 SHA-256 或大小校验失败，已丢弃');
      fs.renameSync(partial, target);
      this.downloaded = {
        path: target,
        hash: expected,
        size: length,
        version: c.version,
      };
      this.state = { ...this.state, status: 'downloaded' };
      return this.info();
    } catch (e) {
      if (partial) fs.rmSync(partial, { force: true });
      const error = this.controller?.signal.aborted
        ? new Error('下载已取消')
        : e;
      this.state = {
        ...this.state,
        status: this.controller?.signal.aborted ? 'available' : 'error',
        error: error.message,
      };
      throw error;
    } finally {
      this.busy = false;
    }
  }
  cancel() {
    this.controller?.abort();
    return this.info();
  }
  verifiedPath() {
    const d = this.downloaded;
    if (!d || !fs.existsSync(d.path)) throw Error('请先下载并校验更新');
    const bytes = fs.readFileSync(d.path);
    if (
      bytes.length !== d.size ||
      crypto.createHash('sha256').update(bytes).digest('hex') !== d.hash
    )
      throw Error('下载后的更新包已变更，请重新下载');
    return d.path;
  }
}
module.exports = { Updates, version, compare, selectRelease, assetURL };
