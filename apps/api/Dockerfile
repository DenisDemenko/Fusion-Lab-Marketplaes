# Built from the monorepo root: docker build -f apps/api/Dockerfile .
FROM node:20-alpine AS build
WORKDIR /repo
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json
RUN npm ci
COPY apps/api apps/api
COPY packages/shared-types packages/shared-types
RUN npx prisma generate --schema apps/api/prisma/schema.prisma
RUN npm run build --workspace=@fusion-lab/api

FROM node:20-alpine AS runtime
WORKDIR /repo
ENV NODE_ENV=production
COPY --from=build /repo/node_modules node_modules
COPY --from=build /repo/apps/api/dist apps/api/dist
COPY --from=build /repo/apps/api/package.json apps/api/package.json
COPY --from=build /repo/apps/api/prisma apps/api/prisma
EXPOSE 3001
CMD ["node", "apps/api/dist/main.js"]
