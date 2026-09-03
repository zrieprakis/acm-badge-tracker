# Build stage: installs full workspace deps (including devDependencies,
# needed for tsc) and compiles shared + backend to plain JS.
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json tsconfig.base.json ./
COPY shared/package.json shared/package.json
COPY backend/package.json backend/package.json
RUN npm ci

COPY shared shared
COPY backend backend
RUN npm run build --workspace=shared && npm run build --workspace=backend

# Runtime stage: only the compiled output + node_modules, run as the
# non-root "node" user built into the base image.
FROM node:20-alpine
WORKDIR /app/backend
ENV NODE_ENV=production

COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/shared /app/shared
COPY --from=build /app/backend/package.json ./package.json
COPY --from=build /app/backend/dist ./dist

RUN mkdir -p /app/backend/data && chown -R node:node /app/backend/data
USER node

EXPOSE 3001
CMD ["node", "dist/index.js"]
