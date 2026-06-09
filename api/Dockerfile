# Build context: ./api
FROM node:20-alpine

WORKDIR /app

# Install dependencies (prisma CLI is needed for generate + migrate deploy)
COPY package.json ./
RUN npm install

# Prisma client
COPY prisma ./prisma
RUN npx prisma generate

# App source
COPY src ./src

# Persisted uploads live here (mount a volume in compose)
RUN mkdir -p uploads

EXPOSE 4100

# Apply migrations, seed the Super Admin (idempotent), then start the server.
CMD ["sh", "-c", "npx prisma migrate deploy && node prisma/seed.js && node src/index.js"]
