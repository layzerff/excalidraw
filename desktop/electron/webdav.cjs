function config(input) {
  const url = new URL(input.url);
  if (
    !['https:', 'http:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error('请输入无账号、查询参数的 HTTP(S) WebDAV 目录地址');
  if (url.protocol === 'http:' && input.allowHttp !== true)
    throw new Error('HTTP 会明文传输账号和备份，请明确允许后使用');
  url.pathname = `${url.pathname.replace(/\/+$/, '')}/`;
  if (
    typeof input.username !== 'string' ||
    input.username.includes(':') ||
    input.username.length > 500
  )
    throw new Error('用户名无效');
  return {
    url: url.href,
    username: input.username,
    allowHttp: input.allowHttp === true,
  };
}
async function request(
  settings,
  password,
  method,
  filename = '',
  body,
  fetcher = fetch,
) {
  const base = config(settings);
  if (method === 'PUT' && Buffer.byteLength(body || '') > 200 * 1024 * 1024)
    throw new Error('备份超过 200 MB');
  if (filename && !/^local-canvas-[a-zA-Z0-9._-]+\.json$/.test(filename))
    throw new Error('备份文件名无效');
  const url = new URL(filename, base.url);
  const response = await fetcher(url, {
    method,
    redirect: 'error',
    signal: AbortSignal.timeout(30000),
    headers: {
      Authorization: `Basic ${Buffer.from(`${base.username}:${password}`).toString('base64')}`,
      ...(method === 'PROPFIND'
        ? { Depth: '0', 'Content-Type': 'application/xml' }
        : {}),
      ...(method === 'PUT'
        ? { 'Content-Type': 'application/json', 'If-None-Match': '*' }
        : {}),
    },
    body:
      method === 'PROPFIND'
        ? '<?xml version="1.0"?><d:propfind xmlns:d="DAV:"><d:prop><d:resourcetype/></d:prop></d:propfind>'
        : body,
  });
  if (!response.ok)
    throw new Error(`WebDAV ${method} 失败（HTTP ${response.status}）`);
  if (method === 'PUT') {
    await response.body?.cancel();
    return true;
  }
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > (method === 'PROPFIND' ? 1024 * 1024 : 200 * 1024 * 1024))
        throw new Error('WebDAV 响应过大');
      chunks.push(Buffer.from(value));
    }
    const text = Buffer.concat(chunks).toString('utf8');
    if (method === 'PROPFIND') {
      if (
        !/<(?:[\w.-]+:)?collection\b[^>]*\/?\s*>/i.test(text) ||
        !/<(?:[\w.-]+:)?status\b[^>]*>\s*HTTP\/[\d.]+ 2\d\d/i.test(text)
      )
        throw new Error('地址不是可访问的 WebDAV 目录，请检查目录和权限');
      return true;
    }
    return JSON.parse(text);
  } finally {
    await reader.cancel();
  }
}
module.exports = { config, request };
