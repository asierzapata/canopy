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

## Architecture Rules

### Module Boundaries

**CRITICAL: Never access repositories of other modules directly.**

When one module needs to interact with another module's data:
- ❌ **WRONG**: `dependencies.otherModuleRepository.method()`
- ✅ **CORRECT**: Call the other module's use cases through the modules API

**Example:**
```typescript
// ❌ BAD - Direct repository access across modules
await dependencies.workspaceMemberRepository.addMember({...})

// ✅ GOOD - Use the module's public API
await modules.workspaceMember.addWorkspaceMember(params, session)
```

**Rationale:**
- Preserves module encapsulation and boundaries
- Ensures authorization checks are always performed
- Prevents bypassing business logic in use cases
- Makes dependencies between modules explicit and traceable

**Note:** Within a single module, repositories are accessed directly by use cases. This rule only applies to cross-module interactions.

### Idempotency

**CRITICAL: Use cases should be idempotent whenever possible.**

Idempotent operations can be called multiple times with the same parameters and produce the same result, making them safe for retries and improving system reliability.

**Guidelines:**

- **Create/Add operations**: If the resource already exists with the same properties, succeed without error
  - If properties differ, update to match the requested state
- **Delete/Remove operations**: If the resource doesn't exist, succeed without error (desired state achieved)
- **Update operations**: Apply the changes; repeated calls with same data should succeed
- **Read operations**: Naturally idempotent

**Examples:**
```typescript
// ✅ GOOD - Idempotent add operation
async function addWorkspaceMember(params, deps) {
  const existing = await deps.repository.getMember(params.workspaceId, params.userId)

  if (existing) {
    // Same role? Succeed silently
    if (existing.role === params.role) return
    // Different role? Update it
    await deps.repository.updateMemberRole(params.workspaceId, params.userId, params.role)
    return
  }

  await deps.repository.addMember({...params, joinedAt: Date.now(), updatedAt: Date.now()})
}

// ✅ GOOD - Idempotent remove operation
async function removeWorkspaceMember(params, deps) {
  const member = await deps.repository.getMember(params.workspaceId, params.userId)

  // Already removed? Succeed (desired state achieved)
  if (!member) return

  await deps.repository.removeMember(params.workspaceId, params.userId)
}

// ❌ BAD - Not idempotent (throws error on duplicate)
async function addWorkspaceMember(params, deps) {
  const existing = await deps.repository.getMember(params.workspaceId, params.userId)
  if (existing) {
    throw WorkspaceMemberAlreadyExistsError.create() // Forces caller to handle retries
  }
  await deps.repository.addMember(params)
}
```

**Rationale:**
- Safe retries in case of network failures or timeouts
- Simplifies client code (no need to handle "already exists" errors)
- Better resilience in distributed systems
- Follows HTTP semantic conventions (PUT is idempotent)

**Exceptions:** Some operations are inherently non-idempotent (e.g., generating unique IDs, incrementing counters). Document these clearly.
