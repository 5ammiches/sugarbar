FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci --prefer-offline --no-audit --progress=false
COPY . .
RUN npm run build:ssr

FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/dist /app/dist
COPY --from=builder /app/package*.json /app/
RUN npm ci --production --prefer-offline --no-audit --progress=false
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
