SHELL := /bin/bash
GO := $(shell which go 2>/dev/null || echo "/opt/homebrew/bin/go")
NPM := npm

.PHONY: all dev run build test test-backend test-frontend test-e2e lint clean bazel-build bazel-test bazel-gazelle bazel-clean

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

# Build and run standalone binary
run: build
	@echo "Starting GitHelp standalone binary on http://127.0.0.1:8080..."
	@./bin/githelp

# Run dev mode (backend + frontend dev servers)
dev:
	@echo "Starting GitHelp in development mode..."
	@trap 'kill 0' SIGINT SIGTERM EXIT; \
	(cd backend && $(GO) run ./cmd/server -dev -port 8080) & \
	(cd frontend && $(NPM) run dev) & \
	wait

# Run backend unit and integration tests with race detector
test-backend:
	@echo "Running backend unit and integration tests..."
	@cd backend && $(GO) test -v -race ./...

# Run frontend unit and component tests via Vitest
test-frontend:
	@echo "Running frontend unit and component tests..."
	@cd frontend && ./node_modules/.bin/vitest run

# Run end-to-end browser tests via Playwright
test-e2e: build
	@echo "Running Playwright E2E browser tests..."
	@NODE_PATH=$(CURDIR)/frontend/node_modules ./frontend/node_modules/.bin/playwright test --config=e2e/playwright.config.ts

# Run all test suites (unit, integration, E2E)
test: test-backend test-frontend test-e2e

# Lint codebase
lint:
	@echo "Linting Go code..."
	@cd backend && $(GO) vet ./...
	@echo "Linting frontend code..."
	@cd frontend && $(NPM) run lint

# Clean build artifacts and temporary test databases
clean:
	@rm -rf bin/ backend/bin/ frontend/dist/ backend/cmd/server/dist/assets/ *.db *.db-wal *.db-shm /tmp/e2e_githelp.db* /tmp/live_test.db* test-results/ playwright-report/

# Bazel monorepo targets
bazel-build:
	@./bazel build //...

bazel-test:
	@./bazel test //...

bazel-gazelle:
	@./bazel run //:gazelle

bazel-clean:
	@./bazel clean --expunge

	@echo "Cleaned build and test artifacts."
