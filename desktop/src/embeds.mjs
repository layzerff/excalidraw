import { parseVideo, allowVideoRequest } from './videos.mjs';
export function parseEmbed(value) {
  try {
    if (typeof value !== 'string' || value.length > 8192) return null;
    const url = new URL(value.trim());
    if (url.protocol !== 'https:' || url.username || url.password) return null;
    const video = parseVideo(url.href);
    return {
      kind: video ? 'video' : 'web',
      url: url.href,
      origin: video ? new URL(video.src).origin : url.origin,
      video,
    };
  } catch {
    return null;
  }
}
export function embedOrigins(elements = []) {
  return [
    ...new Set(
      elements
        .filter((e) => e.type === 'embeddable' && !e.isDeleted)
        .map((e) => parseEmbed(e.link)?.origin)
        .filter(Boolean),
    ),
  ];
}
// Renderer consent is also enforced by Electron's request filter. Main editor
// networking stays blocked. Remote frames cannot access the workspace IPC bridge.
export function allowEmbedRequest(details, approved = new Set()) {
  const scheme = (() => {
    try {
      return new URL(details.url).protocol;
    } catch {
      return '';
    }
  })();
  if (details.resourceType === 'mainFrame')
    return (
      !parseEmbed(details.frame?.url) &&
      ['file:', 'data:', 'blob:', 'devtools:'].includes(scheme)
    );
  if (['file:', 'filesystem:'].includes(scheme))
    return (
      !!details.frame &&
      details.resourceType !== 'subFrame' &&
      !details.frame.parent &&
      details.frame.url.startsWith('file:')
    );
  if (!['https:', 'wss:', 'blob:', 'data:', 'about:'].includes(scheme))
    return false;
  if (
    ['blob:', 'data:', 'about:'].includes(scheme) &&
    details.resourceType !== 'subFrame' &&
    details.frame?.url?.startsWith('file:') &&
    !details.frame.parent
  )
    return true;
  const frames = [];
  let frame = details.frame;
  try {
    while (frame) {
      frames.push(frame.url);
      frame = frame.parent;
    }
  } catch {
    return false;
  }
  const trustedAncestor = frames.some((value) => {
    const parsed = parseEmbed(value);
    return parsed && approved.has(parsed.origin);
  });
  if (details.resourceType === 'subFrame') {
    const embed = parseEmbed(details.url);
    if (embed && approved.has(embed.origin)) return true;
    return (
      trustedAncestor && ['https:', 'blob:', 'data:', 'about:'].includes(scheme)
    );
  }
  if (trustedAncestor) return true;
  // Allow official player initial requests only after consent as well.
  return (
    [...approved].some(
      (origin) =>
        origin === 'https://www.youtube-nocookie.com' ||
        origin === 'https://player.bilibili.com',
    ) && allowVideoRequest(details)
  );
}
