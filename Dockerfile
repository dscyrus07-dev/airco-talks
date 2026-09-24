# ── Build stage ──────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

# Install all workspace dependencies first (better layer caching).
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY web/package.json web/
RUN npm install

# Copy sources and build shared + server (web is not needed on the backend).
COPY tsconfig.base.json ./
COPY shared/ shared/
COPY server/ server/
RUN npm run build --workspace shared && npm run build --workspace server

# ── Runtime stage ────────────────────────────────────────────
FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production

# Production dependencies only.
COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
RUN npm install --omit=dev

# Built artifacts + package manifests (workspace symlinks resolve @airco-talks/shared).
COPY --from=build /app/shared/dist ./shared/dist
COPY --from=build /app/server/dist ./server/dist

EXPOSE 8080
CMD ["node", "server/dist/main.js"]
