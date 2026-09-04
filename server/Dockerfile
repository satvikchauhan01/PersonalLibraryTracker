# Use a lightweight Node.js environment
FROM node:18-alpine

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json first to leverage Docker caching
COPY package*.json ./

# Install dependencies (this creates a fresh node_modules inside the container)
RUN npm install

# Copy the rest of your server code (controllers, routes, models, etc.)
COPY . .

# Expose the port your Express server uses
EXPOSE 5001

# Command to start your server
CMD ["npm", "start"]