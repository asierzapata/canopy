## Project Overview

Menudo is a TypeScript monorepo built with Turbo that consists of:

- **@canopy/core**: Core business logic package with domain modules and services

The project follows Domain-Driven Design (DDD) principles with Clean Architecture patterns.

## Development Commands

```bash
# Development
yarn dev              # Start all applications in parallel
yarn dev:web         # Start only the web application

# Building
yarn build           # Build all packages
yarn build:web       # Build only the web application

# Code Quality
yarn lint            # Run linting across all packages
yarn lint:fix        # Fix linting issues
yarn type-check      # Run TypeScript type checking
yarn format          # Format code with Prettier

# Testing
yarn test            # Run tests across all packages (uses Vitest)
yarn workspace @canopy/core test # Run tests for the core package only

# Database
yarn workspace @canopy/server db:start        # Start MongoDB via Docker Compose (web package)

# Cleaning
yarn clean           # Clean node_modules
yarn clean:workspaces # Clean all workspace build artifacts
```

## Documentation

There is a folder named `documentation/` at the root of the repo that contains markdown files with high-level overviews of the architecture and design decisions for different parts of the project. These documents are intended to help you understand the system quickly.
