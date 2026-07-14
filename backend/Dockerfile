FROM node:20-alpine

WORKDIR /app

# Preserve monorepo structure so relative imports (../../../shared/) resolve correctly
COPY backend/package.json backend/package-lock.json* ./backend/
WORKDIR /app/backend
RUN npm install
COPY backend/tsconfig.json ./
COPY backend/src/ ./src/
COPY shared/ /app/shared/
RUN npm run build

EXPOSE 3000
CMD ["node", "dist/backend/src/index.js"]
