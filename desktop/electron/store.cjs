const { DatabaseSync } = require('node:sqlite');
const { randomUUID } = require('node:crypto');

function name(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 200)
    throw new Error('名称须为 1–200 个字符');
  return value.trim();
}
function payload(value) {
  if (
    !value ||
    !Array.isArray(value.elements) ||
    !Array.isArray(value.scenes) ||
    typeof value.files !== 'object' ||
    !value.files ||
    typeof value.appState !== 'object' ||
    !value.appState
  )
    throw new Error('无效的白板数据');
  const ids = new Set();
  for (const s of value.scenes) {
    if (!s || typeof s.id !== 'string' || ids.has(s.id))
      throw new Error('场景 ID 无效或重复');
    ids.add(s.id);
    name(s.title);
    if (
      !s.rect ||
      !['x', 'y', 'width', 'height'].every((k) => Number.isFinite(s.rect[k])) ||
      s.rect.width <= 0 ||
      s.rect.height <= 0
    )
      throw new Error('场景区域无效');
  }
  const json = JSON.stringify(value);
  if (Buffer.byteLength(json) > 100 * 1024 * 1024)
    throw new Error('单个文档超过 100 MB，请拆分大型图片');
  return json;
}
const blank = () => ({ elements: [], appState: {}, files: {}, scenes: [] });

class Store {
  constructor(path) {
    this.db = new DatabaseSync(path);
    this.db
      .exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;
      CREATE TABLE IF NOT EXISTS nodes(id TEXT PRIMARY KEY, parent TEXT REFERENCES nodes(id), kind TEXT NOT NULL CHECK(kind IN ('folder','document')), title TEXT NOT NULL, data TEXT, revision INTEGER NOT NULL DEFAULT 0, deleted INTEGER NOT NULL DEFAULT 0, updated INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS settings(key TEXT PRIMARY KEY,value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS revisions(id INTEGER PRIMARY KEY, document TEXT NOT NULL, data TEXT NOT NULL, created INTEGER NOT NULL);
      PRAGMA user_version=1;`);
    if (!this.db.prepare('SELECT 1 FROM nodes LIMIT 1').get())
      this.create('document', null, '我的第一张白板');
  }
  transaction(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const result = fn();
      this.db.exec('COMMIT');
      return result;
    } catch (e) {
      this.db.exec('ROLLBACK');
      throw e;
    }
  }
  list() {
    return this.db
      .prepare(
        'SELECT id,parent,kind,title,revision,deleted,updated FROM nodes ORDER BY kind DESC,title COLLATE NOCASE',
      )
      .all();
  }
  node(id) {
    const row = this.db.prepare('SELECT * FROM nodes WHERE id=?').get(id);
    if (!row) throw new Error('文档或文件夹不存在');
    return row;
  }
  parent(id) {
    if (
      id !== null &&
      (this.node(id).kind !== 'folder' || this.node(id).deleted)
    )
      throw new Error('目标文件夹不可用');
  }
  create(kind, parent, title, data = blank()) {
    if (!['folder', 'document'].includes(kind)) throw new Error('无效类型');
    this.parent(parent);
    const id = randomUUID();
    this.db
      .prepare(
        'INSERT INTO nodes(id,parent,kind,title,data,updated) VALUES(?,?,?,?,?,?)',
      )
      .run(
        id,
        parent,
        kind,
        name(title),
        kind === 'document' ? payload(data) : null,
        Date.now(),
      );
    return id;
  }
  read(id) {
    const row = this.node(id);
    if (row.kind !== 'document' || row.deleted) throw new Error('白板不可用');
    return { ...row, data: JSON.parse(row.data) };
  }
  rename(id, title) {
    this.node(id);
    this.db
      .prepare('UPDATE nodes SET title=?,updated=? WHERE id=?')
      .run(name(title), Date.now(), id);
  }
  move(id, parent) {
    this.node(id);
    this.parent(parent);
    let p = parent;
    while (p !== null) {
      if (p === id) throw new Error('不能将文件夹移入自身或子文件夹');
      p = this.node(p).parent;
    }
    this.db
      .prepare('UPDATE nodes SET parent=?,updated=? WHERE id=?')
      .run(parent, Date.now(), id);
  }
  trash(id, deleted) {
    this.node(id);
    // A folder must be empty; this avoids hiding children and makes restore predictable.
    if (
      deleted &&
      this.db
        .prepare('SELECT 1 FROM nodes WHERE parent=? AND deleted=0 LIMIT 1')
        .get(id)
    )
      throw new Error('请先移出或删除文件夹内的内容');
    if (!deleted) {
      const p = this.node(id).parent;
      if (p && this.node(p).deleted) this.move(id, null);
    }
    this.db
      .prepare('UPDATE nodes SET deleted=?,updated=? WHERE id=?')
      .run(deleted ? 1 : 0, Date.now(), id);
  }
  save(id, data, revision) {
    const json = payload(data);
    return this.transaction(() => {
      const row = this.read(id);
      if (row.revision !== revision)
        throw new Error('文档版本冲突，请先导出当前内容再重新打开');
      if (row.data && JSON.stringify(row.data) === json) return row.revision;
      const last = this.db
        .prepare(
          'SELECT created FROM revisions WHERE document=? ORDER BY id DESC LIMIT 1',
        )
        .get(id);
      if (!last || Date.now() - last.created > 60000) {
        this.db
          .prepare('INSERT INTO revisions(document,data,created) VALUES(?,?,?)')
          .run(id, JSON.stringify(row.data), Date.now());
        this.db
          .prepare(
            'DELETE FROM revisions WHERE document=? AND id NOT IN (SELECT id FROM revisions WHERE document=? ORDER BY id DESC LIMIT 30)',
          )
          .run(id, id);
      }
      this.db
        .prepare(
          'UPDATE nodes SET data=?,revision=revision+1,updated=? WHERE id=?',
        )
        .run(json, Date.now(), id);
      return revision + 1;
    });
  }
  getSetting(key) {
    return (
      this.db.prepare('SELECT value FROM settings WHERE key=?').get(key)
        ?.value ?? null
    );
  }
  setSetting(key, value) {
    this.db
      .prepare(
        'INSERT INTO settings VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value',
      )
      .run(key, String(value));
  }
  backup() {
    return {
      format: 'local-canvas-workspace',
      version: 1,
      created: new Date().toISOString(),
      nodes: this.db.prepare('SELECT * FROM nodes').all(),
      settings: this.db.prepare('SELECT * FROM settings').all(),
    };
  }
  restore(bundle) {
    if (
      bundle?.format !== 'local-canvas-workspace' ||
      bundle.version !== 1 ||
      !Array.isArray(bundle.nodes)
    )
      throw new Error('不支持的备份格式');
    const map = new Map();
    for (const row of bundle.nodes) {
      if (
        !row ||
        typeof row.id !== 'string' ||
        map.has(row.id) ||
        !['folder', 'document'].includes(row.kind)
      )
        throw new Error('备份节点无效');
      name(row.title);
      if (row.kind === 'document') payload(JSON.parse(row.data));
      map.set(row.id, row);
    }
    for (const row of bundle.nodes) {
      const seen = new Set([row.id]);
      let p = row.parent;
      while (p !== null) {
        if (seen.has(p) || !map.has(p) || map.get(p).kind !== 'folder')
          throw new Error('备份目录关系无效');
        seen.add(p);
        p = map.get(p).parent;
      }
    }
    // Import into a new folder, retaining all existing documents and remapping IDs.
    return this.transaction(() => {
      const root = this.create(
        'folder',
        null,
        `恢复 ${new Date().toLocaleString('zh-CN')}`,
      );
      const ids = new Map(bundle.nodes.map((r) => [r.id, randomUUID()]));
      const insert = (row) => {
        const id = ids.get(row.id);
        if (this.db.prepare('SELECT 1 FROM nodes WHERE id=?').get(id)) return;
        if (row.parent) insert(map.get(row.parent));
        this.db
          .prepare(
            'INSERT INTO nodes(id,parent,kind,title,data,deleted,updated) VALUES(?,?,?,?,?,?,?)',
          )
          .run(
            id,
            row.parent ? ids.get(row.parent) : root,
            row.kind,
            name(row.title),
            row.data,
            row.deleted ? 1 : 0,
            Date.now(),
          );
      };
      bundle.nodes.forEach(insert);
      return root;
    });
  }
  close() {
    this.db.close();
  }
}
module.exports = { Store, payload, blank };
