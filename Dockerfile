# Stage 1: Build Dependencies
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

# Stage 2: Build Application
FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate
RUN yarn build

# Stage 3: Production Runtime
FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app

# Copy only production dependencies
COPY package.json yarn.lock ./
RUN yarn install --production --frozen-lockfile

# Copy built application and prisma schema
COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma

# Copy the generated Prisma Client from the build stage into the final image
COPY --from=build /app/node_modules/.prisma/client ./node_modules/.prisma/client

# Expose the port the app runs on
EXPOSE 8000

# The command to run the application
CMD ["yarn", "start:prod"]
