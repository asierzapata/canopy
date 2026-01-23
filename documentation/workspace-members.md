# Workspace Members

## Overview

The workspace member system manages workspace membership through a dedicated module, providing role-based access control and serving as a foundation for future permission systems.

## Motivation

### Why a Separate Module?

Previously, workspace membership was tracked via a simple `userIds: string[]` array in the workspace domain. While functional, this approach had significant limitations:

1. **No Role Differentiation**: Couldn't distinguish between owners and regular members
2. **No Audit Trail**: Lacked timestamps for when users joined or were removed
3. **Scalability Issues**: Couldn't easily add metadata like permissions, invitations, or member-specific settings
4. **Query Inefficiency**: Finding all workspaces for a user required scanning all workspace documents

The workspace_member module solves these problems by creating a dedicated collection with proper indexing and role support.

### Product Value

This module supports Canopy's **multiplayer collaboration** pillar by:

- **Attribution**: Tracking who is a member and their role (owner/member)
- **Authorization**: Providing a clear, auditable way to verify workspace access
- **Extensibility**: Laying groundwork for invitations, granular permissions, and member analytics

## Architecture

### Domain Layer

**WorkspaceMember Entity:**
```typescript
{
  id: UUID           // Unique member record ID
  workspaceId: UUID  // Workspace this membership belongs to
  userId: UUID       // User who is a member
  role: 'owner' | 'member'  // Member's role
  joinedAt: number   // Timestamp when user joined
  updatedAt: number  // Last update timestamp
}
```

**Role Types:**
- `owner`: Workspace owner, full control (future: all permissions)
- `member`: Regular member with standard access (future: configurable permissions)

**Domain Errors:**
- `WorkspaceMemberNotFoundError` (404): Member record doesn't exist
- `WorkspaceMemberAlreadyExistsError` (409): Attempting to add duplicate membership
- `UnauthorizedWorkspaceMemberOperationError` (403): Requester lacks permission for operation

### Infrastructure Layer

**MongoDB Collection:** `workspace_members`

**Indexes:**
1. `{ workspaceId: 1 }` - Find all members of a workspace
2. `{ userId: 1 }` - Find all workspaces for a user
3. `{ workspaceId: 1, userId: 1 }` (unique) - Prevent duplicate memberships

### Application Layer

**Use Cases:**

1. **checkWorkspaceMembership** - Verify if user belongs to workspace
   - Authorization: Authenticated users only
   - Returns: `boolean`
   - Use: Authorization checks, UI state

2. **addWorkspaceMember** - Add user to workspace with role
   - Authorization: Requester must be workspace member
   - Prevents: Duplicate memberships
   - Use: Inviting users, creating workspaces

3. **removeWorkspaceMember** - Remove user from workspace
   - Authorization: Requester must be workspace member
   - Validates: Member exists before removal
   - Use: Removing access, user leaving workspace

4. **getWorkspaceMembers** - Get all members of a workspace
   - Authorization: Requester must be workspace member
   - Returns: Array of WorkspaceMember
   - Use: Displaying member lists, audit logs

5. **getMemberWorkspaces** - Get all workspaces for a user
   - Authorization: Users can only access their own workspaces
   - Returns: Array of WorkspaceMember
   - Use: Workspace switcher, dashboard

### Integration with Workspace Module

**IMPORTANT:** The workspace module does NOT automatically create workspace_member records. This follows the module boundary rule - modules should not access other modules' repositories or use cases directly.

To maintain consistency between `workspace.userIds` and the `workspace_members` collection:

1. **At the application layer** (where both modules are available):
   - After calling `workspace.createWorkspace()`, call `workspaceMember.addWorkspaceMember()` with `role: 'owner'`
   - After calling `workspace.addUserToWorkspace()`, call `workspaceMember.addWorkspaceMember()` with `role: 'member'`

2. **Example integration:**
```typescript
// In your application/API layer where you have access to modules
const { workspaceId, ownerId } = await modules.workspace.createWorkspace(
  { name: 'My Workspace', ownerId: userId },
  session
)

// Create workspace member record
await modules.workspaceMember.addWorkspaceMember(
  { workspaceId, userId: ownerId, role: 'owner' },
  session
)
```

This separation preserves module boundaries and ensures authorization checks are always performed.

## Key Decisions

### Separate Collection vs. Embedded Documents

**Decision:** Use a separate `workspace_members` collection instead of embedding members in the workspace document.

**Rationale:**
- Better query performance for user workspace lookups
- Easier to add member-specific metadata (last active, custom permissions, etc.)
- Scales better for workspaces with many members
- Allows for efficient indexing on both workspaceId and userId

**Trade-off:** Requires additional queries to fetch full member details, but this is acceptable given the performance and extensibility benefits.

### Role-Based System vs. Permission Flags

**Decision:** Start with simple `'owner' | 'member'` roles rather than granular permission flags.

**Rationale:**
- Simpler to implement and reason about
- Covers current product requirements
- Easier to migrate to permission-based system later (roles can map to permission sets)
- Follows the principle of building what's needed now, not what might be needed

**Future Path:** When granular permissions are needed, we can add a `permissions` field to WorkspaceMember without breaking existing role-based checks.

### Module Boundary Separation

**Decision:** Workspace module does NOT create workspace_member records directly. Integration happens at the application layer.

**Rationale:**
- Preserves module encapsulation (workspace shouldn't access workspace_member repositories)
- Ensures authorization checks are always performed through use cases
- Makes module dependencies explicit
- Allows for more flexible integration patterns (events, sagas, etc.)

**Trade-off:** Requires coordination at the application layer to maintain consistency between `workspace.userIds` and `workspace_members`. However, this is acceptable given the architectural benefits and clarity of responsibility.

### Authorization Pattern

**Decision:** Most operations require the requester to be a workspace member (except checkWorkspaceMembership which only requires authentication).

**Rationale:**
- Follows principle of least privilege
- Prevents information leakage about workspace membership
- Consistent with existing workspace authorization patterns
- Easy to relax restrictions later if needed

## Safety & Constraints

### Critical Authorization Checks

1. **Always verify workspace membership** before allowing member operations
2. **getMemberWorkspaces must validate** that users can only access their own workspace list
3. **Use repository.isMember()** for authorization checks, not manual queries

### Data Consistency

**Important:** The system maintains two sources of truth for membership:
- `workspace.userIds` array in the workspace document
- `workspace_members` collection

When adding/removing users, **both must be updated**. The workspace module has been updated to handle this, but be aware when making future changes.

**Migration Note:** Existing workspaces created before this module may not have member records. A backfill script may be needed for production data.

### Preventing Duplicate Memberships

The unique compound index on `(workspaceId, userId)` prevents duplicates at the database level. The `addWorkspaceMember` use case also checks for existing membership and throws `WorkspaceMemberAlreadyExistsError`.

Always handle this error gracefully in the UI to prevent user confusion.

### Performance Considerations

- The `isMember()` check uses `countDocuments` with `limit: 1` for efficiency
- Queries are indexed on both workspaceId and userId for fast lookups
- For workspaces with many members (future), consider pagination for `getWorkspaceMembers`

## Future Extensions

This module is designed to support future features:

1. **Invitations**: Add `status: 'pending' | 'active'` to track invited users
2. **Granular Permissions**: Add `permissions: string[]` field for fine-grained access control
3. **Member Metadata**: Track last active time, invitation source, custom roles
4. **Member Analytics**: Query patterns for workspace engagement, member retention
5. **Role Management**: Add `updateMemberRole` endpoint to change member roles
6. **Bulk Operations**: Add members in batch, remove multiple members

The domain and infrastructure layers are designed to accommodate these extensions without breaking changes to the core membership functionality.
