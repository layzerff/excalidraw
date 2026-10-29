import React, { useEffect, useState } from 'react';
import { parseVideo } from './videos.mjs';
export function VideoLayer({ elements, state, interact, bridge, pauseEpoch }) {
  const [active, setActive] = useState(null);
  const zoom = state?.zoom.value || 1;
  const activeElement = elements.find((element) => element.id === active);
  const tooSmall = (element) =>
    element.width * zoom < 200 || element.height * zoom < 228;
  const outside = !!(
    activeElement &&
    state &&
    (tooSmall(activeElement) ||
      (activeElement.x + state.scrollX) * zoom + activeElement.width * zoom <
        0 ||
      (activeElement.y + state.scrollY) * zoom + activeElement.height * zoom <
        0 ||
      (activeElement.x + state.scrollX) * zoom > state.width ||
      (activeElement.y + state.scrollY) * zoom > state.height)
  );
  useEffect(() => {
    if (!active) return;
    let disposed = false;
    bridge
      .invoke('pauseVideos')
      .then((paused) => {
        if (!disposed && !paused)
          setActive((current) => (current === active ? null : current));
      })
      .catch(() => {
        if (!disposed)
          setActive((current) => (current === active ? null : current));
      });
    return () => {
      disposed = true;
    };
  }, [pauseEpoch, outside]);
  if (!state) return null;
  return (
    <div className="video-layer">
      {elements
        .filter(
          (e) => !e.isDeleted && e.type === 'embeddable' && parseVideo(e.link),
        )
        .map((element) => {
          const video = parseVideo(element.link);
          const x = (element.x + state.scrollX) * zoom,
            y = (element.y + state.scrollY) * zoom;
          const width = element.width * zoom,
            height = element.height * zoom;
          const hidden =
            (active === element.id && tooSmall(element)) ||
            x + width < 0 ||
            y + height < 0 ||
            x > state.width ||
            y > state.height;
          if (hidden && active !== element.id) return null;
          return (
            <section
              key={element.id}
              className={`video-card ${active === element.id ? 'video-active' : ''}`}
              style={{
                left: x,
                top: y,
                width,
                height,
                visibility: hidden ? 'hidden' : 'visible',
                transform: `rotate(${element.angle || 0}rad)`,
              }}
            >
              {active === element.id ? (
                <>
                  <div className="video-toolbar">
                    <button onClick={() => setActive(null)}>
                      停止 / 返回画布
                    </button>
                  </div>
                  <iframe
                    title={`${video.provider} 视频`}
                    src={video.src}
                    allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
                    allowFullScreen
                    sandbox="allow-scripts allow-same-origin allow-presentation"
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                </>
              ) : (
                <button
                  className="video-start"
                  disabled={tooSmall(element)}
                  title={
                    tooSmall(element)
                      ? '请放大画布，使播放器至少达到 200 × 200 像素'
                      : ''
                  }
                  onClick={() => {
                    interact();
                    setActive(element.id);
                  }}
                >
                  ▶ 操作 {video.provider} 视频
                </button>
              )}
            </section>
          );
        })}
    </div>
  );
}
