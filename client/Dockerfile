# Phase 16: multi-stage — a Node stage builds the static CRA bundle, then a
# much smaller nginx stage just serves the already-built files. The final
# image ships no node_modules, no source, no build tooling — just static
# assets and nginx.

# ---- build stage ----
FROM node:18-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

# CRA bakes REACT_APP_* vars into the static bundle at *build* time, not
# runtime — they have to be present before `npm run build`, unlike the
# server's env vars which are read at container start. docker-compose.yml
# passes this in as a build arg.
ARG REACT_APP_API_URL
ENV REACT_APP_API_URL=$REACT_APP_API_URL

COPY . .
RUN npm run build

# ---- serve stage ----
FROM nginx:1.27-alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
