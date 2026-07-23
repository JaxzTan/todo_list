FROM node:24-alpine
WORKDIR /app

# package.json files copied first so `npm ci` is cached across rebuilds
# unless a dependency actually changed (see the `rebuild` watch action in
# compose.yaml, which is what re-triggers this layer).
COPY package.json package-lock.json ./
COPY packages/board-codec/package.json packages/board-codec/package.json
# `npm ci` fails here: the lockfile was generated on macOS/arm64, and native
# packages (@node-rs/argon2, lightningcss, sharp) ship optional per-platform
# variants + a WASM/emnapi fallback that npm didn't need to pin for that
# platform. `npm install` resolves whatever this (Linux) platform actually
# needs instead of demanding exact lockfile parity.
RUN npm install

COPY . .
# `generate` only reads the schema and never connects to a database, but
# prisma.config.ts resolves DATABASE_URL eagerly regardless — a placeholder
# satisfies that at build time. compose.yaml's `environment:` overrides
# this with the real value at container runtime.
ENV DATABASE_URL="postgresql://placeholder:placeholder@localhost:5432/placeholder"
RUN npx prisma generate

EXPOSE 3000
CMD ["npm", "run", "dev"]
