# Feature API Implementation Plan

## Goal

Implement the Feature API that allows creating, reading, and managing features within workspaces. This includes both the core domain module (@canopy/core) and the HTTP API routes (@canopy/server).

## Context

### Important Files and Folders

**Core Module Structure:**
- `/packages/core/src/modules/workspace/` - Reference for module structure
- `/packages/core/src/modules/workspace/domain/workspace.ts` - Domain entity example
- `/packages/core/src/modules/workspace/application/` - Use case examples
- `/packages/core/src/modules/workspace/infrastructure/repository/` - Repository implementation examples
- `/packages/core/src/lib/handler_factory.ts` - Handler factory for use cases

**Server Structure:**
- `/packages/server/src/api/workspaces/index.ts` - Reference for API route structure
- `/packages/server/src/utils/response_factory.ts` - Response helpers
- `/packages/server/src/middleware/` - Authentication and authorization middleware

**Documentation:**
- `/documentation/canopy-backend-architecture-brainstorm.md` - Feature concept and data model
- `/documentation/server.md` - Architecture patterns
- `/documentation/how-to-document.md` - Documentation guidelines

### Public Contracts

#### Domain Entity
```typescript
// Feature entity schema
{
  id: uuid,
  workspaceId: uuid,
  title: string,
  description?: string,
  status: 'planning' | 'in_progress' | 'completed' | 'cancelled',
  sharedContext: {
    decisions: Array<{ decision: string, madeBy: string, sessionId?: string }>,
    keyFiles: Array<string>
  },
  sessionIds: Array<uuid>,
  createdBy: uuid,
  createdAt: number,
  updatedAt: number
}
```

#### Application Services

**CreateFeature**
```typescript
createFeature(params: {
  workspaceId: uuid,
  title: string,
  description?: string,
  createdBy: uuid
}, session: Session): Promise<Feature>
```

**GetFeatureById**
```typescript
getFeatureById(params: {
  featureId: uuid
}, session: Session): Promise<Feature>
```

**GetWorkspaceFeatures**
```typescript
getWorkspaceFeatures(params: {
  workspaceId: uuid
}, session: Session): Promise<Feature[]>
```

**UpdateFeatureStatus**
```typescript
updateFeatureStatus(params: {
  featureId: uuid,
  status: FeatureStatus
}, session: Session): Promise<Feature>
```

**AddDecisionToFeature**
```typescript
addDecisionToFeature(params: {
  featureId: uuid,
  decision: string,
  madeBy: string,
  sessionId?: string
}, session: Session): Promise<Feature>
```

**AddSessionToFeature**
```typescript
addSessionToFeature(params: {
  featureId: uuid,
  sessionId: uuid
}, session: Session): Promise<Feature>
```

#### API Routes

- `POST /api/features` - Create a new feature
- `GET /api/features/:featureId` - Get feature by ID
- `GET /api/workspaces/:workspaceId/features` - Get all features in a workspace
- `PATCH /api/features/:featureId/status` - Update feature status
- `POST /api/features/:featureId/decisions` - Add decision to feature
- `POST /api/features/:featureId/sessions` - Add session to feature

## Phases

### Phase 1: Core Module - Domain Layer

**Description:** Create the Feature domain entity with Zod schema validation and domain-specific errors.

**To-do list:**
- [ ] Create `/packages/core/src/modules/feature/domain/feature.ts` with Zod schema
- [ ] Define FeatureStatus enum ('planning', 'in_progress', 'completed', 'cancelled')
- [ ] Define SharedContext type (decisions, keyFiles)
- [ ] Create `/packages/core/src/modules/feature/domain/errors/feature-not-found.ts`
- [ ] Create `/packages/core/src/modules/feature/domain/errors/unauthorized-feature-access.ts`
- [ ] Create `/packages/core/src/modules/feature/domain/errors/feature-already-exists.ts`
- [ ] Create `/packages/core/src/modules/feature/domain/errors/invalid-feature-status.ts`

**Verification:**
- Run `yarn type-check` - should pass without errors
- All Zod schemas are properly exported
- Error classes extend ApplicationError correctly
- Domain types are properly exported

### Phase 2: Core Module - Infrastructure Layer

**Description:** Implement the repository interface and MongoDB repository for Feature persistence.

**To-do list:**
- [ ] Create `/packages/core/src/modules/feature/infrastructure/repository/index.ts` with FeatureRepository interface
- [ ] Define repository methods: saveFeature, findById, findByWorkspaceId, updateFeatureStatus, addDecision, addSession, generateId
- [ ] Create `/packages/core/src/modules/feature/infrastructure/repository/mongodb-feature-repository.ts`
- [ ] Implement all repository methods with MongoDB operations
- [ ] Add proper error handling and type safety

**Verification:**
- Run `yarn type-check` - should pass without errors
- Repository interface matches all planned use cases
- MongoDB repository implements all interface methods correctly
- Proper indexing on workspaceId and id fields

### Phase 3: Core Module - Application Layer (Part 1 - Create & Get)

**Description:** Implement create and get use cases with authorization and tests.

**To-do list:**
- [ ] Create `/packages/core/src/modules/feature/application/create_feature/create-feature-use-case.ts`
- [ ] Implement createFeature handler with validation (user must be in workspace)
- [ ] Implement authorizeCreateFeature (user must be authenticated and in workspace)
- [ ] Create `/packages/core/src/modules/feature/application/create_feature/create-feature-use-case.spec.ts` with tests
- [ ] Create `/packages/core/src/modules/feature/application/get_feature_by_id/get-feature-by-id-use-case.ts`
- [ ] Implement getFeatureById handler
- [ ] Implement authorizeGetFeatureById (user must be in the workspace that owns the feature)
- [ ] Create `/packages/core/src/modules/feature/application/get_feature_by_id/get-feature-by-id-use-case.spec.ts` with tests

**Verification:**
- Run `yarn workspace @canopy/core test` - all tests should pass
- Run `yarn type-check` - should pass without errors
- Test coverage includes success cases and error cases (unauthorized, not found)
- Authorization checks are properly implemented

### Phase 4: Core Module - Application Layer (Part 2 - List & Update)

**Description:** Implement workspace features listing and status update use cases with tests.

**To-do list:**
- [ ] Create `/packages/core/src/modules/feature/application/get_workspace_features/get-workspace-features-use-case.ts`
- [ ] Implement getWorkspaceFeatures handler
- [ ] Implement authorizeGetWorkspaceFeatures (user must be in workspace)
- [ ] Create `/packages/core/src/modules/feature/application/get_workspace_features/get-workspace-features-use-case.spec.ts` with tests
- [ ] Create `/packages/core/src/modules/feature/application/update_feature_status/update-feature-status-use-case.ts`
- [ ] Implement updateFeatureStatus handler with status validation
- [ ] Implement authorizeUpdateFeatureStatus (user must be in workspace)
- [ ] Create `/packages/core/src/modules/feature/application/update_feature_status/update-feature-status-use-case.spec.ts` with tests

**Verification:**
- Run `yarn workspace @canopy/core test` - all tests should pass
- Run `yarn type-check` - should pass without errors
- Status transitions are validated
- Authorization checks work correctly

### Phase 5: Core Module - Application Layer (Part 3 - Context Management)

**Description:** Implement use cases for managing feature context (decisions and sessions).

**To-do list:**
- [ ] Create `/packages/core/src/modules/feature/application/add_decision_to_feature/add-decision-to-feature-use-case.ts`
- [ ] Implement addDecisionToFeature handler
- [ ] Implement authorizeAddDecisionToFeature (user must be in workspace)
- [ ] Create `/packages/core/src/modules/feature/application/add_decision_to_feature/add-decision-to-feature-use-case.spec.ts` with tests
- [ ] Create `/packages/core/src/modules/feature/application/add_session_to_feature/add-session-to-feature-use-case.ts`
- [ ] Implement addSessionToFeature handler
- [ ] Implement authorizeAddSessionToFeature (user must be in workspace)
- [ ] Create `/packages/core/src/modules/feature/application/add_session_to_feature/add-session-to-feature-use-case.spec.ts` with tests

**Verification:**
- Run `yarn workspace @canopy/core test` - all tests should pass
- Run `yarn type-check` - should pass without errors
- Decisions are properly appended to sharedContext
- Session IDs are properly added to sessionIds array
- No duplicate sessions are added

### Phase 6: Core Module - Module Integration

**Description:** Create the module index file that exports all handlers and integrates with dependency injection.

**To-do list:**
- [ ] Create `/packages/core/src/modules/feature/index.ts`
- [ ] Import all use cases and authorization functions
- [ ] Create ModuleDependencies type for feature module
- [ ] Implement handlers factory function using createHandler
- [ ] Implement getModuleDependencies to create repository
- [ ] Export all handlers and types
- [ ] Update `/packages/core/src/modules/index.ts` to include feature module
- [ ] Update module dependencies types to include feature

**Verification:**
- Run `yarn type-check` - should pass without errors
- Run `yarn build` - should build successfully
- All handlers are properly exported
- Module is registered in the main modules index
- Dependency injection works correctly

### Phase 7: Server - API Routes (Part 1 - Create & Get)

**Description:** Implement HTTP endpoints for creating and retrieving features.

**To-do list:**
- [ ] Create `/packages/server/src/api/features/index.ts`
- [ ] Add Zod validation schemas for request/response
- [ ] Implement `POST /api/features` - Create new feature
- [ ] Add proper error handling with HTTPException
- [ ] Implement `GET /api/features/:featureId` - Get feature by ID
- [ ] Add authentication checks using session
- [ ] Use successResponse helper for consistent responses

**Verification:**
- Run `yarn type-check` - should pass without errors
- Run `yarn build` - should build successfully
- Manual test: Create a feature via POST and verify response
- Manual test: Get feature by ID and verify response
- Error cases return appropriate HTTP status codes

### Phase 8: Server - API Routes (Part 2 - List & Update)

**Description:** Implement HTTP endpoints for listing workspace features and updating feature status.

**To-do list:**
- [ ] Implement `GET /api/workspaces/:workspaceId/features` - Get all features in workspace
- [ ] Add proper parameter validation with Zod
- [ ] Implement `PATCH /api/features/:featureId/status` - Update feature status
- [ ] Add status validation schema
- [ ] Add proper error handling for all routes
- [ ] Ensure authorization is enforced via session

**Verification:**
- Run `yarn type-check` - should pass without errors
- Run `yarn build` - should build successfully
- Manual test: List workspace features
- Manual test: Update feature status
- Verify unauthorized access is properly blocked

### Phase 9: Server - API Routes (Part 3 - Context Management)

**Description:** Implement HTTP endpoints for managing feature context (decisions and sessions).

**To-do list:**
- [ ] Implement `POST /api/features/:featureId/decisions` - Add decision to feature
- [ ] Add request validation for decision payload
- [ ] Implement `POST /api/features/:featureId/sessions` - Add session to feature
- [ ] Add request validation for session payload
- [ ] Update `/packages/server/src/api/index.ts` to include features router
- [ ] Add features routes to main API router with `/api/features` prefix

**Verification:**
- Run `yarn type-check` - should pass without errors
- Run `yarn build` - should build successfully
- Run `yarn dev` - server should start without errors
- Manual test: Add decision to feature
- Manual test: Add session to feature
- All API routes are accessible and functional

### Phase 10: Integration Testing & Commit

**Description:** Perform end-to-end testing of the feature API and prepare for commit.

**To-do list:**
- [ ] Test complete feature lifecycle: create → add decisions → add sessions → update status
- [ ] Test multi-workspace isolation (features in workspace A not visible from workspace B)
- [ ] Test authorization: unauthorized users cannot access features
- [ ] Verify all error cases return appropriate responses
- [ ] Run full test suite: `yarn test`
- [ ] Run linting: `yarn lint`
- [ ] Fix any linting issues: `yarn lint:fix`
- [ ] Run build: `yarn build`
- [ ] Commit changes with descriptive message

**Verification:**
- All tests pass (`yarn test`)
- No linting errors (`yarn lint`)
- Build succeeds (`yarn build`)
- Server runs without errors (`yarn dev`)
- All API endpoints are documented and working
- Feature API is fully functional and integrated

## Documentation to Update

Once all phases are completed, create/update the following documentation:

1. **Create `/documentation/feature-api.md`:**
   - Overview of the Feature concept and its role in Canopy
   - Architecture explanation (domain, application, infrastructure layers)
   - API endpoint documentation with request/response examples
   - Key decisions made during implementation
   - Integration with workspaces and sessions
   - Future considerations (vector search for context inheritance, etc.)

2. **Update `/documentation/server.md`:**
   - Add Feature module to the list of domain modules
   - Document the Feature API routes

3. **Update `/documentation/canopy-product-overview.md`:**
   - Update with implementation details of the Feature system
   - Note any deviations from the original brainstorm

## Next Step

Begin with **Phase 1: Core Module - Domain Layer** by creating the Feature domain entity with Zod schema and domain errors.
