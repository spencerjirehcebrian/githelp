SHELL := /bin/bash
GO := $(shell which go 2>/dev/null || echo "/opt/homebrew/bin/go")
NPM := npm

.PHONY: all dev build test lint clean frontend backend

all: build

# Install dependencies for both frontend and backend
deps:
	@echo "Installing backend dependencies..."
	@cd backend && $(GO) mod tidy
	@echo "Installing frontend dependencies..."
	@cd frontend && $(NPM) install

# Build frontend and embed into standalone Go binary
build:
	@echo "Building frontend..."
	@cd frontend && $(NPM) run build
	@echo "Compiling standalone GitHelp binary..."
	@mkdir -p bin
	@cd backend && $(GO) build -ldflags="-s -w" -o ../bin/githelp ./cmd/server
	@echo "Standalone binary ready at ./bin/githelp"

# Run dev mode (backend + frontend dev servers)
dev:
	@echo "Starting GitHelp in development mode..."
	@trap 'kill 0' SIGINT SIGTERM EXIT; \
	(cd backend && $(GO) run ./cmd/server -dev -port 8080) & \
	(cd frontend && $(NPM) run dev) & \
	wait

# Run backend unit tests and frontend typechecks
test:
	@echo "Running backend tests..."
	@cd backend && $(GO) test -v ./...
	@echo "Running frontend typecheck..."
	@cd frontend && $(NPM) run lint

# Lint codebase
lint:
	@echo "Linting Go code..."
	@cd backend && $(GO) vet ./...
	@echo "Linting frontend code..."
	@cd frontend && $(NPM) run lint

# Clean build artifacts
clean:
	@rm -rf bin/ backend/bin/ frontend/dist/ backend/cmd/server/dist/assets/ *.db *.db-wal *.db-shm
	@echo "Cleaned build artifacts."
