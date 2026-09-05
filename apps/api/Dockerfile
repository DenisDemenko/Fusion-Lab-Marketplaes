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
COPY --from=build /repo/apps/api/prisma.config.ts apps/api/prisma.config.ts
# prisma/seed.ts runs standalone via ts-node (`npm run db:seed`), never
# through the compiled dist/ — it needs the actual TS source and the
# project's tsconfig, neither of which the runtime image otherwise ships.
COPY --from=build /repo/apps/api/tsconfig.json apps/api/tsconfig.json
COPY --from=build /repo/apps/api/src apps/api/src
EXPOSE 3001
# --trace-deprecation is deliberate, not leftover debugging. A deprecation
# warning without a stack ("client.query() when the client is already
# executing a query", pg@8.23) cost a full investigation that could not
# attribute it to any call site by reading the code — the adapter's
# transaction path awaits every statement, and everything outside a
# transaction goes through pool.query(). The flag only changes how such a
# warning is printed; it costs nothing at runtime and makes the next one
# answerable instead of decorative.
# Міграції застосовуються НА СТАРТІ, а не руками.
#
# Досі образ просто запускав сервер, і `prisma migrate deploy` не робив
# ніхто — тож схема бази лишалась позаду коду. Це не теорія: міграція, що
# додає `sample` до `MediaKind`, лежала незастосованою, і кожна спроба
# покласти безкоштовний уривок падала з 500, хоча код для нього був
# задеплоєний і правильний.
#
# Помилка міграції НЕ валить запуск свідомо. Аварійний вихід тут означав
# би, що крамниця перестає працювати цілком — а сьогоднішній випадок
# показав, що відставання схеми зазвичай ламає одну можливість, не всі.
# Тому: гучний рядок у лог і старт; несправність видно, а покупці
# купують. `migrate deploy` бере advisory-lock, тож паралельні інстанси
# не заважають один одному.
#
# Команда виконується з `apps/api`, бо `prisma.config.ts` вказує шлях до
# схеми відносно себе; `exec` — щоб node лишився PID 1 і отримував
# сигнали зупинки.
CMD ["sh", "-c", "cd apps/api && (npx prisma migrate deploy || echo '!!! MIGRATE DEPLOY FAILED — starting anyway, database schema may be behind the code'); cd /repo && exec node --trace-deprecation apps/api/dist/main.js"]
