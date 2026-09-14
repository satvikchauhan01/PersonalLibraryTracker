# Phase 16: lightweight, reproducible, non-root — `npm ci` (not install) so
# the container always gets exactly what package-lock.json pins, and a
# dedicated user so the process never runs as root inside the container.
FROM node:18-alpine

WORKDIR /app

# Copy package.json and package-lock.json first to leverage Docker's layer
# cache — dependencies only get reinstalled when these actually change, not
# on every source-code edit.
COPY package*.json ./

RUN npm ci --omit=dev

# Copy the rest of the server code (controllers, routes, models, etc.)
COPY . .

# node:alpine images ship a preexisting, unprivileged `node` user — use it
# instead of running the process as root.
USER node

# Expose the port the Express server listens on (documentation only — the
# actual port is controlled by $PORT at runtime, see docker-compose.yml)
EXPOSE 5001

CMD ["npm", "start"]
