# Streaming Avatar Demo
SHELL := /bin/bash

NPM=npm

CURRENT_DIR=$(PWD)

.PHONY: help
help:
	@echo ""
	@echo "Streaming Avatar Demo Makefile."
	@echo "The following commands are available:"
	@echo ""
	@echo "    make help      : shows this message"
	@echo "    make install   : install dependencies"
	@echo "    make dev       : start dev server (http://localhost:5173)"
	@echo "    make build     : type-check and build for production → dist/"
	@echo "    make preview   : serve the production build"
	@echo "    make clean     : remove node_modules and dist"
	@echo ""

.PHONY: install
install:
	$(NPM) install

.PHONY: dev
dev:
	$(NPM) run dev

.PHONY: build
build:
	$(NPM) run build

.PHONY: preview
preview:
	$(NPM) run preview

.PHONY: clean
clean:
	rm -rf node_modules dist
