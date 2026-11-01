FROM node:24-bookworm-slim
WORKDIR /app
COPY dist ./dist
COPY electron/store.cjs electron/webdav.cjs electron/libraries.cjs electron/library-store.cjs ./electron/
COPY web/server.cjs ./web/
RUN mkdir /data && chown node:node /data
ENV HOST=0.0.0.0 PORT=8080 LOCAL_CANVAS_DATA=/data
USER node
EXPOSE 8080
VOLUME /data
CMD ["node", "web/server.cjs"]
