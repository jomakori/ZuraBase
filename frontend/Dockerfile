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

# Start the server directly
CMD ["node", "server.js"]
