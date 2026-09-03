# Build stage: installs full workspace deps and produces the static Vite build.
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json shared/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci

COPY shared shared
COPY frontend frontend
RUN npm run build --workspace=shared && npm run build --workspace=frontend

# Runtime stage: static files served by nginx, which also proxies /api to
# the backend service over the compose network.
FROM nginx:alpine
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
