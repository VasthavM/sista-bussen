# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Sista Bussen — static PWA served by nginx.
#
# Stage 1 builds the Vite bundle; stage 2 ships only the compiled output. The
# final image contains no node runtime, no sources and no node_modules.
# ---------------------------------------------------------------------------

FROM node:22-alpine AS build

WORKDIR /app

# package.json has no "engines" field; node:22 is what the repo is developed
# against and satisfies Vite 8 / TypeScript 7.
# Install the full dependency tree: `npm run build` runs `tsc --noEmit` and
# `vite build`, and typescript/vite are devDependencies.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---------------------------------------------------------------------------
FROM nginx:alpine AS runtime

# Server block only — the base image's /etc/nginx/nginx.conf already provides
# events{} / http{} and includes conf.d/*.conf.
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf

COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

# Coolify's Traefik terminates TLS; this container only speaks HTTP on 80.
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/index.html || exit 1

# nginx:alpine's entrypoint already starts nginx in the foreground.