FROM node:24-bookworm-slim AS dependencies
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM dependencies AS build
WORKDIR /app
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN mkdir -p public && npm run build

FROM node:24-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 \
    ARTIFACT_DIR=/app/.data/artifacts
# The migration and bootstrap CLIs use tsx and the source schema, so this first
# release deliberately retains their dependencies and source in the image.
COPY --from=build --chown=node:node /app/ ./
RUN mkdir -p /app/.data/artifacts && chown -R node:node /app/.data
USER node
EXPOSE 3000
CMD ["npm", "start", "--", "--hostname", "0.0.0.0"]
