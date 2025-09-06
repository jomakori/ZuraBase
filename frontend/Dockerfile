# Use the official Node.js image as the base image
FROM node:alpine

# Install curl for healthchecks
RUN apk add --no-cache curl

# Set the working directory inside the container
WORKDIR /app

# Copy package.json and package-lock.json first to leverage Docker cache
COPY package.json package-lock.json ./

# Install the dependencies for the target platform (linux/amd64)
RUN npm install --platform=linux --arch=x64

# Copy the rest of the frontend content
COPY . .

# Clean node_modules and reinstall for the correct platform (linux/amd64)
RUN rm -rf node_modules && \
    npm ci --platform=linux --arch=x64 && \
    npm rebuild

# Start Vite dev server in development, Express in production
ARG NODE_ENV=production
ENV NODE_ENV=${NODE_ENV}

# Expose both ports (Vite: 5173, Express: 8181)
EXPOSE 5173
EXPOSE 8181

CMD ["/bin/sh", "-c", "if [ \"$NODE_ENV\" = \"development\" ]; then npm run dev; else npm run build && node server.js; fi"]
