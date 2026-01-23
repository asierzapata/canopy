# CLAUDE.md - Core Package Best Practices

This file provides guidance to Claude Code (claude.ai/code) when working with the `@canopy/core` package.

## Architecture Overview

The core package follows **Clean Architecture** principles with **Domain-Driven Design (DDD)** patterns. Each module is organized into distinct layers with clear separation of concerns.

## Module Structure

Every domain module follows this exact structure:

```
modules/{domain}/
├── domain/
│   ├── {entity}.ts           # Zod schemas and type exports
│   └── errors/               # Domain-specific errors
├── application/
│   └── {use_case}/
│       ├── {use-case}.ts     # Use case implementation
│       └── {use-case}.spec.ts # Integration tests
├── infrastructure/
│   └── repository/
│       ├── index.ts          # Repository interface
│       └── mongodb-{entity}-repository.ts # MongoDB implementation
└── index.ts                  # Module factory and exports
```

## Clean Architecture Layers

### 1. Domain Layer (`domain/`)

- **Purpose**: Core business entities and rules
- **Dependencies**: None (pure business logic)
- **Patterns**:
  - Use Zod schemas for validation and type inference
  - Export individual types for each schema property
  - Create domain-specific errors extending `ApplicationError`

**Example**:

```typescript
// domain/workspace.ts
export const workspaceSchema = z.object({
	id: z.uuid(),
	name: z.string(),
	userIds: z.array(z.uuid()),
	createdAt: z.number(),
	updatedAt: z.number(),
});

export type Workspace = z.infer<typeof workspaceSchema>;
export type Id = z.infer<typeof workspaceSchema>["id"];
export type Name = z.infer<typeof workspaceSchema>["name"];
// ... other type exports
```

### 2. Application Layer (`application/`)

- **Purpose**: Use cases and business workflows. Each use case has to represent an action the user can perform.
- **Dependencies**: Domain layer only
- **Patterns**:
  - Each use case has its own directory
  - Implement authorization logic separately from business logic
  - Use the handler factory pattern for consistent behavior

**Use Case Structure**:

```typescript
/* ====================================================== */
/*                        Domain                          */
/* ====================================================== */

// Import domain entities and errors

/* ====================================================== */
/*                        Types                           */
/* ====================================================== */

// Define parameter types and dependencies

/* ====================================================== */
/*                    Implementation                      */
/* ====================================================== */

// Main use case logic

/* ====================================================== */
/*                       Authorize                        */
/* ====================================================== */

// Authorization logic (separate function)

/* ====================================================== */
/*                      Public API                        */
/* ====================================================== */
// Exports
```

### 3. Infrastructure Layer (`infrastructure/`)

- **Purpose**: External adapters (database, APIs, etc.)
- **Dependencies**: Domain layer for entities
- **Patterns**:
  - Repository pattern for data access
  - MongoDB-specific implementations with UUID handling
  - Schema validation on repository boundaries

## Error Handling

### Domain Errors

- Extend `ApplicationError` class
- Use consistent naming: `{Domain}{Action}Error`
- Provide meaningful error messages and HTTP status codes
- Use static factory methods

**Example**:

```typescript
export class WorkspaceNotFoundError extends ApplicationError {
	public static readonly errorName =
		"canopy.1.error.workspace.workspace_not_found";

	static create({
		message = "Workspace not found",
		code = "workspace-not-found",
	}: {
		message?: string;
		code?: string;
	} = {}) {
		return this.Operational({
			errorName: this.errorName,
			message,
			code,
			statusCode: 404,
		});
	}
}
```

## Testing Best Practices

### Integration Testing

- Use Vitest with MongoDB Memory Server
- Test real database interactions, not mocks
- Use `inject('mongoUri')` from global setup
- Create separate database instances per test suite

**Test Structure**:

```typescript
describe('Use Case | {Feature Name}', () => {
  let db: Db
  let dependencies: ModuleDependencies

  beforeEach(async () => {
    const mongoUri = inject('mongoUri')
    db = await getDb({ dbName: '{unique-db-name}', mongoUri })
    dependencies = {
      repository: createMongoDB{Entity}Repository({ db }),
    }
  })

  describe('{useCase}', () => {
    test('should {behavior}', async () => {
      // Test implementation
    })
  })

  describe('authorize{UseCase}', () => {
    test('should allow {authorized scenario}', () => {
      // Authorization tests
    })
  })
})
```

### Test Naming

- Use descriptive test suite names: `"Use Case | {Feature Name}"`
- Use `test()` instead of `it()` for consistency
- Test both success and error scenarios
- Test authorization separately from business logic

## Authorization Patterns

### Session-Based Authorization

- Always check `session.isAuthenticated()` first
- Use `session.getDistinctId()` to get current user ID
- Implement resource-level authorization (users can only access their resources)
- Separate authorization from business logic

**Authorization Examples**:

```typescript
// Basic authentication check
if (!session.isAuthenticated()) {
	throw UnauthenticatedError.create();
}

// Resource ownership check
const userId = session.getDistinctId();
if (userId !== parameters.userId) {
	throw UnauthorizedWorkspaceAccessError.create();
}

// Workspace membership check
if (!workspace.userIds.includes(userId!)) {
	throw UnauthorizedWorkspaceAccessError.create();
}
```

## Repository Patterns

### MongoDB Implementation

- Use MongoDB UUID for `_id` field
- Parse entities using Zod schemas
- Create appropriate indexes for queries
- Handle entity transformation between domain and DB formats

**Repository Structure**:

```typescript
export function createMongoDB{Entity}Repository({ db }: { db: Db }): {Entity}Repository {
  const collection: Collection<DB{Entity}> = db.collection('{entities}')

  // Ensure indexes
  const ensureIndex = () => {
    // Create relevant indexes
  }

  // Parse entity from DB format to domain format
  const parse{Entity} = (entity: DB{Entity} | null): {Entity} | null => {
    if (!entity) return null
    return {entity}Schema.parse({
      id: entity._id.toString(),
      // ... other fields
    })
  }

  ensureIndex()

  return {
    // Implement repository interface
  }
}
```

## Module Integration

### Handler Factory Pattern

- Use `createHandler` for consistent use case handling
- Wrap authorization and business logic together
- Provide proper dependency injection

**Module Index Structure**:

```typescript
const handlers = (dependencies: ModulesDependencies) => {
  const moduleDependencies = {
    ...dependencies,
    ...getModuleDependencies(dependencies),
  }

  return {
    {useCase}: createHandler({
      authorize: authorize{UseCase},
      handler: {useCase},
      dependencies: moduleDependencies,
    }),
    entitySchema: {entity}Schema,
  }
}
```

## Development Commands

```bash
# Run tests for core package only
yarn workspace @canopy/core test

# Run specific test file
yarn workspace @canopy/core test {test-file-pattern}
```

## Key Dependencies

- **Zod**: Schema validation and type inference
- **MongoDB**: Database with UUID handling
- **Vitest**: Testing framework with MongoDB Memory Server
- **UUID**: ID generation for entities

## Important Notes

- Always validate entities using Zod schemas at repository boundaries
- Use dependency injection for all external dependencies
- Keep domain layer pure (no external dependencies)
- Test with real database connections, not mocks
- Follow consistent error naming and HTTP status codes
- Use the `session.getDistinctId()` method for user identification in authorization
