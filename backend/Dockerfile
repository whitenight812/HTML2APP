FROM node:20-alpine

WORKDIR /app
COPY backend/package.json backend/package-lock.json* ./
RUN npm install
COPY backend/src/ ./src/
COPY shared/ ./shared/
RUN npm run build

EXPOSE 3000
CMD ["node", "dist/index.js"]
