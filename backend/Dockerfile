# Use the official Golang image as a base image
FROM golang:1.23-alpine

# Install curl for healthchecks
RUN apk add --no-cache curl

# Set the working directory inside the container
WORKDIR /app

# Copy source code + dependencies\
COPY . .

# Download Go modules
RUN go mod download

# Setup Go test tools
RUN go install github.com/jstemmer/go-junit-report/v2@latest
RUN mkdir -p test-results

# Build the Go application
RUN go build -o main .
