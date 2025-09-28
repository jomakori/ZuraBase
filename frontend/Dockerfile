# Use the official Node.js LTS Alpine image as the base
FROM node:alpine

# Install curl for healthchecks
RUN apk add --no-cache curl

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json first to leverage Docker cache
COPY package*.json ./

# Install dependencies in clean, reproducible way
RUN npm ci

# Copy the rest of the frontend content
COPY . .

# Define environment
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

# Expose both ports (Vite: 5173, Express: 8181)
EXPOSE 5173
EXPOSE 8181

# Start Vite dev server in development, Express in production
CMD ["/bin/sh", "-c", "if [ \"$NODE_ENV\" = \"development\" ]; then npm run dev; else npm run build && node server.js; fi"]
