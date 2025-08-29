# Use the official Node.js image as the base image
FROM node:alpine

# Install curl for healthchecks
RUN apk add --no-cache curl

# Set the working directory inside the container
WORKDIR /app

# Copy frontend content
COPY . .

# Install the dependencies
RUN npm install
