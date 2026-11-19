FROM node:22-bookworm-slim
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build
ENV NODE_ENV=production
ENV PORT=3847
EXPOSE 3847
CMD ["sh", "-c", "npm run db:setup && npm run start"]
