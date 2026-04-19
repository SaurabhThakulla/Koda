#SERVER

FROM node:22-alpine as client

WORKDIR /app

COPY client/package*.json ./
RUN npm ci

COPY client/ ./
RUN npm run build


# SERVER

FROM node:22-alpine as server

WORKDIR /app

COPY server/package*.json ./
RUN npm ci

COPY server/ ./
RUN npm run build

#PRODUCTION
FROM node:22-alpine as production

WORKDIR /app

COPY --from=client /app/dist ./public
COPY --from=server /app/dist ./dist
COPY server/package*.json ./
RUN npm ci --omit=dev

EXPOSE  5000

CMD ["node", "dist/server.js"]
