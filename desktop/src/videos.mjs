export function parseVideo(value) {
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    const host = url.hostname.toLowerCase();
    if (
      [
        'youtube.com',
        'www.youtube.com',
        'm.youtube.com',
        'youtu.be',
        'www.youtube-nocookie.com',
      ].includes(host)
    ) {
      const id =
        host === 'youtu.be'
          ? url.pathname.slice(1)
          : url.pathname === '/watch'
            ? url.searchParams.get('v')
            : url.pathname.match(/^\/(?:embed|shorts)\/([^/]+)$/)?.[1];
      if (!/^[\w-]{11}$/.test(id || '')) return null;
      const embed = new URL(`https://www.youtube-nocookie.com/embed/${id}`);
      embed.searchParams.set('autoplay', '0');
      embed.searchParams.set('controls', '1');
      embed.searchParams.set('playsinline', '1');
      embed.searchParams.set('enablejsapi', '1');
      return { provider: 'YouTube', src: embed.href };
    }
    if (
      [
        'www.bilibili.com',
        'bilibili.com',
        'm.bilibili.com',
        'player.bilibili.com',
      ].includes(host)
    ) {
      const id =
        url.pathname.match(/\/video\/(BV[a-zA-Z0-9]{10})(?:\/|$)/)?.[1] ||
        url.searchParams.get('bvid');
      if (!/^BV[a-zA-Z0-9]{10}$/.test(id || '')) return null;
      const embed = new URL('https://player.bilibili.com/player.html');
      embed.searchParams.set('bvid', id);
      embed.searchParams.set('autoplay', '0');
      embed.searchParams.set('danmaku', '0');
      const page = Number(url.searchParams.get('p'));
      if (Number.isInteger(page) && page > 0 && page < 10000)
        embed.searchParams.set('p', String(page));
      return { provider: 'Bilibili', src: embed.href };
    }
  } catch {}
  return null;
}
const mediaHosts = [
  'youtube.com',
  'youtube-nocookie.com',
  'googlevideo.com',
  'ytimg.com',
  'gstatic.com',
  'ggpht.com',
  'google.com',
  'jnn-pa.googleapis.com',
  'doubleclick.net',
  'bilibili.com',
  'bilivideo.com',
  'bilivideo.cn',
  'hdslb.com',
];
function mediaURL(value) {
  try {
    const u = new URL(value);
    return (
      u.protocol === 'https:' &&
      mediaHosts.some((h) => u.hostname === h || u.hostname.endsWith(`.${h}`))
    );
  } catch {
    return false;
  }
}
export function allowVideoRequest(details) {
  if (!/^https?:|^wss?:/.test(details.url)) return true;
  if (details.resourceType === 'mainFrame') return false;
  if (details.resourceType === 'subFrame') {
    const parsed = parseVideo(details.url);
    if (
      parsed &&
      new URL(parsed.src).origin === new URL(details.url).origin &&
      /\/(embed\/|player\.html)/.test(new URL(details.url).pathname)
    )
      return true;
    try {
      return mediaURL(details.url) && mediaURL(details.frame?.parent?.url);
    } catch {
      return false;
    }
  }
  if (!mediaURL(details.url)) return false;
  // Only an official player frame (or its descendants) can fetch video resources.
  let frame = details.frame;
  try {
    while (frame) {
      if (mediaURL(frame.url)) return true;
      frame = frame.parent;
    }
  } catch {}
  return false;
}
