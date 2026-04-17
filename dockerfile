#Build the client
FROM node:22-alpine as client-builder

COPY ./client /app

WORKDIR /app

RUN npm install

RUN npm run build

# Build the server
FROM node:22-alpine as server-builder

COPY ./server /app

WORKDIR /app

COPY server/package*.json ./

RUN npm install

COPY --from=client-builder /app/dist /app/public

CMD ["npx", "tsx", "server.js"]

