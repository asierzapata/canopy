# Workspace Members Implementation Plan

## Goal

Implement a dedicated WorkspaceMember module to manage workspace membership, serving as a central point to verify workspace access and support future extensions like roles and permissions.

## Context

### Important Files and Patterns

**Existing Architecture References:**
- `/home/user/canopy/packages/core/src/modules/workspace/` - Current workspace module with simple userIds array
- `/home/user/canopy/packages/core/src/modules/user/` - User module for reference patterns
- `/home/user/canopy/packages/core/src/lib/handler_factory.ts` - Handler factory pattern for use cases
- `/home/user/canopy/packages/core/src/lib/application-error.ts` - Error handling pattern
- `/home/user/canopy/packages/core/src/services/authentication/session/session.ts` - Session and authorization
- `/home/user/canopy/packages/core/src/testing/db.ts` - Testing utilities

**Documentation:**
- `/home/user/canopy/documentation/canopy-product-overview.md` - Product requirements and architecture
- `/home/user/canopy/documentation/how-to-document.md` - Documentation guidelines

**Key Patterns:**
- Domain-Driven Design with Clean Architecture
- Repository pattern with MongoDB implementation
- Handler factory for authorization
- Zod schemas for domain entities
- Integration tests with MongoDB Memory Server

### Public Contracts

**Domain Entity:**
```typescript
WorkspaceMember {
  id: UUID
  workspaceId: UUID
  userId: string
  role: 'owner' | 'member'
  joinedAt: number
  updatedAt: number
}
```

**Application Services:**
1. `checkWorkspaceMembership` - Verify if user belongs to workspace
2. `addWorkspaceMember` - Add user to workspace with role
3. `removeWorkspaceMember` - Remove user from workspace
4. `getWorkspaceMembers` - Get all members of a workspace
5. `getMemberWorkspaces` - Get all workspaces for a user

**Repository Interface:**
- `addMember()` - Add new member
- `removeMember()` - Remove member
- `getMembersByWorkspaceId()` - Get all workspace members
- `getMembersByUserId()` - Get all user memberships
- `getMember()` - Get specific member record
- `isMember()` - Check membership existence
- `updateMemberRole()` - Update member role
- `generateId()` - Generate new ID

**Domain Errors:**
- `WorkspaceMemberNotFoundError` (404)
- `WorkspaceMemberAlreadyExistsError` (409)
- `UnauthorizedWorkspaceMemberOperationError` (403)

---

## Phases

### Phase 1: Domain Layer - Entity and Errors

**Description:** Create the WorkspaceMember domain entity with Zod schema validation and domain-specific error classes.

**To-do:**
- [ ] Create `/packages/core/src/modules/workspace_member/domain/workspace-member.ts`
  - [ ] Define WorkspaceMember Zod schema with id, workspaceId, userId, role, joinedAt, updatedAt
  - [ ] Define Role enum type ('owner' | 'member')
  - [ ] Export type and individual property types (Id, WorkspaceId, UserId, Role, etc.)
- [ ] Create `/packages/core/src/modules/workspace_member/domain/errors/workspace-member-not-found.ts`
  - [ ] Extend ApplicationError
  - [ ] Set status code 404
  - [ ] Add static factory method
- [ ] Create `/packages/core/src/modules/workspace_member/domain/errors/workspace-member-already-exists.ts`
  - [ ] Extend ApplicationError
  - [ ] Set status code 409
  - [ ] Add static factory method
- [ ] Create `/packages/core/src/modules/workspace_member/domain/errors/unauthorized-workspace-member-operation.ts`
  - [ ] Extend ApplicationError
  - [ ] Set status code 403
  - [ ] Add static factory method
- [ ] Create `/packages/core/src/modules/workspace_member/domain/workspace-member.spec.ts`
  - [ ] Test valid member creation
  - [ ] Test schema validation for required fields
  - [ ] Test role enum validation
  - [ ] Test timestamp validation

**Verification:**
- Run `yarn workspace @canopy/core test workspace-member.spec.ts`
- All domain validation tests pass
- No type errors in domain layer

---

### Phase 2: Infrastructure Layer - Repository

**Description:** Define the WorkspaceMemberRepository interface and implement MongoDB-based data access layer with proper indexing.

**To-do:**
- [ ] Create `/packages/core/src/modules/workspace_member/infrastructure/repository/index.ts`
  - [ ] Define WorkspaceMemberRepository interface with all methods
  - [ ] Export interface type
- [ ] Create `/packages/core/src/modules/workspace_member/infrastructure/repository/mongodb-workspace-member-repository.ts`
  - [ ] Implement MongoDB repository class
  - [ ] Add collection initialization with indexes:
    - [ ] Index on `workspaceId`
    - [ ] Index on `userId`
    - [ ] Compound unique index on `(workspaceId, userId)`
  - [ ] Implement `addMember()` with duplicate prevention
  - [ ] Implement `removeMember()`
  - [ ] Implement `getMembersByWorkspaceId()`
  - [ ] Implement `getMembersByUserId()`
  - [ ] Implement `getMember()`
  - [ ] Implement `isMember()`
  - [ ] Implement `updateMemberRole()`
  - [ ] Implement `generateId()` using UUID
  - [ ] Add proper error handling and schema validation
- [ ] Create `/packages/core/src/modules/workspace_member/infrastructure/repository/mongodb-workspace-member-repository.spec.ts`
  - [ ] Test addMember creates record correctly
  - [ ] Test addMember prevents duplicates
  - [ ] Test removeMember deletes record
  - [ ] Test getMembersByWorkspaceId returns correct members
  - [ ] Test getMembersByUserId returns correct workspaces
  - [ ] Test getMember returns specific record
  - [ ] Test isMember returns boolean correctly
  - [ ] Test updateMemberRole updates role field
  - [ ] Test generateId creates valid UUID

**Verification:**
- Run `yarn workspace @canopy/core test mongodb-workspace-member-repository.spec.ts`
- All repository tests pass
- MongoDB indexes are created correctly
- No data corruption or duplicate entries

---

### Phase 3: Application Service - Check Workspace Membership

**Description:** Implement the checkWorkspaceMembership use case to verify if a user belongs to a workspace. This is a foundational service used by other authorization checks.

**To-do:**
- [ ] Create `/packages/core/src/modules/workspace_member/application/check_workspace_membership/check-workspace-membership.ts`
  - [ ] Define CheckWorkspaceMembershipParameters type (workspaceId, userId)
  - [ ] Define CheckWorkspaceMembershipDependencies type
  - [ ] Implement authorization function (authenticated users only)
  - [ ] Implement handler function using repository.isMember()
  - [ ] Export handler with handler factory
  - [ ] Export authorization function
- [ ] Create `/packages/core/src/modules/workspace_member/application/check_workspace_membership/check-workspace-membership.spec.ts`
  - [ ] Test successful membership check returns true
  - [ ] Test non-membership check returns false
  - [ ] Test unauthenticated session throws error
  - [ ] Test authorization with authenticated session passes

**Verification:**
- Run `yarn workspace @canopy/core test check-workspace-membership.spec.ts`
- All tests pass
- Can verify membership correctly
- Proper authorization enforcement

---

### Phase 4: Application Service - Add Workspace Member

**Description:** Implement the addWorkspaceMember use case to add users to workspaces with a specific role.

**To-do:**
- [ ] Create `/packages/core/src/modules/workspace_member/application/add_workspace_member/add-workspace-member.ts`
  - [ ] Define AddWorkspaceMemberParameters type (workspaceId, userId, role)
  - [ ] Define AddWorkspaceMemberDependencies type
  - [ ] Implement authorization function:
    - [ ] Check authenticated session
    - [ ] Verify requester is workspace member using repository.isMember()
  - [ ] Implement handler function:
    - [ ] Check if member already exists
    - [ ] Throw WorkspaceMemberAlreadyExistsError if duplicate
    - [ ] Add member with timestamps using repository.addMember()
  - [ ] Export handler with handler factory
  - [ ] Export authorization function
- [ ] Create `/packages/core/src/modules/workspace_member/application/add_workspace_member/add-workspace-member.spec.ts`
  - [ ] Test successful member addition
  - [ ] Test duplicate member throws WorkspaceMemberAlreadyExistsError
  - [ ] Test unauthenticated session throws error
  - [ ] Test non-member requester throws UnauthorizedWorkspaceMemberOperationError
  - [ ] Test member addition with owner role
  - [ ] Test member addition with member role

**Verification:**
- Run `yarn workspace @canopy/core test add-workspace-member.spec.ts`
- All tests pass
- Can add members with correct roles
- Duplicate prevention works
- Authorization enforced correctly

---

### Phase 5: Application Service - Remove Workspace Member

**Description:** Implement the removeWorkspaceMember use case to remove users from workspaces.

**To-do:**
- [ ] Create `/packages/core/src/modules/workspace_member/application/remove_workspace_member/remove-workspace-member.ts`
  - [ ] Define RemoveWorkspaceMemberParameters type (workspaceId, userId)
  - [ ] Define RemoveWorkspaceMemberDependencies type
  - [ ] Implement authorization function:
    - [ ] Check authenticated session
    - [ ] Verify requester is workspace member
  - [ ] Implement handler function:
    - [ ] Check if member exists using repository.getMember()
    - [ ] Throw WorkspaceMemberNotFoundError if not found
    - [ ] Remove member using repository.removeMember()
  - [ ] Export handler with handler factory
  - [ ] Export authorization function
- [ ] Create `/packages/core/src/modules/workspace_member/application/remove_workspace_member/remove-workspace-member.spec.ts`
  - [ ] Test successful member removal
  - [ ] Test removing non-existent member throws WorkspaceMemberNotFoundError
  - [ ] Test unauthenticated session throws error
  - [ ] Test non-member requester throws UnauthorizedWorkspaceMemberOperationError

**Verification:**
- Run `yarn workspace @canopy/core test remove-workspace-member.spec.ts`
- All tests pass
- Can remove members successfully
- Error handling for non-existent members works
- Authorization enforced correctly

---

### Phase 6: Application Service - Get Workspace Members

**Description:** Implement the getWorkspaceMembers use case to retrieve all members of a workspace.

**To-do:**
- [ ] Create `/packages/core/src/modules/workspace_member/application/get_workspace_members/get-workspace-members.ts`
  - [ ] Define GetWorkspaceMembersParameters type (workspaceId)
  - [ ] Define GetWorkspaceMembersDependencies type
  - [ ] Implement authorization function:
    - [ ] Check authenticated session
    - [ ] Verify requester is workspace member
  - [ ] Implement handler function:
    - [ ] Return members using repository.getMembersByWorkspaceId()
  - [ ] Export handler with handler factory
  - [ ] Export authorization function
- [ ] Create `/packages/core/src/modules/workspace_member/application/get_workspace_members/get-workspace-members.spec.ts`
  - [ ] Test returns all workspace members
  - [ ] Test returns empty array for workspace with no members
  - [ ] Test unauthenticated session throws error
  - [ ] Test non-member requester throws UnauthorizedWorkspaceMemberOperationError

**Verification:**
- Run `yarn workspace @canopy/core test get-workspace-members.spec.ts`
- All tests pass
- Returns correct member lists
- Authorization enforced correctly

---

### Phase 7: Application Service - Get Member Workspaces

**Description:** Implement the getMemberWorkspaces use case to retrieve all workspaces a user is a member of.

**To-do:**
- [ ] Create `/packages/core/src/modules/workspace_member/application/get_member_workspaces/get-member-workspaces.ts`
  - [ ] Define GetMemberWorkspacesParameters type (userId)
  - [ ] Define GetMemberWorkspacesDependencies type
  - [ ] Implement authorization function:
    - [ ] Check authenticated session
    - [ ] Verify requester can only access their own workspaces (userId === session.getDistinctId())
  - [ ] Implement handler function:
    - [ ] Return workspaces using repository.getMembersByUserId()
  - [ ] Export handler with handler factory
  - [ ] Export authorization function
- [ ] Create `/packages/core/src/modules/workspace_member/application/get_member_workspaces/get-member-workspaces.spec.ts`
  - [ ] Test returns all user workspaces
  - [ ] Test returns empty array for user with no workspaces
  - [ ] Test unauthenticated session throws error
  - [ ] Test requester cannot access other user's workspaces

**Verification:**
- Run `yarn workspace @canopy/core test get-member-workspaces.spec.ts`
- All tests pass
- Returns correct workspace lists
- Authorization enforced correctly (users can only see their own workspaces)

---

### Phase 8: Module Integration and Export

**Description:** Create the module factory to wire up dependencies and export all public APIs through the module index.

**To-do:**
- [ ] Create `/packages/core/src/modules/workspace_member/index.ts`
  - [ ] Import all use cases
  - [ ] Create WorkspaceMemberModule type with all use cases
  - [ ] Implement createWorkspaceMemberModule factory function
  - [ ] Accept repository as dependency
  - [ ] Wire up all use cases with handler factory
  - [ ] Export module factory
  - [ ] Export all domain types (WorkspaceMember, Role, etc.)
  - [ ] Export all errors
  - [ ] Export repository interface
- [ ] Update `/packages/core/src/index.ts`
  - [ ] Export workspace_member module
- [ ] Create basic integration test to verify module creation

**Verification:**
- Run `yarn workspace @canopy/core test`
- All workspace_member tests pass
- Module can be imported from @canopy/core
- No circular dependencies
- TypeScript compilation succeeds

---

### Phase 9: Migration - Update Workspace Module Integration

**Description:** Update the existing workspace module to integrate with the new workspace_member module, ensuring workspace creation automatically adds the owner as a member.

**To-do:**
- [ ] Update `/packages/core/src/modules/workspace/application/create_workspace/create-workspace.ts`
  - [ ] Add workspace_member repository to dependencies
  - [ ] After saving workspace, call addWorkspaceMember to add owner as 'owner' role
  - [ ] Update tests to verify owner is added as member
- [ ] Update `/packages/core/src/modules/workspace/application/add_user_to_workspace/add-user-to-workspace.ts`
  - [ ] Add workspace_member repository to dependencies
  - [ ] After adding to workspace.userIds, also call addWorkspaceMember with 'member' role
  - [ ] Update tests to verify member record is created
- [ ] Update `/packages/core/src/modules/workspace/index.ts`
  - [ ] Add workspace_member repository to module dependencies
  - [ ] Wire up dependencies in module factory
- [ ] Document migration strategy:
  - [ ] Note that existing workspaces may not have member records
  - [ ] Recommend backfill script for production data (future work)

**Verification:**
- Run `yarn workspace @canopy/core test`
- All workspace tests pass
- Creating workspace adds owner as member
- Adding user to workspace creates member record
- No breaking changes to existing workspace API

---

## Documentation

Once all phases are completed, create/update the following documentation:

- [ ] Create `/home/user/canopy/documentation/workspace-members.md`
  - Overview of workspace member system
  - Motivation for separate member module vs simple userIds array
  - Architecture and data flow
  - Key decisions:
    - Separate collection for scalability and role management
    - Role-based system design for future permissions
    - Integration pattern with existing workspace module
  - Safety considerations:
    - Importance of authorization checks
    - Preventing duplicate memberships
    - Consistency between workspace.userIds and workspace_members collection
  - Future extensions: permissions, invitations, member metadata

---

## Next Step

Complete **Phase 1: Domain Layer - Entity and Errors** by creating the WorkspaceMember domain entity, role types, and error classes with validation tests.
