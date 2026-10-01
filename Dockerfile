FROM node:24-alpine
WORKDIR /app
COPY package.json server.mjs index.html styles.css app.js game.js content.js analytics.js sprites.js enemies.js weapons.js bosses.js intro.js render.js audio.js favicon.svg ./
COPY assets ./assets
RUN mkdir data && chown -R node:node /app
USER node
ENV HOST=0.0.0.0 PORT=3000 NODE_ENV=production
EXPOSE 3000
VOLUME ["/app/data"]
CMD ["node", "server.mjs"]
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
