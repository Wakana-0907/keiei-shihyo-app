# 経営指標診断ツール - 本番用Dockerfile
# node:sqlite（Node組み込み）を使うためネイティブビルド不要。Node 22系イメージを使用。
FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY server ./server
COPY public ./public

# SQLiteファイルの保存先。永続ディスクをマウントする場合はここに合わせる。
ENV DB_PATH=/app/data/app.sqlite
RUN mkdir -p /app/data

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "server/index.js"]
