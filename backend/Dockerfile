# Use the official Golang image as a base image
FROM golang:alpine

# Install curl for healthchecks and certificates (least likely to change)
RUN apk add --no-cache ca-certificates curl

# Set the working directory inside the container
WORKDIR /app

# Copy only go.mod and go.sum first to leverage caching
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Setup Go test tools (these rarely change)
RUN go install gotest.tools/gotestsum@latest
RUN mkdir -p test-results

# Copy the rest of the source code (most likely to change)
COPY . .

# Build the Go application
RUN go build -o main .
