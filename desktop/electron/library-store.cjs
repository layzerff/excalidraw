const fs = require('node:fs');
const path = require('node:path');
function validateOrganization(folders, assignments) {
  if (
    !Array.isArray(folders) ||
    folders.some(
      (f) =>
        typeof f.id !== 'string' ||
        typeof f.name !== 'string' ||
        !f.name.trim() ||
        f.name.length > 200,
    ) ||
    new Set(folders.map((f) => f.id)).size !== folders.length
  )
    throw Error('素材文件夹无效');
  const ids = new Set(folders.map((f) => f.id));
  for (const f of folders) {
    let p = f.parent,
      seen = new Set([f.id]);
    while (p) {
      if (seen.has(p) || !ids.has(p)) throw Error('素材文件夹层级无效');
      seen.add(p);
      p = folders.find((x) => x.id === p).parent;
    }
  }
  if (
    !assignments ||
    typeof assignments !== 'object' ||
    Array.isArray(assignments) ||
    Object.values(assignments).some((id) => id !== null && !ids.has(id))
  )
    throw Error('素材位置无效');
}
class LibraryStore {
  constructor(store, root) {
    this.store = store;
    this.root = root;
    store.librarySnapshot = () => this.snapshot();
    store.libraryRestore = (value) => this.importSnapshot(value);
  }
  location() {
    return (
      this.store.getSetting('libraryDirectory') ||
      path.join(this.root, 'materials')
    );
  }
  info() {
    return {
      defaultFolder: path.join(this.root, 'materials'),
      folder: this.location(),
      file: path.join(this.location(), 'library.json'),
    };
  }
  read() {
    const filename = this.info().file;
    if (!fs.existsSync(filename))
      return {
        version: 1,
        libraryItems: [],
        folders: [],
        assignments: {},
        migrated: [],
      };
    const value = JSON.parse(fs.readFileSync(filename, 'utf8'));
    if (
      value.version !== 1 ||
      !Array.isArray(value.libraryItems) ||
      !Array.isArray(value.folders)
    )
      throw Error('素材库文件无效，请恢复备份');
    validateOrganization(value.folders, value.assignments || {});
    return value;
  }
  write(value) {
    validateOrganization(value.folders, value.assignments || {});
    if (
      !Array.isArray(value.libraryItems) ||
      value.libraryItems.length > 50000 ||
      !Array.isArray(value.folders) ||
      value.folders.length > 2000
    )
      throw Error('素材库数据无效');
    const text = JSON.stringify(value);
    if (text.length > 100 * 1024 * 1024) throw Error('素材库超过 100 MB');
    const { folder, file } = this.info();
    fs.mkdirSync(folder, { recursive: true });
    if (fs.existsSync(file)) fs.copyFileSync(file, file + '.bak');
    const temporary = file + '.tmp';
    const fd = fs.openSync(temporary, 'w', 0o600);
    try {
      fs.writeFileSync(fd, text);
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(temporary, file);
    return value;
  }
  open(id) {
    const value = this.read();
    value.assignments ||= {};
    value.migrated ||= [];
    if (id && !value.migrated.includes(id)) {
      const legacy = this.store.read(id).data.libraryItems || [],
        ids = new Set(value.libraryItems.map((i) => i.id));
      value.libraryItems.push(...legacy.filter((i) => !ids.has(i.id)));
      value.migrated.push(id);
      this.write(value);
    }
    return value;
  }
  save(items) {
    const value = this.read();
    value.libraryItems = items;
    return this.write(value);
  }
  organize(folders, assignments) {
    validateOrganization(folders, assignments);
    const value = this.read();
    value.folders = folders;
    value.assignments = assignments;
    return this.write(value);
  }
  snapshot() {
    const { libraryItems, folders, assignments } = this.read();
    return { version: 1, libraryItems, folders, assignments };
  }
  importSnapshot(incoming) {
    if (
      incoming?.version !== 1 ||
      !Array.isArray(incoming.libraryItems) ||
      !Array.isArray(incoming.folders) ||
      !incoming.assignments ||
      incoming.folders.some(
        (f) =>
          typeof f.id !== 'string' ||
          typeof f.name !== 'string' ||
          !f.name.trim(),
      )
    )
      throw Error('素材库备份无效');
    validateOrganization(incoming.folders, incoming.assignments);
    const value = this.read(),
      known = new Set(value.libraryItems.map((i) => i.id)),
      folderIds = new Map(
        incoming.folders.map((f) => [
          f.id,
          value.folders.some((existing) => existing.id === f.id)
            ? f.id
            : require('node:crypto').randomUUID(),
        ]),
      );
    const added = incoming.libraryItems.filter((i) => !known.has(i.id));
    const folders = incoming.folders
      .filter((f) => !value.folders.some((existing) => existing.id === f.id))
      .map((f) => ({
        ...f,
        id: folderIds.get(f.id),
        parent: folderIds.get(f.parent) || null,
      }));
    if (!added.length && !folders.length) return value;
    const assignments = { ...value.assignments };
    for (const item of added)
      assignments[item.id] =
        folderIds.get(incoming.assignments[item.id]) || null;
    return this.write({
      ...value,
      libraryItems: [...value.libraryItems, ...added],
      folders: [...value.folders, ...folders],
      assignments,
    });
  }
  relocate(directory) {
    if (typeof directory !== 'string' || !path.isAbsolute(directory))
      throw Error('素材目录必须为绝对路径');
    if (path.resolve(directory) === path.resolve(this.location()))
      return this.info();
    const target = path.join(directory, 'library.json');
    if (fs.existsSync(target))
      throw Error('目标已有素材库文件，请选择空目录，避免覆盖');
    const previous = this.location(),
      value = this.read();
    fs.mkdirSync(directory, { recursive: true });
    const temporary = target + '.tmp';
    const fd = fs.openSync(temporary, 'wx', 0o600);
    try {
      fs.writeFileSync(fd, JSON.stringify(value));
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
    fs.renameSync(temporary, target);
    this.store.setSetting('libraryDirectory', directory);
    return { ...this.info(), previous };
  }
}
module.exports = { LibraryStore };
