import { translate as __ui } from './i18n.mjs';
import React, { useEffect, useRef, useState } from 'react';
import { parseEmbed } from './embeds.mjs';
// Native embeddable containers pass inactive pointer events to the canvas.
export function VideoEmbed({
  link,
  pauseEpoch,
  bridge,
  allowed = false,
  requestConsent,
}) {
  const embed = parseEmbed(link);
  const video = embed?.video,
    frame = useRef(null),
    previousEpoch = useRef(pauseEpoch);
  const [failed, setFailed] = useState(false),
    [generation, setGeneration] = useState(0);
  useEffect(() => {
    if (previousEpoch.current === pauseEpoch) return;
    previousEpoch.current = pauseEpoch;
    if (!frame.current || !video) return;
    frame.current.contentWindow?.postMessage(
      video.provider === 'YouTube'
        ? JSON.stringify({
            event: 'command',
            func: 'pauseVideo',
            args: [],
          })
        : {
            type: 'pause',
          },
      new URL(video.src).origin,
    );
    // Bilibili documents embed parameters, not a public pause command. A web
    // browser cannot inspect cross-origin media: replace that player to stop it.
    if (bridge.kind === 'web' && video.provider === 'Bilibili') {
      setGeneration((g) => g + 1);
      return;
    }
    bridge
      .invoke('pauseVideos')
      .then((paused) => {
        if (!paused && video.provider === 'Bilibili')
          setGeneration((g) => g + 1);
      })
      .catch(() => {
        if (video.provider === 'Bilibili') setGeneration((g) => g + 1);
      });
  }, [pauseEpoch, bridge, video?.src]);
  if (!embed) return null;
  if (!allowed)
    return (
      <div className="embed-placeholder">
        <strong>{embed.origin}</strong>
        <p>{__ui('外部内容尚未加载')}</p>
        <small>{__ui('双击此区域后可操作按钮')}</small>
        <button
          onClick={(e) => {
            e.stopPropagation();
            requestConsent(embed.origin);
          }}
        >
          {__ui('选择是否加载')}
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            bridge.invoke('openExternalPage', embed.url);
          }}
        >
          {__ui('在浏览器打开')}
        </button>
      </div>
    );
  return (
    <div className="video-embed">
      <iframe
        key={generation}
        ref={frame}
        title={video ? '' + video.provider + __ui(' 视频') : embed.origin}
        src={video?.src || embed.url}
        loading="lazy"
        onError={() => setFailed(true)}
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        sandbox={
          video
            ? 'allow-scripts allow-same-origin allow-presentation'
            : 'allow-scripts allow-forms allow-presentation'
        }
        referrerPolicy="strict-origin-when-cross-origin"
      />
      <div className="embed-browser-link">
        <button
          onClick={(e) => {
            e.stopPropagation();
            bridge.invoke('openExternalPage', embed.url);
          }}
        >
          {__ui('在浏览器打开')}
        </button>
        <span>
          {failed ? __ui('页面加载失败') : __ui('网站禁止嵌入或未显示？')}
        </span>
      </div>
      {failed && (
        <div className="video-load-error">
          {__ui('视频加载失败')}{' '}
          <button
            onClick={() => {
              setFailed(false);
              setGeneration((g) => g + 1);
            }}
          >
            {__ui('重试 ')}
          </button>
        </div>
      )}
    </div>
  );
}
// Only this small button captures events, outside the player picture.
export function VideoControls({ state, elements, exit }) {
  const active = state?.activeEmbeddable;
  const el = elements.find((e) => e.id === active?.element?.id && !e.isDeleted);
  if (active?.state !== 'active' || !el || !parseEmbed(el.link)) return null;
  const z = state.zoom.value;
  return (
    <div
      className="video-edit-control"
      style={{
        left: Math.max(
          8,
          Math.min(state.width - 190, (el.x + state.scrollX) * z),
        ),
        top: Math.max(8, (el.y + state.scrollY) * z - 34),
      }}
    >
      <button onClick={exit}>{__ui('返回画布编辑 \xB7 Esc')}</button>
    </div>
  );
}
