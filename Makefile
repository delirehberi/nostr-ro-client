.DEFAULT_GOAL := help

.PHONY: help install dev start test test-watch deploy tail types clean

help: ## Show this help message with available commands
	@echo "Available commands:"
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

install: ## Install dependencies
	npm ci

dev: ## Start local development server
	npm run dev

start: dev ## Alias for dev

test: ## Run test suite once
	npx vitest run

test-watch: ## Run test suite in watch mode
	npm run test

build: ## Build frontend assets
	npm run build

deploy: ## Deploy worker and static assets to Cloudflare
	npm run deploy

tail: ## Tail live logs from deployed Cloudflare Worker
	npx wrangler tail

types: ## Generate Cloudflare Worker TypeScript/env types
	npx wrangler types

clean: ## Clean local build artifacts and cache
	rm -rf .wrangler
