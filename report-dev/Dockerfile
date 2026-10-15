# =============================================================================
# Dockerfile cho mrs report-service
# =============================================================================

# ----------------------------------------------------------------------------
# Stage 1: builder — cài deps (gồm dev) và biên dịch TypeScript
# ----------------------------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Chỉ copy package.json (bỏ qua package-lock.json) để đảm bảo không bị dính URL lỗi
COPY package.json ./

# Cài đặt Python và build tools để biên dịch các native addons (như farmhash)
RUN apk add --no-cache python3 make g++

# Dùng Docker Secrets để bảo mật NPM_TOKEN và .npmrc, đồng thời fix lỗi CRLF của Windows
RUN --mount=type=secret,id=npmrc,target=/tmp/.npmrc,required=false \
    --mount=type=secret,id=npm_token,env=NPM_TOKEN,required=false \
    if [ -f /tmp/.npmrc ]; then tr -d '\r' < /tmp/.npmrc > /root/.npmrc; fi && \
    npm install --legacy-peer-deps

# Copy mã nguồn và build
COPY . .
RUN npm run build

# ----------------------------------------------------------------------------
# Stage 2: prod-deps — chỉ cài dependencies runtime
# ----------------------------------------------------------------------------
FROM node:20-alpine AS prod-deps

WORKDIR /app
COPY package.json ./

# Cài đặt Python và build tools để biên dịch các native addons
RUN apk add --no-cache python3 make g++

RUN --mount=type=secret,id=npmrc,target=/tmp/.npmrc,required=false \
    --mount=type=secret,id=npm_token,env=NPM_TOKEN,required=false \
    if [ -f /tmp/.npmrc ]; then tr -d '\r' < /tmp/.npmrc > /root/.npmrc; fi && \
    npm install --omit=dev --legacy-peer-deps

# ----------------------------------------------------------------------------
# Stage 3: runtime — image gọn, chạy bằng user không phải root
# ----------------------------------------------------------------------------
FROM node:20-alpine AS runtime

ENV NODE_ENV=development

WORKDIR /app

# node_modules runtime (không kèm devDependencies)
COPY --from=prod-deps /app/node_modules ./node_modules

# Mã đã build của service + package.json
COPY --from=builder /app/build ./build
COPY package.json ./package.json

# File env theo môi trường
COPY .env* ./

# Thư mục log ghi được
RUN mkdir -p logs && chown -R node:node /app

USER node

EXPOSE 6000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:${PORT:-6000}/health || exit 1

CMD ["node", "build/index.js"]
