# Stage 1: Build
FROM node:22-alpine as build

ARG DATABASE_URL

ENV DATABASE_URL=${DATABASE_URL}

WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install

# Copy source and prisma files
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build NestJS app
RUN yarn build && ls -la dist

# Stage 2: Runtime
FROM node:22-alpine

ENV NODE_ENV=production
WORKDIR /app

# Copy from build stage
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json
COPY --from=build /app/yarn.lock ./yarn.lock
COPY --from=build /app/prisma ./prisma

# Default command
CMD ["yarn", "start:prod"]