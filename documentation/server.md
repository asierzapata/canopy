## Core Architecture

### Domain Modules (`packages/core/src/modules/`)

Each domain module follows Clean Architecture:

- **Domain**: Core entities and business rules (e.g., `user.ts`, `workspace.ts`)
- **Application**: Use cases and application services
- **Infrastructure**: External adapters (MongoDB repositories, etc.)

Current modules:

- **User**: User management with Zod schemas for validation
- **Account**: Account management for authentication providers
- **Workspace**: Multi-tenant workspace functionality

### Services (`packages/core/src/services/`)

- **Authentication**: JWT-based auth with session management
- **UUID**: ID generation utilities

### Key Technologies

- **Validation**: Zod schemas for all domain entities
- **Database**: MongoDB with memory server for testing
- **Testing**: Vitest with custom global setup for database
- **Authentication**: JWT with Google OAuth integration
- **Frontend**: Next.js with TypeScript and Tailwind CSS

### Testing Setup

Tests use Vitest with MongoDB Memory Server. The global setup (`packages/core/src/testing/global-setup.ts`) manages test database lifecycle.

## Environment Variables

The web application requires these environment variables (see `turbo.json` for complete list):

- `MONGODB_URI`
- `AUTH_JWT_SECRET` and related JWT configuration
- `AUTH_COOKIE_NAME` / `AUTH_COOKIE_DOMAIN`
