# Canopy Backend Architecture Brainstorming

## Overview
Canopy is a multiplayer coding agent platform that enables teams to collaborate on AI-assisted development sessions. Multiple developers can join a session, observe the agent's actions in real-time, and provide prompts to guide its work.

**Inspiration**: This architecture is inspired by Ramp's "Inspect" system (https://builders.ramp.com/post/why-we-built-our-background-agent), which achieved 30% of all merged PRs being written by their background agent within months of launch.

### Key Learnings from Ramp's Inspect
- **Fast session startup**: Critical for adoption (image snapshots, warm pools)
- **Multiplayer is mission-critical**: Multiple people working in one session
- **Multiple client surfaces**: Slack, Web, Chrome extension (virality loops)
- **Full dev environment**: Agent needs everything a human engineer would have
- **Verification tools**: Run tests, check telemetry, visual verification for frontend
- **Attribution**: Each person's prompts should be attributed to them in commits/PRs
- **Unlimited concurrency**: Should be fast and cheap enough to run many sessions simultaneously

## Core Requirements

### Functional Requirements
1. **Multi-user Sessions**: Multiple developers can join and interact with the same agent session
2. **Real-time Updates**: All participants see agent actions, thoughts, and code changes live
3. **Prompt Queue Management**: Handle multiple prompts from different users
4. **Session State Persistence**: Maintain conversation history, file states, and context
5. **Agent Orchestration**: Manage long-running agent processes and tool executions
6. **Permission & Access Control**: Control who can view/interact with sessions
7. **Generic Frontend Interface**: Backend exposes clean APIs that any frontend can consume

### Non-Functional Requirements
1. **Low Latency**: Real-time updates with minimal delay
2. **Scalability**: Support multiple concurrent sessions and users
3. **Reliability**: Handle agent crashes, disconnections gracefully
4. **Auditability**: Track all interactions for debugging and compliance
5. **Resource Management**: Prevent runaway agent processes

---

## Ramp's Inspect Architecture Analysis

Before exploring alternative strategies, let's analyze Ramp's production system that achieved 30% PR adoption:

### Architecture Components

```
┌─────────────────────────────────────────────────────────┐
│                   Client Layer                           │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│  │  Slack   │  │   Web    │  │  Chrome  │              │
│  │   Bot    │  │  Client  │  │   Ext    │              │
│  └──────────┘  └──────────┘  └──────────┘              │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│            Cloudflare Infrastructure                     │
│  ┌───────────────────────────────────────────────┐      │
│  │         Durable Objects (API)                 │      │
│  │  Each session = SQLite DB + Real-time sync   │      │
│  │        (Cloudflare Agents SDK)                │      │
│  └───────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              Modal Sandboxes (Execution)                 │
│  ┌──────────────────────────────────────────────┐       │
│  │  Session Sandbox (from snapshot)             │       │
│  │    ├── Full dev environment                  │       │
│  │    ├── OpenCode agent                        │       │
│  │    ├── Git repo (max 30min stale)            │       │
│  │    ├── VS Code server                        │       │
│  │    └── Desktop streaming (for visual QA)     │       │
│  └──────────────────────────────────────────────┘       │
└─────────────────────────────────────────────────────────┐
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│                 Image Registry                           │
│         (Rebuilt every 30 minutes)                       │
│  Snapshot with: git clone + deps + builds               │
└─────────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────────┐
│              External Integrations                       │
│  GitHub, Sentry, Datadog, LaunchDarkly, Slack, etc.    │
└─────────────────────────────────────────────────────────┘
```

### Key Technical Decisions

#### 1. Cloudflare Durable Objects
**What**: Each session gets its own Durable Object with SQLite database
**Why**:
- Perfect isolation: one session can't impact another's performance
- High performance for real-time token streaming (hundreds of updates/sec)
- Built-in WebSocket Hibernation API (open sockets with no compute cost when idle)
- Global distribution with automatic state replication

**Trade-offs**:
- Vendor lock-in to Cloudflare
- Durable Objects have regional placement considerations
- SQLite per-session means harder to query across sessions
- Limited to JavaScript/TypeScript ecosystem

#### 2. Modal for Sandboxes
**What**: Each session runs in isolated Modal sandbox with full dev environment
**Why**:
- Near-instant startup with snapshots
- File system snapshots for pause/resume
- Containers with full isolation
- Pay-per-use pricing model

**Performance Optimizations**:
- **Image Registry**: Build repo images every 30 minutes (clone + install + build)
- **Warm Pools**: Keep sandboxes ready for high-volume repos
- **Early Warming**: Start sandbox when user begins typing prompt
- **Parallel Sync**: Allow agent to read files before git sync completes
- **Snapshot on Completion**: Save state for quick resume later

**Trade-offs**:
- Requires Modal account (vendor lock-in)
- Need to manage image build pipeline
- 30-minute staleness window (acceptable for most use cases)
- Storage costs for snapshots

#### 3. OpenCode as Agent Framework
**What**: Open-source coding agent with server-first architecture
**Why**:
- Fully typed SDK with comprehensive plugin system
- Server-first design (TUI/desktop are just clients)
- Easy to build custom clients on top
- Agent can read its own code to understand behavior (no hallucinations)
- Strong technical implementation

**Advantages for Canopy**:
- Multiple clients out of the box
- Plugin system for custom tools
- `tool.execute.before` events for blocking writes during sync
- Active development and community

**Alternatives to Consider**:
- **Claude Code (SDK)**: Official Anthropic agent, newer but growing fast
- **LangChain/LangGraph**: More flexible but requires more custom work
- **Custom Agent**: Full control but higher maintenance burden

#### 4. Multiplayer Implementation
**Key Insight**: "Mission-critical feature, not seen in any other product"

**Implementation**:
- Each prompt attributed to sending user
- Multiple users can queue prompts simultaneously
- State synchronized across all connected clients
- Git commits use appropriate user attribution

**Use Cases They Found Critical**:
- Teaching non-engineers (PMs, designers) to use AI effectively
- Live QA sessions (multiple people finding issues in real-time)
- PR review collaboration (AI makes requested changes immediately)

#### 5. Authentication via GitHub
**What**: Use GitHub OAuth with user tokens
**Why**:
- PRs opened on behalf of user (not bot)
- Prevents users from approving their own AI-generated changes
- Proper attribution in git history
- Seamless with GitHub-based workflows

**Implementation**:
- GitHub App with installation tokens for cloning
- User OAuth tokens for PR creation
- Git config updated per-commit for attribution
- Webhook listening for branch/PR events

### Performance Characteristics Achieved
- **Time-to-first-token**: Limited only by model provider (all other overhead eliminated)
- **Session startup**: Near-instant (pre-built images + warm pools)
- **Adoption**: 30% of merged PRs within months
- **Concurrency**: Unlimited sessions (cheap enough to not ration)

### What Made It Successful
1. **Multiple surfaces**: Slack (virality), Web (polish), Chrome extension (non-engineers)
2. **No friction**: Fast enough to feel better than local development
3. **Complete tools**: Agent has everything it needs to verify work
4. **Multiplayer**: Natural collaboration model for teams
5. **Smart defaults**: Repository classifier, auto-start, queue management

---

## Canopy's Key Architectural Constraint: Feature-Based Grouping

### The Feature Abstraction

**Insight**: Individual agent sessions should be grouped into "Features" to improve collaboration and agent context.

#### Conceptual Model
```
Feature: "Add OAuth authentication"
├── Session 1: "Research existing auth patterns in codebase"
├── Session 2: "Implement OAuth provider integration"
├── Session 3: "Add frontend login flow"
├── Session 4: "Write integration tests"
└── Session 5: "Update documentation"
```

### Why Features Improve Collaboration

#### 1. Shared Context Across Sessions
Each session in a feature can access:
- **Learnings from sibling sessions**: Findings, decisions, patterns discovered
- **Shared feature workspace**: Common files, branches, or namespaces
- **Feature-level memory**: Architectural decisions, gotchas, context that spans sessions
- **Cross-session references**: "Session 2 found that we need to update the middleware"

#### 2. Better Visibility & Coordination
- **Feature dashboard**: See all related work in one place
- **Progress tracking**: Which parts of feature are done/in-progress
- **Dependency management**: Session 3 blocked on Session 2 completing
- **Team coordination**: "I'll work on frontend sessions, you handle backend"

#### 3. Agent Intelligence Improvements
- **Context inheritance**: New sessions start with feature-level context
- **Avoid duplicated work**: Check if another session already solved similar problem
- **Better planning**: Agent can spawn related sessions within same feature
- **Knowledge synthesis**: Combine insights from multiple sessions

#### 4. Natural Work Decomposition
- **Parallel workstreams**: Multiple sessions work on different aspects simultaneously
- **Smaller, focused sessions**: Each session has clear, bounded scope
- **Easier to review**: Smaller PRs per session, but grouped by feature
- **Better error recovery**: If one session fails, others can continue

### Architectural Implications

#### Data Model Changes

```json
{
  "feature": {
    "feature_id": "uuid",
    "team_id": "uuid",
    "title": "Add OAuth authentication",
    "description": "Implement OAuth 2.0 for user authentication",
    "status": "in_progress|completed|cancelled",
    "created_at": "timestamp",
    "created_by": "user_id",

    "workspace": {
      "repository": "github.com/org/repo",
      "base_branch": "main",
      "feature_branch": "feature/oauth-auth",
      "working_directory": "/oauth"
    },

    "shared_context": {
      "learnings": [
        {
          "from_session": "session_id",
          "content": "Auth middleware requires X-API-Key header",
          "timestamp": "timestamp"
        }
      ],
      "decisions": [
        {
          "decision": "Use Passport.js for OAuth",
          "rationale": "Team already familiar, well-maintained",
          "made_by": "session_id",
          "timestamp": "timestamp"
        }
      ],
      "key_files": [
        {
          "path": "src/auth/oauth.ts",
          "modified_by": ["session_2", "session_3"],
          "importance": "critical"
        }
      ]
    },

    "sessions": ["session_1", "session_2", "session_3"],
    "participants": ["user_1", "user_2"],
    "metadata": {
      "linked_issue": "PROJ-123",
      "tags": ["auth", "security"],
      "estimated_sessions": 5,
      "priority": "high"
    }
  }
}
```

#### Session Model Updates

```json
{
  "session": {
    "session_id": "uuid",
    "feature_id": "uuid",  // ← Links to parent feature
    "title": "Implement OAuth provider integration",
    "scope": "Backend API integration with OAuth providers",
    "status": "active|paused|completed|failed",
    "created_at": "timestamp",

    "relationships": {
      "depends_on": ["session_1"],  // Must complete after these
      "blocks": ["session_3"],       // These wait for this one
      "related": ["session_4"]       // Related but not dependent
    },

    "context_inheritance": {
      "feature_context": true,        // Inherits feature shared context
      "from_sessions": ["session_1"], // Explicitly inherit from these
      "contributes_to_feature": true  // Learnings added to feature context
    },

    "isolation_level": "shared_branch|isolated_branch|shared_files",
    // ... rest of session model
  }
}
```

### Implementation Strategies for Feature-Based Architecture

#### Strategy A: Feature as Orchestrator

```
┌───────────────────────────────────────────────┐
│            Feature Coordinator                │
│  (Actor/Service managing feature lifecycle)   │
├───────────────────────────────────────────────┤
│  - Maintain shared context store              │
│  - Route prompts to appropriate sessions      │
│  - Manage session dependencies                │
│  - Aggregate learnings across sessions        │
│  - Broadcast feature-level events             │
└───────────────────────────────────────────────┘
                     │
         ┌───────────┼───────────┐
         ▼           ▼           ▼
   ┌─────────┐ ┌─────────┐ ┌─────────┐
   │Session 1│ │Session 2│ │Session 3│
   │ Actor   │ │ Actor   │ │ Actor   │
   └─────────┘ └─────────┘ └─────────┘
         │           │           │
         ▼           ▼           ▼
     Agent 1     Agent 2     Agent 3
```

**How it works**:
1. Feature Coordinator is parent actor/service for all sessions
2. Maintains shared memory (Redis/DB) accessible to all sessions
3. Sessions report learnings back to coordinator
4. Coordinator can suggest context to sessions based on other sessions' work
5. Users interact with feature, which routes to correct session(s)

**Pros**:
- Clear ownership of shared state
- Easy to implement cross-session context
- Natural place for feature-level logic
- Can manage resource limits at feature level

**Cons**:
- Single point of failure (needs supervision)
- More complex routing logic
- Feature coordinator could become bottleneck

#### Strategy B: Shared Context Store with Event Bus

```
┌─────────────────────────────────────────────────┐
│         Feature Context Store (Redis)           │
│    Key: feature:uuid → Shared context JSON      │
└─────────────────────────────────────────────────┘
           ▲                        ▲
           │ Write learnings        │ Read context
           │                        │
    ┌──────┴────────┐      ┌───────┴──────┐
    │  Session 1    │      │  Session 2    │
    │    Agent      │      │    Agent      │
    └───────────────┘      └───────────────┘
           │                        │
           └────────┬───────────────┘
                    ▼
         ┌────────────────────┐
         │  Feature Event Bus │
         │ (Pub/Sub per feat) │
         └────────────────────┘
```

**How it works**:
1. Each feature has entry in shared context store (Redis hash)
2. Sessions subscribe to feature event channel
3. When session makes discovery, writes to context store + publishes event
4. Other sessions receive event, can pull relevant context
5. No central coordinator - peer-to-peer model

**Pros**:
- No single point of failure
- Simpler architecture
- Sessions remain independent
- Scales horizontally easily

**Cons**:
- Eventual consistency of context
- Need conflict resolution for concurrent writes
- Harder to enforce dependencies between sessions
- No natural owner for feature-level operations

#### Strategy C: CRDT-Based Shared Feature State

```
┌─────────────────────────────────────────────────┐
│       Feature CRDT Document (Yjs/Automerge)    │
│                                                  │
│  ├─ shared_learnings: Y.Array                  │
│  ├─ decisions: Y.Array                          │
│  ├─ key_files: Y.Map                            │
│  └─ session_states: Y.Map                       │
└─────────────────────────────────────────────────┘
      ▲              ▲              ▲
      │              │              │
┌─────┴────┐  ┌─────┴────┐  ┌─────┴────┐
│Session 1 │  │Session 2 │  │Session 3 │
│CRDT sync │  │CRDT sync │  │CRDT sync │
└──────────┘  └──────────┘  └──────────┘
```

**How it works**:
1. Feature state is CRDT document
2. Each session maintains synced replica
3. Sessions can make concurrent updates (automatic conflict resolution)
4. Real-time propagation of context across sessions
5. Offline-capable (sessions can work disconnected)

**Pros**:
- Automatic conflict resolution
- Real-time synchronization
- Strong consistency guarantees
- Natural fit for collaborative editing
- Can work offline

**Cons**:
- CRDT overhead for large features
- Limited query capabilities
- Need to learn CRDT semantics
- May be overkill for append-only data

### Context Sharing Mechanisms

#### 1. Automatic Context Propagation
When new session starts in feature:
```
Agent system prompt includes:
"You are working on Feature: 'Add OAuth authentication'

Related sessions in this feature:
- Session 1 discovered: [key learnings]
- Session 2 decided to: [use Passport.js because...]

Key files modified by other sessions:
- src/auth/oauth.ts (Session 2)
- src/middleware/auth.ts (Session 1)

Feature-level decisions:
1. Use Passport.js for OAuth (rationale: ...)
2. Store tokens in Redis (rationale: ...)
"
```

#### 2. Cross-Session Tools
Give agents tools to interact with feature:

```typescript
// Tool: Read feature context
{
  name: "read_feature_context",
  description: "Read shared context from other sessions in this feature",
  parameters: {
    query: "What did other sessions learn about authentication middleware?"
  }
}

// Tool: Add to feature context
{
  name: "add_feature_learning",
  description: "Share important discovery with other sessions",
  parameters: {
    learning: "Auth middleware requires X-API-Key header",
    importance: "high",
    related_files: ["src/middleware/auth.ts"]
  }
}

// Tool: Query sibling sessions
{
  name: "query_feature_sessions",
  description: "Ask about work done in other sessions",
  parameters: {
    query: "Did any session implement token refresh logic?"
  }
}

// Tool: Spawn related session
{
  name: "spawn_feature_session",
  description: "Create new session within this feature",
  parameters: {
    title: "Add token refresh logic",
    scope: "Implement refresh token flow",
    inherits_context: true,
    depends_on: "current_session"
  }
}
```

#### 3. Smart Context Retrieval
Use RAG (Retrieval-Augmented Generation) over feature history:
- Embed all messages/learnings from feature sessions
- When agent needs context, query similar past interactions
- Surface relevant discoveries from sibling sessions
- Avoid overwhelming agent with all context upfront

### User Experience Changes

#### Feature Creation Flow
```
1. User: "I want to add OAuth authentication"
2. System: Creates Feature with title/description
3. System: Suggests initial session decomposition:
   - "Research existing auth patterns"
   - "Implement OAuth providers"
   - "Add frontend login"
   - "Write tests"
4. User: Approves or modifies session plan
5. System: Creates sessions (can start in parallel)
6. User: Can add more sessions on the fly
```

#### Collaboration Patterns
- **Handoff**: Session 1 completes, notifies team, someone starts Session 2
- **Parallel**: Multiple team members work on different sessions simultaneously
- **Review**: Team reviews all sessions in feature together before merge
- **Pair programming**: Multiple people in same session within feature

#### Feature Dashboard UI
```
Feature: Add OAuth authentication
Status: In Progress (3/5 sessions complete)
Participants: Alice, Bob, Carol

├─ ✓ Session 1: Research auth patterns (Alice) - Completed
│  └─ Key learnings: 3 | Files: 5 | Duration: 15m
├─ ✓ Session 2: Implement OAuth providers (Bob) - Completed
│  └─ Key learnings: 5 | Files: 8 | Duration: 42m
├─ ▶ Session 3: Add frontend login (Carol) - Active
│  └─ In progress: Writing LoginButton component
├─ ⏸ Session 4: Write integration tests - Blocked (waiting on Session 3)
└─ ⏸ Session 5: Update documentation - Not started

Shared Context: 12 learnings | 8 decisions | 15 key files
```

### Benefits Over Single-Session Model

#### For Agents
- **Better context**: Knows what other sessions discovered
- **Avoid duplicated work**: Can check if sibling session already tried something
- **Smarter planning**: Can decompose work into parallel sessions
- **Context limits**: Each session has bounded context (doesn't grow infinitely)

#### For Teams
- **Parallelization**: Multiple people/agents work simultaneously
- **Better organization**: Work naturally grouped by feature
- **Easier review**: Smaller, focused PRs per session
- **Clearer progress**: Can see feature completion at a glance
- **Knowledge sharing**: Team sees learnings from all sessions

#### For Product
- **Faster delivery**: Parallel work reduces total time
- **Better quality**: Cross-session learnings improve each session's work
- **Modularity**: Can reuse feature patterns for similar future work
- **Observability**: Better metrics (feature success rate, session patterns)

---

## Architecture Strategy 1: Event-Driven with WebSocket Hub

### Overview
Central WebSocket hub broadcasts all agent events to connected clients. Agent runs as separate process, publishes events to message queue.

### Components
```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Clients   │────▶│  API Gateway │────▶│  WebSocket  │
│  (Frontend) │◀────│   + WS Hub   │◀────│   Handler   │
└─────────────┘     └──────────────┘     └─────────────┘
                            │                     │
                            ▼                     ▼
                    ┌──────────────┐     ┌─────────────┐
                    │   REST API   │     │  Event Bus  │
                    │   Service    │     │ (Redis/Kafka)│
                    └──────────────┘     └─────────────┘
                            │                     ▲
                            ▼                     │
                    ┌──────────────┐             │
                    │  Session DB  │             │
                    │  (Postgres)  │             │
                    └──────────────┘             │
                                                  │
                    ┌──────────────┐             │
                    │ Agent Runner │─────────────┘
                    │  (Processes) │
                    └──────────────┘
```

### Event Flow
1. User sends prompt via WebSocket
2. API Gateway validates and publishes to event bus
3. Agent Runner picks up event, starts processing
4. Agent emits events (thinking, tool_use, results) to event bus
5. WebSocket Handler broadcasts to all session participants
6. State changes persisted to Session DB

### Pros
- True real-time collaboration
- Scalable with horizontal scaling of WebSocket handlers
- Clear separation of concerns
- Easy to add new event types
- Multiple frontends can consume same event stream

### Cons
- Complexity of managing WebSocket connections at scale
- Need reliable message delivery (Redis Streams or Kafka)
- State reconciliation if clients disconnect/reconnect

### Tech Stack Options
- **Event Bus**: Redis Streams, Apache Kafka, NATS
- **WebSocket**: Socket.io, native WebSocket with custom protocol
- **API**: Node.js/Express, Go/Fiber, Python/FastAPI
- **Database**: PostgreSQL with JSONB for session state

---

## Architecture Strategy 2: CRDT-Based Collaborative Backend

### Overview
Use Conflict-free Replicated Data Types (CRDTs) for session state, allowing optimistic updates and automatic conflict resolution.

### Components
```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Clients   │────▶│  Sync Server │────▶│ CRDT Engine │
│             │◀────│   (Yjs/Auto)│◀────│             │
└─────────────┘     └──────────────┘     └─────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │ Agent Bridge │
                    │  (Mediator)  │
                    └──────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │ Agent Runner │
                    │  (Claude API)│
                    └──────────────┘
```

### Session State as CRDT
- **Prompt Queue**: Y.Array for ordered prompts
- **Conversation**: Y.Array for message history
- **File System**: Y.Map for file contents
- **Agent Status**: Y.Map for current state

### Pros
- Offline-first capable
- Automatic conflict resolution
- Easy to implement multiplayer features
- Rich ecosystem (Yjs, Automerge)
- Natural fit for collaborative editing

### Cons
- CRDT overhead for large documents
- Learning curve for CRDT semantics
- May be overkill for append-only data (conversation history)
- Need to bridge CRDT updates to agent process

### Tech Stack Options
- **CRDT Library**: Yjs (JavaScript), Automerge (Rust/JS)
- **Sync Server**: y-websocket, y-sweet
- **Backend**: Node.js with Yjs, or Rust with Automerge
- **Persistence**: PostgreSQL, or CRDT-native storage

---

## Architecture Strategy 3: Command-Query Responsibility Segregation (CQRS)

### Overview
Separate write path (commands to agent) from read path (queries for state). Event sourcing stores all events, materialized views for queries.

### Components
```
┌─────────────┐     ┌──────────────┐
│   Clients   │────▶│ Command API  │
│             │     │  (Write)     │
└─────────────┘     └──────────────┘
      ▲                     │
      │                     ▼
      │             ┌──────────────┐
      │             │  Event Store │
      │             │  (All Events)│
      │             └──────────────┘
      │                     │
      │                     ▼
      │             ┌──────────────┐
      │             │  Event Bus   │
      │             └──────────────┘
      │                  │      │
      │                  ▼      ▼
      │          ┌──────────┐ ┌──────────┐
      │          │  Agent   │ │  Read    │
      │          │  Handler │ │  Model   │
      │          │          │ │ Projector│
      │          └──────────┘ └──────────┘
      │                           │
      │                           ▼
      │                   ┌──────────────┐
      └───────────────────│  Query API   │
                          │  (Read)      │
                          └──────────────┘
```

### Event Types
- `PromptSubmitted`: User submitted a prompt
- `AgentStarted`: Agent began processing
- `ToolExecuted`: Agent used a tool
- `MessageGenerated`: Agent produced a message
- `SessionCompleted`: Agent finished task

### Pros
- Complete audit trail (event sourcing)
- Easy to replay sessions
- Can optimize read/write paths independently
- Time-travel debugging
- Easy to add new read models

### Cons
- Increased complexity
- Event versioning challenges
- Eventual consistency between write and read
- Storage requirements for full event history

### Tech Stack Options
- **Event Store**: EventStoreDB, PostgreSQL with event table
- **Message Bus**: RabbitMQ, Kafka
- **Command API**: Go, Rust, Node.js
- **Query API**: GraphQL, REST

---

## Architecture Strategy 4: Actor Model with Stateful Sessions

### Overview
Each session is an actor (Erlang/Akka style) that maintains state and processes messages. Actors handle concurrency naturally.

### Components
```
┌─────────────┐     ┌──────────────┐
│   Clients   │────▶│  API Gateway │
└─────────────┘     └──────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │Session Router│
                    └──────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
    ┌──────────────┐┌──────────────┐┌──────────────┐
    │Session Actor ││Session Actor ││Session Actor │
    │  (session1)  ││  (session2)  ││  (session3)  │
    ├──────────────┤├──────────────┤├──────────────┤
    │- State       ││- State       ││- State       │
    │- Agent Ref   ││- Agent Ref   ││- Agent Ref   │
    │- Subscribers ││- Subscribers ││- Subscribers │
    └──────────────┘└──────────────┘└──────────────┘
            │               │               │
            ▼               ▼               ▼
    ┌──────────────┐┌──────────────┐┌──────────────┐
    │ Agent Actor  ││ Agent Actor  ││ Agent Actor  │
    └──────────────┘└──────────────┘└──────────────┘
```

### Session Actor Responsibilities
- Maintain session state (conversation, files, users)
- Queue prompts from multiple users
- Supervise agent actor
- Broadcast updates to subscribers
- Handle crash recovery

### Pros
- Natural concurrency model
- Built-in supervision and fault tolerance
- Location transparency (can distribute across nodes)
- Per-session isolation
- Clean state management

### Cons
- Requires actor framework (limits language choice)
- Memory usage if many idle sessions
- Need snapshot strategy for large states
- Complexity of distributed actor systems

### Tech Stack Options
- **Actor Framework**: Erlang/OTP, Akka (Scala/Java), Orleans (.NET), Actix (Rust)
- **Language**: Elixir/Erlang (best fit), Scala, Rust
- **Clustering**: Built-in to most actor frameworks
- **Persistence**: Actor state snapshots to DB

---

## Architecture Strategy 5: Serverless with Queue-Based Orchestration

### Overview
Leverage serverless functions for agent execution, queue for orchestration. Optimized for cost and auto-scaling.

### Components
```
┌─────────────┐     ┌──────────────┐
│   Clients   │────▶│  API Gateway │
└─────────────┘     │  (AWS/GCP)   │
                    └──────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │ Session API  │
                    │  (Lambda)    │
                    └──────────────┘
                            │
            ┌───────────────┼───────────────┐
            ▼               ▼               ▼
    ┌──────────────┐┌──────────────┐┌──────────────┐
    │ Prompt Queue ││  Event Queue ││ Session DB   │
    │  (SQS/Pub)   ││  (SNS/Pub)   ││ (DynamoDB)   │
    └──────────────┘└──────────────┘└──────────────┘
            │               ▲               ▲
            ▼               │               │
    ┌──────────────┐       │               │
    │Agent Runner  │───────┴───────────────┘
    │  (Lambda)    │
    └──────────────┘
```

### Flow
1. Prompt sent to API Gateway
2. Session API writes to Prompt Queue and Session DB
3. Agent Runner Lambda triggered by queue
4. Agent publishes events to Event Queue (SNS/PubSub)
5. Clients subscribe to Event Queue for updates
6. WebSocket API pushes events to clients

### Pros
- Auto-scaling built-in
- Pay only for execution time
- Managed infrastructure
- Easy to deploy and maintain
- No server management

### Cons
- Cold start latency for functions
- Complexity of stitching services together
- Vendor lock-in
- Stateless functions complicate agent context
- Limited execution time (15 min for Lambda)

### Tech Stack Options
- **AWS**: Lambda, SQS, SNS, API Gateway, DynamoDB
- **GCP**: Cloud Functions, Pub/Sub, Firestore
- **Azure**: Functions, Service Bus, CosmosDB
- **Language**: Node.js, Python, Go

---

## Critical Design Decisions

### 1. Prompt Queue Management
**Challenge**: Multiple users sending prompts simultaneously

**Options**:
- **FIFO Queue**: First-in-first-out, simple but may frustrate users
- **Priority Queue**: Weight by user role, seniority, or voting
- **Merge Strategy**: Combine similar prompts automatically
- **Interrupt Mechanism**: Allow canceling current agent execution
- **Turn-Based**: Explicit turn-taking with visible queue

**Recommendation**: Start with FIFO + interrupt, add priority later based on usage patterns.

### 2. Agent State Synchronization
**Challenge**: Keeping all clients synchronized with agent state

**Options**:
- **Server-Side Source of Truth**: Backend holds canonical state, pushes updates
- **Optimistic Updates**: Clients update locally, reconcile on server response
- **Differential Sync**: Only send deltas to reduce bandwidth
- **Snapshot + Events**: Periodic snapshots with event stream for replay

**Recommendation**: Server-side truth + event stream for real-time updates.

### 3. Session Lifecycle Management
**Challenge**: When to start, pause, or terminate sessions

**Options**:
- **Explicit Control**: Users must explicitly start/stop
- **Auto-Start**: Session starts when first prompt arrives
- **Idle Timeout**: Terminate after N minutes of inactivity
- **Resource Limits**: Max tokens, time, or cost per session

**Recommendation**: Auto-start + idle timeout (30 min) + configurable resource limits.

### 4. Conflict Resolution
**Challenge**: What happens when users give conflicting prompts

**Options**:
- **Last-Write-Wins**: Most recent prompt takes precedence
- **Vote System**: Users vote on next action
- **Moderator Role**: Designated user approves prompts
- **Agent Decides**: Agent asks clarifying questions

**Recommendation**: Queue-based (FIFO) initially, add voting for team consensus features.

### 5. Real-Time Transport
**Challenge**: How to push updates to clients

**Options**:
- **WebSocket**: Bidirectional, low latency, stateful
- **Server-Sent Events (SSE)**: Unidirectional, simpler, HTTP-based
- **HTTP Long Polling**: Fallback for restrictive networks
- **gRPC Streaming**: Efficient binary protocol

**Recommendation**: WebSocket primary + SSE fallback for compatibility.

---

## Data Models

### Session Model
```json
{
  "session_id": "uuid",
  "team_id": "uuid",
  "created_at": "timestamp",
  "updated_at": "timestamp",
  "status": "active|paused|completed|failed",
  "participants": [
    {
      "user_id": "uuid",
      "role": "owner|contributor|viewer",
      "joined_at": "timestamp"
    }
  ],
  "workspace": {
    "repository": "github.com/org/repo",
    "branch": "main",
    "commit": "sha"
  },
  "configuration": {
    "model": "claude-sonnet-4",
    "max_tokens": 100000,
    "tools_enabled": ["bash", "edit", "read"],
    "prompt_queue_strategy": "fifo"
  },
  "metadata": {
    "title": "Fix authentication bug",
    "tags": ["bug", "auth"],
    "linked_issue": "PROJ-123"
  }
}
```

### Event Model
```json
{
  "event_id": "uuid",
  "session_id": "uuid",
  "timestamp": "timestamp",
  "sequence_number": 42,
  "type": "prompt|agent_message|tool_use|tool_result|status_change",
  "actor": {
    "type": "user|agent",
    "id": "uuid"
  },
  "payload": {
    "content": "...",
    "metadata": {}
  }
}
```

### Prompt Model
```json
{
  "prompt_id": "uuid",
  "session_id": "uuid",
  "user_id": "uuid",
  "content": "Fix the login timeout issue",
  "submitted_at": "timestamp",
  "status": "queued|processing|completed|cancelled",
  "priority": 0,
  "context": {
    "files_mentioned": ["auth.ts"],
    "relates_to_prompt": "uuid"
  }
}
```

---

## API Design Principles

### 1. Generic REST/GraphQL API
Keep APIs frontend-agnostic:
- RESTful resources for CRUD operations
- GraphQL for flexible queries (optional)
- Standardized error responses
- Pagination for large datasets
- Filtering and sorting built-in

### 2. WebSocket Protocol
```javascript
// Client -> Server
{
  "type": "prompt.submit",
  "payload": { "session_id": "...", "content": "..." }
}

{
  "type": "session.join",
  "payload": { "session_id": "..." }
}

// Server -> Client
{
  "type": "agent.message",
  "payload": { "session_id": "...", "content": "...", "sequence": 42 }
}

{
  "type": "agent.tool_use",
  "payload": { "tool": "read", "parameters": {...}, "sequence": 43 }
}

{
  "type": "session.participant_joined",
  "payload": { "user": {...} }
}
```

### 3. Idempotency
All mutations should be idempotent:
- Use idempotency keys for prompt submission
- Prevent duplicate processing
- Safe retry mechanisms

---

## Scalability Considerations

### Horizontal Scaling
1. **Stateless API Layer**: Scale API servers independently
2. **Session Sharding**: Distribute sessions across multiple agent runners
3. **Database Read Replicas**: Separate read/write database instances
4. **CDN for Assets**: Static files served from edge

### Load Balancing
- **Session Affinity**: Route user to same WebSocket server (sticky sessions)
- **Least-Loaded**: Distribute new sessions to least-busy agent runner
- **Geographic**: Route to nearest data center

### Caching Strategy
- **Session Metadata**: Redis cache for fast lookups
- **User Permissions**: Cache for 5-10 minutes
- **Agent Responses**: Optional caching for similar prompts (RAG-style)

### Resource Limits
- Max concurrent sessions per team
- Rate limiting on prompt submissions
- Token budgets per session
- Timeout for long-running operations

---

## Security & Access Control

### Authentication & Authorization
1. **API Keys**: For programmatic access
2. **OAuth 2.0**: For user authentication
3. **Role-Based Access Control (RBAC)**:
   - **Owner**: Full control, can delete session
   - **Contributor**: Can submit prompts
   - **Viewer**: Read-only access
4. **Team-Level Permissions**: Inherit from team settings

### Session Isolation
- Separate workspaces per session
- Sandboxed agent execution (containers/VMs)
- No cross-session data access
- Encrypted data at rest

### Audit Logging
- All prompts logged with user attribution
- Tool executions logged
- Access logs for compliance
- Retention policies configurable

---

## OpenCode Integration Strategy

### Why OpenCode as Agent Runtime

Based on Ramp's success and your requirement for quick implementation:

**Advantages**:
1. **Server-first architecture**: Perfect for multiplayer (multiple clients connect to one agent)
2. **Battle-tested**: Used in production at Ramp for 30% of merged PRs
3. **Plugin system**: Extensible for custom tools (feature context, cross-session queries)
4. **Open source**: Can read code to understand behavior (helps AI understand itself)
5. **Typed SDK**: TypeScript SDK with comprehensive type safety
6. **Event hooks**: `tool.execute.before`, `tool.execute.after` for interception
7. **Multiple clients**: Already supports TUI, desktop - easy to add custom clients

### OpenCode Architecture

```
┌─────────────────────────────────────────────────┐
│         Canopy Backend (Your Code)              │
│                                                  │
│  ┌────────────────────────────────────────┐    │
│  │     Feature Coordinator                │    │
│  │  - Manage feature lifecycle            │    │
│  │  - Shared context store                │    │
│  │  - Route prompts to sessions           │    │
│  └────────────────────────────────────────┘    │
│                    │                             │
│      ┌─────────────┼─────────────┐              │
│      ▼             ▼             ▼              │
│  ┌────────┐   ┌────────┐   ┌────────┐          │
│  │Session │   │Session │   │Session │          │
│  │Manager │   │Manager │   │Manager │          │
│  └────────┘   └────────┘   └────────┘          │
│      │             │             │              │
└──────┼─────────────┼─────────────┼──────────────┘
       │             │             │
       │   Each Session Manager spawns OpenCode
       │             │             │
       ▼             ▼             ▼
┌──────────────────────────────────────────────────┐
│           Modal/Docker Sandboxes                 │
│                                                   │
│  ┌───────────────────────────────────────┐      │
│  │    OpenCode Server (Session 1)        │      │
│  │  ┌─────────────────────────────────┐  │      │
│  │  │  Canopy Plugin (Feature Context)│  │      │
│  │  └─────────────────────────────────┘  │      │
│  │  ┌─────────────────────────────────┐  │      │
│  │  │  Custom Tools (Cross-session)   │  │      │
│  │  └─────────────────────────────────┘  │      │
│  │  ┌─────────────────────────────────┐  │      │
│  │  │  Git/File Tools (OpenCode Core) │  │      │
│  │  └─────────────────────────────────┘  │      │
│  │         │                               │      │
│  │         ▼                               │      │
│  │  Claude API (Sonnet/Opus)              │      │
│  └───────────────────────────────────────┘      │
│                                                   │
│  (Similar for Session 2, Session 3, ...)        │
└──────────────────────────────────────────────────┘
```

### Integration Patterns

#### Pattern 1: OpenCode as Subprocess

Canopy spawns OpenCode server per session, communicates via:
- **HTTP API**: Send prompts, get responses
- **WebSocket**: Real-time streaming of agent events
- **File system**: Shared workspace for code changes

```typescript
// Simplified example
class SessionManager {
  private opencodeProcess: ChildProcess;
  private opencodeClient: OpenCodeClient;

  async startSession(sessionId: string, featureId: string) {
    // 1. Prepare sandbox with repo
    const sandbox = await this.prepareSandbox(sessionId);

    // 2. Start OpenCode server in sandbox
    this.opencodeProcess = await sandbox.exec(
      `opencode server --port 8080 --workspace /workspace`
    );

    // 3. Connect to OpenCode
    this.opencodeClient = new OpenCodeClient('http://sandbox:8080');

    // 4. Install Canopy plugins
    await this.opencodeClient.installPlugin({
      name: 'canopy-feature-context',
      config: {
        featureId: featureId,
        contextStoreUrl: 'https://canopy-api/features/${featureId}/context',
        apiKey: this.apiKey
      }
    });

    // 5. Subscribe to events
    this.opencodeClient.on('message', (msg) => {
      this.broadcastToClients(sessionId, msg);
    });

    this.opencodeClient.on('tool_use', (tool) => {
      this.logToolUse(sessionId, tool);
    });
  }

  async sendPrompt(sessionId: string, prompt: string, userId: string) {
    // Add feature context to prompt
    const context = await this.getFeatureContext(this.featureId);
    const enrichedPrompt = this.enrichWithContext(prompt, context);

    // Send to OpenCode
    return this.opencodeClient.sendMessage({
      content: enrichedPrompt,
      metadata: { userId, sessionId }
    });
  }
}
```

#### Pattern 2: OpenCode SDK Integration

Embed OpenCode as library, programmatic control:

```typescript
import { OpenCode, Plugin } from '@opencode/sdk';

class CanopyAgent {
  private agent: OpenCode;

  async initialize(sessionId: string, featureId: string) {
    this.agent = new OpenCode({
      workspace: '/workspace',
      model: 'claude-sonnet-4',
      plugins: [
        new CanopyFeatureContextPlugin(featureId),
        new CanopyCrossSessionPlugin(featureId),
        new CanopyVerificationPlugin(),
      ]
    });

    // Hook into tool execution
    this.agent.on('tool.execute.before', async (event) => {
      // Block file writes until git sync complete
      if (this.isWriteTool(event.tool) && !this.isSyncComplete) {
        event.block('Waiting for git sync to complete');
      }

      // Log all tool uses to Canopy backend
      await this.logToolUse(event);
    });

    this.agent.on('tool.execute.after', async (event) => {
      // Extract learnings from certain tools
      if (event.tool === 'read' || event.tool === 'grep') {
        await this.extractLearnings(event.result);
      }
    });

    await this.agent.start();
  }

  async prompt(content: string, userId: string) {
    // Get feature context
    const context = await this.featureContext.get();

    // Enrich prompt with context
    const systemPrompt = `
      You are working on Feature: "${context.title}"

      Other sessions in this feature have learned:
      ${context.learnings.map(l => `- ${l.content}`).join('\n')}

      Key decisions made:
      ${context.decisions.map(d => `- ${d.decision}: ${d.rationale}`).join('\n')}

      Important files:
      ${context.keyFiles.map(f => `- ${f.path}`).join('\n')}
    `;

    return this.agent.sendMessage({
      role: 'user',
      content: content,
      metadata: { userId, systemPrompt }
    });
  }
}
```

### Custom Canopy Plugins for OpenCode

#### Plugin 1: Feature Context Plugin

```typescript
// plugins/canopy-feature-context.ts
import { Plugin, ToolDefinition } from '@opencode/sdk';

export class CanopyFeatureContextPlugin extends Plugin {
  name = 'canopy-feature-context';

  constructor(
    private featureId: string,
    private apiClient: CanopyAPIClient
  ) {
    super();
  }

  // Add custom tools
  getTools(): ToolDefinition[] {
    return [
      {
        name: 'read_feature_context',
        description: 'Read shared learnings from other sessions in this feature',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'What to search for in feature context'
            }
          }
        },
        execute: async (params) => {
          const context = await this.apiClient.getFeatureContext(
            this.featureId,
            params.query
          );
          return {
            learnings: context.learnings,
            decisions: context.decisions,
            keyFiles: context.keyFiles
          };
        }
      },
      {
        name: 'add_feature_learning',
        description: 'Share an important discovery with other sessions',
        parameters: {
          type: 'object',
          properties: {
            learning: { type: 'string' },
            importance: { type: 'string', enum: ['low', 'medium', 'high'] },
            relatedFiles: { type: 'array', items: { type: 'string' } }
          },
          required: ['learning', 'importance']
        },
        execute: async (params) => {
          await this.apiClient.addFeatureLearning(this.featureId, {
            sessionId: this.sessionId,
            content: params.learning,
            importance: params.importance,
            relatedFiles: params.relatedFiles || [],
            timestamp: new Date()
          });
          return { success: true };
        }
      }
    ];
  }

  // Enrich system prompt
  async onSystemPromptGenerate(basePrompt: string): Promise<string> {
    const context = await this.apiClient.getFeatureContext(this.featureId);

    return `${basePrompt}

# Feature Context

You are working on: **${context.title}**

## Learnings from Other Sessions
${context.learnings.map((l, i) =>
  `${i + 1}. ${l.content} (from ${l.fromSession})`
).join('\n')}

## Architecture Decisions
${context.decisions.map((d, i) =>
  `${i + 1}. ${d.decision}
     Rationale: ${d.rationale}`
).join('\n\n')}

## Important Files Modified by Other Sessions
${context.keyFiles.map(f =>
  `- ${f.path} (modified by: ${f.modifiedBy.join(', ')})`
).join('\n')}

Use the \`read_feature_context\` tool to search for specific information.
Use the \`add_feature_learning\` tool to share important discoveries.
`;
  }

  // Hook into file operations
  async onBeforeToolExecute(tool: string, params: any) {
    // If reading/editing important file, add context
    if ((tool === 'read' || tool === 'edit') && params.file_path) {
      const fileContext = await this.apiClient.getFileContext(
        this.featureId,
        params.file_path
      );

      if (fileContext) {
        console.log(`Note: This file was modified by ${fileContext.sessions.join(', ')}`);
        console.log(`Changes: ${fileContext.summary}`);
      }
    }
  }
}
```

#### Plugin 2: Cross-Session Query Plugin

```typescript
// plugins/canopy-cross-session.ts
export class CanopyCrossSessionPlugin extends Plugin {
  name = 'canopy-cross-session';

  getTools(): ToolDefinition[] {
    return [
      {
        name: 'query_sibling_sessions',
        description: 'Ask questions about work done in other sessions of this feature',
        parameters: {
          type: 'object',
          properties: {
            question: {
              type: 'string',
              description: 'Question to ask about other sessions'
            }
          },
          required: ['question']
        },
        execute: async (params) => {
          // Use RAG over all session transcripts in feature
          const answer = await this.apiClient.queryFeatureSessions(
            this.featureId,
            params.question
          );
          return {
            answer: answer.text,
            sources: answer.sessions.map(s => ({
              sessionId: s.id,
              title: s.title,
              relevantExcerpt: s.excerpt
            }))
          };
        }
      },
      {
        name: 'spawn_related_session',
        description: 'Create a new session within this feature for related work',
        parameters: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            scope: { type: 'string' },
            inheritsContext: { type: 'boolean', default: true },
            dependsOnCurrent: { type: 'boolean', default: false }
          },
          required: ['title', 'scope']
        },
        execute: async (params) => {
          const newSession = await this.apiClient.createSession({
            featureId: this.featureId,
            title: params.title,
            scope: params.scope,
            relationships: {
              dependsOn: params.dependsOnCurrent ? [this.sessionId] : [],
              relatedTo: [this.sessionId]
            },
            contextInheritance: {
              featureContext: params.inheritsContext,
              fromSessions: params.inheritsContext ? [this.sessionId] : []
            }
          });

          return {
            sessionId: newSession.id,
            message: `Created new session: ${newSession.title}`,
            url: `https://canopy.app/sessions/${newSession.id}`
          };
        }
      }
    ];
  }
}
```

#### Plugin 3: Verification Tools Plugin

```typescript
// plugins/canopy-verification.ts
export class CanopyVerificationPlugin extends Plugin {
  name = 'canopy-verification';

  getTools(): ToolDefinition[] {
    return [
      {
        name: 'run_tests',
        description: 'Run test suite and analyze results',
        parameters: {
          type: 'object',
          properties: {
            testPattern: { type: 'string' },
            updateSnapshots: { type: 'boolean', default: false }
          }
        },
        execute: async (params) => {
          const result = await this.runTests(params);

          // Log to feature context if tests reveal issues
          if (!result.success) {
            await this.apiClient.addFeatureLearning(this.featureId, {
              content: `Tests failed: ${result.summary}`,
              importance: 'high',
              relatedFiles: result.failedFiles
            });
          }

          return result;
        }
      },
      {
        name: 'visual_verify',
        description: 'Take screenshot of UI for visual verification',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string' },
            viewport: { type: 'object' }
          }
        },
        execute: async (params) => {
          // Use Playwright/Puppeteer to capture screenshot
          const screenshot = await this.captureScreenshot(params);

          // Upload to Canopy for PR description
          const uploadedUrl = await this.apiClient.uploadScreenshot(
            this.sessionId,
            screenshot
          );

          return {
            screenshotUrl: uploadedUrl,
            message: 'Screenshot captured and will be included in PR'
          };
        }
      }
    ];
  }
}
```

### OpenCode Deployment Architecture

#### Option 1: One OpenCode Server per Session (Isolated)

```
┌─────────────────────────────────────────┐
│         Canopy API Server               │
└─────────────────────────────────────────┘
                    │
        ┌───────────┼────────────┐
        ▼           ▼            ▼
┌──────────┐  ┌──────────┐  ┌──────────┐
│ Modal    │  │ Modal    │  │ Modal    │
│ Sandbox  │  │ Sandbox  │  │ Sandbox  │
│          │  │          │  │          │
│ OpenCode │  │ OpenCode │  │ OpenCode │
│ Server 1 │  │ Server 2 │  │ Server 3 │
└──────────┘  └──────────┘  └──────────┘

Each sandbox:
- Full dev environment
- OpenCode server on port 8080
- Canopy plugins installed
- Isolated file system
- Own Claude API key/quota
```

**Pros**:
- Complete isolation (one crash doesn't affect others)
- Easy to scale (spin up more sandboxes)
- Simple deployment model
- Can use different models per session

**Cons**:
- Higher resource usage
- More complex management (many processes)
- Need load balancing

#### Option 2: Multi-tenant OpenCode (Shared Server)

```
┌─────────────────────────────────────────┐
│         Canopy API Server               │
└─────────────────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────┐
│     OpenCode Cluster (Multi-tenant)     │
│                                          │
│  ┌──────────┐  ┌──────────┐            │
│  │ OpenCode │  │ OpenCode │            │
│  │ Instance │  │ Instance │  ...       │
│  │          │  │          │            │
│  │ Session  │  │ Session  │            │
│  │ 1, 2, 3  │  │ 4, 5, 6  │            │
│  └──────────┘  └──────────┘            │
└─────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────┐
│    Shared Modal Sandboxes (Workspace)   │
│  Session-specific workspaces isolated   │
└─────────────────────────────────────────┘
```

**Pros**:
- Lower resource usage
- Simpler to manage (fewer processes)
- Shared caching/optimizations

**Cons**:
- Need careful workspace isolation
- One OpenCode bug could affect multiple sessions
- More complex concurrency handling

### Recommended: Option 1 (One OpenCode per Session)

Align with Ramp's approach:
- Each session = isolated sandbox
- OpenCode server runs in sandbox
- Canopy API orchestrates multiple OpenCode instances
- Better fault isolation
- Simpler to reason about

### Implementation Checklist

#### Phase 1: Basic OpenCode Integration
- [ ] Set up Modal with OpenCode image
- [ ] Start OpenCode server in sandbox on session create
- [ ] Connect Canopy API to OpenCode HTTP/WebSocket
- [ ] Forward prompts from Canopy → OpenCode
- [ ] Stream OpenCode responses back to Canopy clients

#### Phase 2: Custom Plugins
- [ ] Create Feature Context plugin
- [ ] Add tools: `read_feature_context`, `add_feature_learning`
- [ ] Implement system prompt enrichment with feature context
- [ ] Test cross-session context sharing

#### Phase 3: Advanced Features
- [ ] Cross-session query plugin
- [ ] Session spawning tool
- [ ] Verification tools (tests, visual)
- [ ] File operation hooks for context awareness

#### Phase 4: Optimization
- [ ] Warm sandbox pools
- [ ] Image pre-building pipeline
- [ ] Plugin caching
- [ ] Claude API rate limiting per feature

---

## Sandbox Environment Options

### Why Sandboxing is Critical

Running agents in sandboxed environments is **non-negotiable** for:
1. **Security**: Prevent malicious code execution from affecting host
2. **Isolation**: One session can't interfere with another
3. **Resource Control**: Limit CPU, memory, disk per session
4. **Clean State**: Each session starts fresh, no leftover artifacts
5. **Reproducibility**: Consistent environment across sessions
6. **Multi-tenancy**: Safely run multiple teams' code on shared infrastructure

### Sandbox Solution Comparison

#### Option 1: Modal (Ramp's Choice)

**What**: Serverless platform for AI infrastructure with specialized container sandboxes

**Key Features**:
- Near-instant startup with container snapshots
- File system snapshots (save/restore state)
- GPU support for local model inference
- Built-in secret management
- Automatic scaling

**Setup**:
```python
import modal

# Define image with dev environment
stub = modal.Stub("canopy-agent")

opencode_image = (
    modal.Image.debian_slim()
    .apt_install("git", "curl", "build-essential")
    .run_commands(
        "curl -fsSL https://deb.nodesource.com/setup_20.x | bash -",
        "apt-get install -y nodejs"
    )
    .pip_install("opencode", "playwright")
    .run_commands("npx playwright install")
)

@stub.function(
    image=opencode_image,
    timeout=3600,  # 1 hour
    cpu=2.0,
    memory=4096,
)
def run_agent_session(session_id: str, feature_id: str, prompt: str):
    # Agent runs in isolated sandbox
    import opencode
    agent = opencode.start(workspace="/workspace")
    return agent.execute(prompt)
```

**Pros**:
- Production-proven (Ramp uses it)
- Excellent snapshot/restore for pause/resume
- Fast cold starts
- Managed infrastructure (no ops burden)
- Great Python SDK

**Cons**:
- Vendor lock-in
- Costs can be high at scale
- Limited control over underlying infra
- Less flexible than self-hosted

**Best for**: Fast MVP, Python-heavy teams, avoiding DevOps complexity

---

#### Option 2: E2B (Code Interpreters)

**What**: Purpose-built sandboxes for AI code execution

**Key Features**:
- Designed specifically for AI agents
- Firecracker VMs (lightweight, secure)
- Pre-built templates (Node.js, Python, full Linux)
- Real-time streaming of execution
- Built-in file system snapshots

**Setup**:
```typescript
import { Sandbox } from '@e2b/sdk';

const sandbox = await Sandbox.create({
  template: 'nodejs', // or custom template
  timeoutMs: 3600000, // 1 hour
  metadata: {
    sessionId: 'session-123',
    featureId: 'feature-456'
  }
});

// Install OpenCode
await sandbox.commands.run('npm install -g opencode');

// Start OpenCode server
const opencodeProcess = await sandbox.commands.run(
  'opencode server --port 8080',
  { background: true }
);

// Connect to OpenCode
const response = await sandbox.fetch('http://localhost:8080/api/prompt', {
  method: 'POST',
  body: JSON.stringify({ prompt: userPrompt })
});

// Snapshot for later resume
const snapshotId = await sandbox.snapshot();

// Restore later
const restored = await Sandbox.create({
  template: snapshotId
});
```

**Pros**:
- Built specifically for AI code execution
- Excellent developer experience
- Firecracker VMs (same as AWS Lambda)
- Good pricing model
- TypeScript-first SDK

**Cons**:
- Newer platform (less battle-tested)
- Smaller community than Modal
- Limited to code execution use case

**Best for**: TypeScript/Node.js teams, AI-native use cases, cost-conscious

---

#### Option 3: Docker Containers (Self-Hosted)

**What**: Run Docker containers for each session on your own infrastructure

**Architecture**:
```
┌─────────────────────────────────────┐
│      Canopy API Server              │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│     Docker Host (or Swarm)          │
│                                      │
│  ┌──────────┐  ┌──────────┐        │
│  │Container │  │Container │  ...   │
│  │Session 1 │  │Session 2 │        │
│  │          │  │          │        │
│  │ OpenCode │  │ OpenCode │        │
│  └──────────┘  └──────────┘        │
└─────────────────────────────────────┘
```

**Setup**:
```typescript
import Docker from 'dockerode';

const docker = new Docker();

async function createSessionSandbox(sessionId: string) {
  // Pull pre-built image
  await docker.pull('canopy/opencode:latest');

  // Create container
  const container = await docker.createContainer({
    Image: 'canopy/opencode:latest',
    name: `canopy-session-${sessionId}`,
    Env: [
      `SESSION_ID=${sessionId}`,
      `FEATURE_ID=${featureId}`,
      `CANOPY_API_URL=${apiUrl}`
    ],
    HostConfig: {
      Memory: 4 * 1024 * 1024 * 1024, // 4GB
      CpuQuota: 200000, // 2 CPUs
      NetworkMode: 'bridge',
      ReadonlyRootfs: false,
      AutoRemove: true,
      LogConfig: {
        Type: 'json-file',
        Config: { 'max-size': '10m', 'max-file': '3' }
      }
    }
  });

  await container.start();

  // Wait for OpenCode to be ready
  await waitForService(`http://${container.id}:8080/health`);

  return {
    containerId: container.id,
    url: `http://${container.id}:8080`
  };
}

// Dockerfile for image
/*
FROM node:20-slim

RUN apt-get update && apt-get install -y \
    git curl build-essential python3 \
    && rm -rf /var/lib/apt/lists/*

RUN npm install -g opencode

WORKDIR /workspace

COPY plugins /plugins
RUN cd /plugins && npm install

EXPOSE 8080

CMD ["opencode", "server", "--port", "8080"]
*/
```

**Pros**:
- Full control over infrastructure
- No vendor lock-in
- Cost-effective at scale (own hardware)
- Can customize everything
- Works offline/air-gapped

**Cons**:
- Need to manage Docker infrastructure
- Container orchestration complexity
- Slower cold starts than Modal/E2B
- Security burden (patching, isolation)
- DevOps overhead

**Best for**: Large companies, on-premise requirements, cost optimization at scale

---

#### Option 4: Kubernetes Pods

**What**: Run each session as Kubernetes pod with resource limits

**Architecture**:
```yaml
apiVersion: v1
kind: Pod
metadata:
  name: canopy-session-${SESSION_ID}
  labels:
    app: canopy-agent
    session: ${SESSION_ID}
    feature: ${FEATURE_ID}
spec:
  containers:
  - name: opencode
    image: canopy/opencode:latest
    resources:
      requests:
        memory: "2Gi"
        cpu: "1000m"
      limits:
        memory: "4Gi"
        cpu: "2000m"
    env:
    - name: SESSION_ID
      value: ${SESSION_ID}
    - name: FEATURE_ID
      value: ${FEATURE_ID}
    volumeMounts:
    - name: workspace
      mountPath: /workspace
  volumes:
  - name: workspace
    emptyDir:
      sizeLimit: 10Gi
  restartPolicy: Never
  activeDeadlineSeconds: 3600  # 1 hour timeout
```

**Pros**:
- Industry-standard orchestration
- Excellent resource management
- Auto-scaling built-in
- Good monitoring/logging
- Multi-cloud portable

**Cons**:
- K8s complexity overhead
- Slower pod startup (10-30s)
- Need persistent volume strategy
- More operational burden

**Best for**: Already using K8s, enterprise scale, multi-cloud

---

#### Option 5: Firecracker VMs

**What**: Lightweight microVMs with strong isolation (used by AWS Lambda and E2B)

**Architecture**:
```
┌─────────────────────────────────────┐
│    Canopy API Server                │
└─────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────┐
│   Firecracker VMM Host              │
│                                      │
│  ┌──────────┐  ┌──────────┐        │
│  │microVM 1 │  │microVM 2 │  ...   │
│  │          │  │          │        │
│  │ OpenCode │  │ OpenCode │        │
│  │ Session  │  │ Session  │        │
│  └──────────┘  └──────────┘        │
└─────────────────────────────────────┘
```

**Setup** (simplified):
```bash
# Start Firecracker VM
firectl \
  --kernel=/vmlinux \
  --root-drive=/rootfs.ext4 \
  --kernel-opts="console=ttyS0 reboot=k panic=1" \
  --cpu-count=2 \
  --memory=2048 \
  --socket-path=/tmp/firecracker-session-123.sock
```

**Pros**:
- Strongest isolation (full VMs)
- Fast startup (< 125ms)
- Minimal overhead
- AWS Lambda-grade security
- No container escape vulnerabilities

**Cons**:
- Complex to set up and manage
- Need custom tooling (or use E2B)
- Linux-only host
- Steeper learning curve

**Best for**: Maximum security requirements, custom control, advanced teams

---

#### Option 6: Cloud Provider Solutions

##### AWS Lambda with Container Images
```typescript
// Lambda with OpenCode container
const lambda = new AWS.Lambda();

const result = await lambda.invoke({
  FunctionName: 'canopy-agent-runner',
  Payload: JSON.stringify({
    sessionId: 'session-123',
    featureId: 'feature-456',
    prompt: userPrompt
  }),
  InvocationType: 'RequestResponse'
}).promise();
```

**Pros**: Serverless, auto-scaling, AWS-native
**Cons**: 15-min timeout, cold starts, complex for long-running

##### Google Cloud Run
```yaml
service: canopy-agent
containers:
- image: gcr.io/canopy/opencode
  resources:
    limits:
      cpu: 2000m
      memory: 4Gi
  timeout: 3600s
```

**Pros**: Container-native, longer timeout (60min), good pricing
**Cons**: Stateless (need external storage), GCP lock-in

##### Azure Container Instances
```bash
az container create \
  --resource-group canopy \
  --name session-123 \
  --image canopy/opencode:latest \
  --cpu 2 --memory 4 \
  --restart-policy Never
```

**Pros**: Fast container startup, pay-per-second, Azure-native
**Cons**: Slower than specialized solutions, Azure lock-in

---

### Sandbox Recommendation Matrix

| Use Case | Recommendation | Why |
|----------|---------------|-----|
| **Fast MVP** | Modal or E2B | Managed, fast setup, proven |
| **TypeScript-heavy** | E2B | TypeScript-first SDK, Node.js optimized |
| **Python-heavy** | Modal | Better Python experience |
| **Cost-sensitive** | E2B or self-hosted Docker | Lower pricing, pay-per-use |
| **Enterprise scale** | Kubernetes or Firecracker | Control, security, scale |
| **On-premise** | Docker or Firecracker | No external dependencies |
| **Maximum security** | Firecracker | VM-level isolation |
| **Serverless preference** | Cloud Run or E2B | No server management |

### Recommended for Canopy: **E2B or Modal**

**Choose E2B if**:
- TypeScript/Node.js is your primary stack
- Want best developer experience
- Cost optimization important
- Like having code-execution-specific features

**Choose Modal if**:
- Following Ramp's architecture closely
- Python-heavy implementation
- Want proven production solution
- Need GPU support (future ML features)

### Sandbox Security Best Practices

1. **Network Isolation**:
   ```typescript
   // Whitelist only necessary domains
   const allowedDomains = [
     'api.anthropic.com',  // Claude API
     'github.com',          // Git operations
     'canopy-api.internal'  // Your API
   ];

   // Block all other outbound traffic
   sandbox.setNetworkPolicy({
     mode: 'whitelist',
     allowed: allowedDomains
   });
   ```

2. **Resource Limits**:
   ```typescript
   const limits = {
     cpu: '2000m',        // 2 vCPUs
     memory: '4Gi',       // 4GB RAM
     disk: '10Gi',        // 10GB storage
     processes: 100,      // Max processes
     timeout: 3600000,    // 1 hour
     fileHandles: 1024    // Max open files
   };
   ```

3. **Read-Only File System** (where possible):
   ```typescript
   sandbox.mount({
     '/usr': { readOnly: true },
     '/bin': { readOnly: true },
     '/workspace': { readOnly: false }  // Only workspace writable
   });
   ```

4. **Secret Management**:
   ```typescript
   // Never pass secrets directly
   // Use sandbox's secret injection
   await sandbox.setSecrets({
     GITHUB_TOKEN: await vault.getSecret('github-token'),
     CLAUDE_API_KEY: await vault.getSecret('claude-api-key')
   });
   ```

5. **Audit Logging**:
   ```typescript
   sandbox.on('command', (cmd) => {
     logger.info('Sandbox command', {
       sessionId,
       command: cmd.command,
       args: cmd.args,
       timestamp: Date.now()
     });
   });
   ```

---

## Cloudflare-Native Architecture

### Why Consider Cloudflare?

Cloudflare offers a complete edge-native stack that could power Canopy entirely:

**Key Technologies**:
1. **Cloudflare Durable Objects**: Stateful, low-latency storage (Ramp uses this)
2. **Cloudflare Workers**: Serverless compute at the edge
3. **Cloudflare Browser Rendering**: Headless browser sandboxes
4. **Cloudflare Agents SDK**: Real-time WebSocket management
5. **Cloudflare R2**: S3-compatible object storage
6. **Cloudflare D1**: SQLite at the edge

### Cloudflare Durable Objects Deep Dive

**What They Are**:
- Single-threaded JavaScript objects with persistent storage
- Each object has its own SQLite database
- Strong consistency within a single object
- WebSocket Hibernation API (connections stay open without compute cost)

**Perfect for Canopy Because**:
- Each session/feature = one Durable Object
- Built-in SQLite for session state
- Native WebSocket support for real-time updates
- Automatic state replication
- Pay only when active (hibernation is free)

**Architecture**:
```typescript
// Feature Durable Object
export class FeatureDO {
  private state: DurableObjectState;
  private storage: DurableObjectStorage;
  private sessions: Map<string, WebSocket>;
  private db: SqlStorage; // Built-in SQLite

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.storage = state.storage;
    this.db = state.storage.sql;
  }

  async fetch(request: Request): Promise<Response> {
    // Handle HTTP requests (REST API)
    const url = new URL(request.url);

    if (url.pathname === '/sessions') {
      return this.handleCreateSession(request);
    }

    if (url.pathname === '/context') {
      return this.handleGetContext(request);
    }

    // Upgrade to WebSocket for real-time
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request);
    }

    return new Response('Not found', { status: 404 });
  }

  async handleWebSocket(request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    // Accept WebSocket
    this.state.acceptWebSocket(server);

    // Store metadata
    const userId = request.headers.get('X-User-Id');
    server.serializeAttachment({ userId });

    // Broadcast to other connections
    this.broadcast({
      type: 'participant_joined',
      userId: userId
    }, server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async webSocketMessage(ws: WebSocket, message: string) {
    const data = JSON.parse(message);

    if (data.type === 'prompt') {
      // Add to prompt queue in SQLite
      await this.db.exec(`
        INSERT INTO prompts (session_id, user_id, content, created_at)
        VALUES (?, ?, ?, ?)
      `, data.sessionId, data.userId, data.content, Date.now());

      // Trigger agent (send to sandbox)
      await this.triggerAgent(data.sessionId, data.content);

      // Broadcast to all participants
      this.broadcast({
        type: 'prompt_queued',
        sessionId: data.sessionId,
        prompt: data.content
      });
    }
  }

  broadcast(message: any, exclude?: WebSocket) {
    const msg = JSON.stringify(message);
    this.state.getWebSockets().forEach(ws => {
      if (ws !== exclude && ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    });
  }

  async alarm() {
    // Called periodically to clean up idle sessions
    const idleTime = 30 * 60 * 1000; // 30 minutes
    const idleSessions = await this.db.exec(`
      SELECT id FROM sessions
      WHERE last_activity < ?
    `, Date.now() - idleTime);

    for (const session of idleSessions) {
      await this.terminateSession(session.id);
    }
  }
}
```

**How Ramp Uses Durable Objects**:
- Each session = one Durable Object instance
- SQLite stores conversation history, session state, events
- WebSocket Hibernation keeps connections open to all clients
- When agent produces output, DO broadcasts to all connected clients
- Automatic state persistence (no separate DB needed)

### Cloudflare Browser Rendering (Sandboxes)

**What It Is**:
- Managed headless Chrome instances
- Run in Cloudflare's network (globally distributed)
- Can execute arbitrary JavaScript
- Capture screenshots, PDFs

**How It Could Work for Canopy**:
```typescript
export default {
  async fetch(request, env): Promise<Response> {
    const browser = await puppeteer.launch(env.MYBROWSER);
    const page = await browser.newPage();

    // Navigate to your app
    await page.goto('https://localhost:3000');

    // Let agent interact via Puppeteer
    await page.click('#login-button');

    // Take screenshot for verification
    const screenshot = await page.screenshot();

    await browser.close();

    return new Response(screenshot, {
      headers: { 'Content-Type': 'image/png' }
    });
  }
};
```

**Limitations**:
- **Not suitable for OpenCode execution**: Browser rendering is for browser automation, not running arbitrary Linux commands
- Can't run git, npm, build tools, etc.
- Only useful for visual verification part

### Complete Cloudflare-Native Architecture

**IMPORTANT INSIGHT**: Use Durable Objects per **Feature** (not per session)
- Each Feature DO manages multiple sessions
- Better for cross-session queries
- Natural place for team chat, collaborative notes
- Easier to implement feature-level collaboration

```
┌─────────────────────────────────────────────────────────┐
│                    Client Layer                          │
│     (Web, Slack Bot, Chrome Extension)                   │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────┐
│            Cloudflare Workers (Edge API)                 │
│  - Route requests to correct Feature DO                 │
│  - Authentication (GitHub OAuth)                         │
│  - Rate limiting                                         │
└─────────────────────────────────────────────────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│  Feature DO      │  │  Feature DO      │  │  Feature DO      │
│  "Add OAuth"     │  │  "Fix Login"     │  │  "..."           │
│                  │  │                  │  │                  │
│ - SQLite DB      │  │ - SQLite DB      │  │ - SQLite DB      │
│   • Sessions     │  │   • Sessions     │  │   • Sessions     │
│   • Context      │  │   • Context      │  │   • Context      │
│   • Chat msgs    │  │   • Chat msgs    │  │   • Chat msgs    │
│   • Notes        │  │   • Notes        │  │   • Notes        │
│ - WebSockets     │  │ - WebSockets     │  │ - WebSockets     │
│   (team collab)  │  │   (team collab)  │  │   (team collab)  │
│                  │  │                  │  │                  │
│ Manages:         │  │ Manages:         │  │ Manages:         │
│ ├─ Session 1     │  │ ├─ Session 1     │  │ ├─ Session 1     │
│ ├─ Session 2     │  │ ├─ Session 2     │  │ └─ Session 2     │
│ └─ Session 3     │  │ └─ Session 3     │  │                  │
└──────────────────┘  └──────────────────┘  └──────────────────┘
        │                 │                 │
        │                 │                 │
        └─────────────────┼─────────────────┘
                          ▼
┌─────────────────────────────────────────────────────────┐
│         Sandbox Layer (E2B/Modal - NOT Cloudflare)       │
│                                                           │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│  │ E2B/Modal    │  │ E2B/Modal    │  │ E2B/Modal    │  │
│  │ Sandbox 1    │  │ Sandbox 2    │  │ Sandbox 3    │  │
│  │              │  │              │  │              │  │
│  │ OpenCode     │  │ OpenCode     │  │ OpenCode     │  │
│  │ Server       │  │ Server       │  │ Server       │  │
│  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────┘
                          │
                          ▼
               ┌────────────────────┐
               │  Cloudflare R2     │
               │  (Object Storage)  │
               │  - Snapshots       │
               │  - Artifacts       │
               └────────────────────┘
                          │
                          ▼
               ┌────────────────────┐
               │  MongoDB Atlas     │
               │  (Global Data)     │
               │  - Users           │
               │  - Teams           │
               │  - Analytics       │
               │  - Feature Archive │
               └────────────────────┘
```

### Critical Insight: Durable Objects per Feature (Not Session)

**The Problem with DO per Session**:
- ❌ Hard to query across sessions in same feature
- ❌ No natural place for cross-session context
- ❌ Complex coordination between session DOs
- ❌ Can't easily implement feature-level chat/notes
- ❌ Each session isolated (defeats feature grouping purpose)

**The Solution: DO per Feature**:
- ✅ One Feature DO manages all its sessions
- ✅ Easy cross-session queries (same SQLite DB)
- ✅ Natural home for feature context
- ✅ Can add team chat within feature
- ✅ Collaborative notes per feature
- ✅ Simpler architecture (fewer DOs)

**Feature DO Schema**:
```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  title TEXT,
  status TEXT,
  sandbox_id TEXT,
  created_at INTEGER,
  created_by TEXT
);

CREATE TABLE context (
  id TEXT PRIMARY KEY,
  type TEXT, -- 'learning' | 'decision' | 'file'
  content TEXT,
  from_session TEXT,
  importance TEXT,
  created_at INTEGER
);

CREATE TABLE chat_messages (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  content TEXT,
  created_at INTEGER
);

CREATE TABLE notes (
  id TEXT PRIMARY KEY,
  title TEXT,
  content TEXT,
  created_by TEXT,
  updated_at INTEGER
);

CREATE TABLE events (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  type TEXT,
  payload TEXT,
  created_at INTEGER
);
```

**Benefits**:
- All sessions in feature visible in one query
- Cross-session context joins trivial (same DB)
- WebSocket per feature (all team members see all sessions)
- Can add @mentions, reactions, collaborative features
- Much better for your "feature grouping" vision

**Example Code**:
```typescript
export class FeatureDO {
  async querySiblingSession(currentSessionId: string, question: string) {
    // All sessions accessible - same SQLite!
    const sessions = await this.db.exec(`
      SELECT * FROM sessions
      WHERE id != ? AND status = 'completed'
    `, currentSessionId).toArray();

    // RAG over all session events
    const events = await this.db.exec(`
      SELECT * FROM events
      WHERE session_id IN (${sessions.map(s => s.id).join(',')})
      ORDER BY created_at DESC
    `).toArray();

    // Use AI to answer question from events
    return await this.queryWithAI(question, events);
  }

  async getFeatureChat() {
    // Built-in team chat for feature
    return await this.db.exec(`
      SELECT * FROM chat_messages
      ORDER BY created_at DESC
      LIMIT 100
    `).toArray();
  }
}
```

### Cloudflare Sandboxes Clarification

**Important**: There are different "Cloudflare sandboxes":

#### 1. Cloudflare Browser Rendering (NOT suitable)
- Headless Chrome for web automation
- Good for: Screenshots, PDF generation, visual testing
- **Bad for**: Running OpenCode, git, npm, etc.
- **Verdict**: Can't use for agent execution

#### 2. Cloudflare Workers for Platforms (Potentially suitable)
- Let you run user's code in Workers
- V8 isolates (JavaScript/WASM only)
- **Limitation**: Can't run native binaries (git, node, python)
- **Verdict**: Not suitable for full dev environment

#### 3. Third-party on Cloudflare (Best option)
- Use E2B/Modal for sandboxes
- Cloudflare for API/state/real-time
- Keep them separate
- **Verdict**: This is the way (and what we recommend)

**Conclusion**: Cloudflare doesn't have suitable sandboxes for OpenCode. Must use E2B/Modal/self-hosted.

### Why Hybrid (Cloudflare + E2B/Modal)?

**Cloudflare is GREAT for**:
- ✅ API layer (Workers + Durable Objects)
- ✅ Real-time WebSocket management (Hibernation API)
- ✅ Session/Feature state management (SQLite per DO)
- ✅ Edge distribution (low latency globally)
- ✅ Cost efficiency (pay per request, hibernation free)

**Cloudflare is NOT GREAT for**:
- ❌ Running Linux commands (git, npm, etc.)
- ❌ Full dev environments (Node.js, Python, databases)
- ❌ Long-running processes (Workers have 30s CPU limit, even with Durable Objects)
- ❌ Arbitrary code execution in sandboxes

**Solution**: Hybrid Architecture
- **Cloudflare**: API + State + Real-time sync
- **E2B/Modal**: Agent execution sandboxes

### Implementation Example

#### 1. Cloudflare Worker (Router)
```typescript
// worker.ts
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // Route to appropriate Durable Object
    if (url.pathname.startsWith('/features')) {
      const featureId = url.pathname.split('/')[2];

      // Get Durable Object stub
      const id = env.FEATURES.idFromName(featureId);
      const stub = env.FEATURES.get(id);

      // Forward request
      return stub.fetch(request);
    }

    return new Response('Not found', { status: 404 });
  }
};
```

#### 2. Feature Durable Object (State Management)
```typescript
// feature-do.ts
export class FeatureDO {
  private state: DurableObjectState;
  private db: SqlStorage;
  private env: Env;

  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.db = state.storage.sql;
    this.env = env;

    // Initialize schema
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT,
        status TEXT,
        created_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS context (
        id TEXT PRIMARY KEY,
        type TEXT, -- 'learning' | 'decision' | 'file'
        content TEXT,
        from_session TEXT,
        created_at INTEGER
      );

      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        session_id TEXT,
        type TEXT,
        payload TEXT,
        created_at INTEGER
      );
    `);
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    // WebSocket upgrade
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request);
    }

    // REST API
    if (url.pathname.endsWith('/sessions') && request.method === 'POST') {
      return this.createSession(request);
    }

    if (url.pathname.endsWith('/context')) {
      return this.getContext();
    }

    if (url.pathname.includes('/sessions/') && url.pathname.endsWith('/prompt')) {
      return this.handlePrompt(request);
    }

    return new Response('Not found', { status: 404 });
  }

  async createSession(request: Request): Promise<Response> {
    const { title, scope } = await request.json();
    const sessionId = crypto.randomUUID();

    // Store in SQLite
    await this.db.exec(`
      INSERT INTO sessions (id, title, status, created_at)
      VALUES (?, ?, 'active', ?)
    `, sessionId, title, Date.now());

    // Create sandbox via E2B API
    const sandbox = await fetch('https://api.e2b.dev/sandboxes', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.env.E2B_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        template: 'opencode-node',
        metadata: { sessionId, featureId: this.state.id.toString() }
      })
    });

    const { sandboxId } = await sandbox.json();

    // Store sandbox ID
    await this.db.exec(`
      UPDATE sessions SET sandbox_id = ? WHERE id = ?
    `, sandboxId, sessionId);

    // Broadcast event
    this.broadcast({
      type: 'session_created',
      sessionId,
      title
    });

    return Response.json({ sessionId, sandboxId });
  }

  async handlePrompt(request: Request): Promise<Response> {
    const { sessionId, content, userId } = await request.json();

    // Get session
    const session = await this.db.exec(`
      SELECT * FROM sessions WHERE id = ?
    `, sessionId).toArray()[0];

    // Send prompt to sandbox (E2B)
    const response = await fetch(`https://api.e2b.dev/sandboxes/${session.sandbox_id}/execute`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.env.E2B_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        command: `opencode prompt "${content}"`
      })
    });

    // Stream response back via WebSocket
    const stream = response.body;
    const reader = stream.getReader();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = new TextDecoder().decode(value);
      this.broadcast({
        type: 'agent_output',
        sessionId,
        content: chunk
      });
    }

    return Response.json({ success: true });
  }

  async getContext(): Promise<Response> {
    const context = await this.db.exec(`
      SELECT * FROM context ORDER BY created_at DESC
    `).toArray();

    return Response.json({
      learnings: context.filter(c => c.type === 'learning'),
      decisions: context.filter(c => c.type === 'decision'),
      keyFiles: context.filter(c => c.type === 'file')
    });
  }

  async handleWebSocket(request: Request): Promise<Response> {
    const pair = new WebSocketPair();
    const [client, server] = Object.values(pair);

    this.state.acceptWebSocket(server);

    // Send current state to new client
    const sessions = await this.db.exec('SELECT * FROM sessions').toArray();
    server.send(JSON.stringify({
      type: 'initial_state',
      sessions
    }));

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  broadcast(message: any) {
    const msg = JSON.stringify(message);
    this.state.getWebSockets().forEach(ws => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(msg);
      }
    });
  }

  async webSocketMessage(ws: WebSocket, message: string) {
    const data = JSON.parse(message);

    // Handle different message types
    if (data.type === 'add_learning') {
      await this.db.exec(`
        INSERT INTO context (id, type, content, from_session, created_at)
        VALUES (?, 'learning', ?, ?, ?)
      `, crypto.randomUUID(), data.content, data.sessionId, Date.now());

      this.broadcast({
        type: 'context_updated',
        learning: data.content
      });
    }
  }
}
```

#### 3. Wrangler Configuration
```toml
# wrangler.toml
name = "canopy-api"
main = "src/worker.ts"
compatibility_date = "2024-01-01"

[durable_objects]
bindings = [
  { name = "FEATURES", class_name = "FeatureDO" }
]

[[migrations]]
tag = "v1"
new_classes = ["FeatureDO"]

[vars]
E2B_API_URL = "https://api.e2b.dev"

[[r2_buckets]]
binding = "ARTIFACTS"
bucket_name = "canopy-artifacts"

[[d1_databases]]
binding = "DB"
database_name = "canopy-global"
database_id = "..."
```

### Cloudflare vs. Alternatives Comparison

| Feature | Cloudflare DO | E2B/Modal | Self-hosted |
|---------|---------------|-----------|-------------|
| **API/State** | ⭐⭐⭐⭐⭐ Perfect fit | ❌ Not designed for this | ✅ Full control |
| **Real-time** | ⭐⭐⭐⭐⭐ Hibernation API | ⚠️ Need separate WS server | ✅ Roll your own |
| **Code Execution** | ❌ Limited (30s CPU) | ⭐⭐⭐⭐⭐ Purpose-built | ✅ Full control |
| **Global Distribution** | ⭐⭐⭐⭐⭐ Edge network | ⚠️ Limited regions | ❌ Single region |
| **Cost at Scale** | ⭐⭐⭐⭐ Efficient | ⭐⭐⭐ Pay per use | ⭐⭐⭐⭐⭐ Cheapest |
| **Dev Experience** | ⭐⭐⭐⭐ Great | ⭐⭐⭐⭐⭐ Excellent | ⭐⭐ Complex |
| **Vendor Lock-in** | ⚠️ High | ⚠️ Medium | ✅ None |

### Pricing Comparison

**Cloudflare Durable Objects**:
- $0.15 per million requests
- $0.20 per GB-month storage
- WebSocket connections: FREE when hibernating
- Workers compute: $0.02 per million requests

**E2B Sandboxes**:
- $0.10 per hour of sandbox runtime
- ~$2.40 per day if running 24/7
- $72/month per always-on sandbox
- Cheaper if short-lived sessions

**Hybrid Cost Estimate** (100 concurrent sessions):
- Cloudflare API: ~$50/month (mostly free tier)
- E2B Sandboxes: ~$1000/month (assuming 4hr avg session life)
- **Total**: ~$1050/month for 100 concurrent sessions

**Modal** (alternative to E2B):
- Similar pricing to E2B
- May be slightly cheaper at very high scale

### Recommended Cloudflare Strategy

#### Option 1: Cloudflare + E2B (Recommended for MVP)
```
API Layer: Cloudflare Workers + Durable Objects
Real-time: Cloudflare Agents SDK (WebSocket Hibernation)
State: SQLite (built into DOs)
Sandboxes: E2B
Storage: Cloudflare R2
```

**Why**:
- Fast to build (Wrangler CLI, great DX)
- Durable Objects perfect for feature/session state
- E2B handles complex sandbox requirements
- Cloudflare free tier generous (low initial cost)
- Easy to deploy globally

**When it breaks down**:
- Very high scale (>1000 concurrent sessions)
- Need more control over sandbox infrastructure
- Want to minimize vendor lock-in

#### Option 2: Cloudflare + Modal
Same as Option 1 but use Modal instead of E2B:
- Better if team is Python-heavy
- Proven at scale (Ramp uses it)
- More mature platform

#### Option 3: Cloudflare + Self-hosted Sandboxes
```
API: Cloudflare
Sandboxes: Your own Docker/K8s cluster
```

**When to choose**:
- Enterprise with ops team
- Need full control
- Very high scale (cheaper at 1000+ sessions)
- Data sovereignty requirements

#### Option 4: Pure Cloudflare (NOT RECOMMENDED)
Try to run everything on Cloudflare Workers

**Why not**:
- Can't run full dev environment in Workers
- 30s CPU limit too short for agent tasks
- Would need to severely limit what agent can do
- Cloudflare Browser Rendering not suitable for OpenCode

### Cloudflare Advantages for Canopy

1. **Perfect State Management**:
   - Each Feature = Durable Object
   - Built-in SQLite (no external DB needed for session state)
   - Strong consistency within feature

2. **Free WebSocket Connections**:
   - Hibernation API = connections open for free
   - Critical for real-time multiplayer
   - No need for separate WebSocket server

3. **Edge Distribution**:
   - API runs globally
   - Low latency worldwide
   - Users connect to nearest edge location

4. **Developer Experience**:
   - Wrangler CLI (deploy in seconds)
   - TypeScript native
   - Great local development (Miniflare)
   - Integrated testing

5. **Cost Efficiency**:
   - Generous free tier
   - Pay only for active compute
   - No idle costs for API layer

6. **Ecosystem Integration**:
   - R2 for storage (S3-compatible)
   - D1 for global database (if needed)
   - Pages for frontend hosting
   - Workers for API

### Cloudflare Challenges for Canopy

1. **Vendor Lock-in**:
   - Durable Objects are Cloudflare-specific
   - Hard to migrate away
   - **Mitigation**: Abstract DO logic behind interfaces

2. **Debugging**:
   - Distributed state harder to debug
   - Need good logging
   - **Mitigation**: Use Cloudflare Tail (real-time logs)

3. **Still Need Separate Sandboxes**:
   - Can't avoid E2B/Modal/self-hosted
   - Adds complexity
   - **Mitigation**: This is unavoidable given requirements

4. **Learning Curve**:
   - Durable Objects mental model different
   - Event-driven, not request-response
   - **Mitigation**: Good documentation, examples

### MongoDB vs PostgreSQL for Canopy

**Question**: Should we use MongoDB instead of PostgreSQL for global data?

#### MongoDB Advantages for Canopy

**1. Schema Flexibility**:
```javascript
// Can evolve schema without migrations
{
  featureId: "uuid",
  title: "Add OAuth",
  sessions: [
    { id: "s1", title: "Research", customField: "can add anytime" }
  ],
  context: {
    learnings: [...],
    decisions: [...],
    // Easy to add new fields
    designDocs: [...],
    relatedIssues: [...]
  }
}
```

**2. Natural Fit for Hierarchical Data**:
- Features → Sessions → Events is hierarchical
- Can denormalize for fast reads
- No joins needed for common queries

**3. Great for Unstructured Context**:
```javascript
{
  context: [
    { type: "learning", content: "...", metadata: { /* any shape */ } },
    { type: "decision", rationale: "...", alternatives: [...] },
    { type: "code_snippet", language: "ts", code: "..." }
  ]
}
```

**4. Horizontal Scaling**:
- Sharding built-in
- Replica sets for HA
- Good for multi-region

**5. Developer Experience**:
- No schema migrations
- Easier to iterate quickly
- Good TypeScript support (Mongoose, Prisma)

**6. MongoDB Atlas**:
- Managed service (like Cloudflare D1)
- Global clusters
- Change streams (like event sourcing)
- Full-text search built-in

#### PostgreSQL Advantages for Canopy

**1. ACID Guarantees**:
- Stronger consistency
- Better for financial/audit data
- Transactions across tables

**2. Powerful Queries**:
```sql
-- Complex joins across features
SELECT f.title, COUNT(s.id) as session_count,
       AVG(s.duration) as avg_duration
FROM features f
JOIN sessions s ON s.feature_id = f.id
WHERE s.status = 'completed'
GROUP BY f.id
HAVING COUNT(s.id) > 5;
```

**3. JSONB for Flexibility**:
```sql
-- Get both structure AND flexibility
CREATE TABLE features (
  id UUID PRIMARY KEY,
  title TEXT NOT NULL,
  context JSONB, -- Unstructured data here
  created_at TIMESTAMP
);

-- Query JSON with SQL
SELECT * FROM features
WHERE context @> '{"type": "learning"}';
```

**4. Better Aggregations**:
- Window functions
- CTEs (Common Table Expressions)
- Advanced analytics

**5. More Mature Ecosystem**:
- Better tooling
- More extensions (PostGIS, pg_vector for embeddings)
- TimescaleDB for time-series

**6. Cost**:
- Often cheaper at scale
- Supabase (free tier generous)
- Self-hosted cheaper

#### Side-by-Side Comparison

| Feature | MongoDB | PostgreSQL |
|---------|---------|------------|
| **Schema Evolution** | ⭐⭐⭐⭐⭐ No migrations | ⭐⭐⭐ Need migrations |
| **Complex Queries** | ⭐⭐⭐ Aggregation pipeline | ⭐⭐⭐⭐⭐ SQL power |
| **Transactions** | ⭐⭐⭐ Multi-doc transactions | ⭐⭐⭐⭐⭐ ACID native |
| **Hierarchical Data** | ⭐⭐⭐⭐⭐ Natural fit | ⭐⭐⭐ Need joins |
| **Full-Text Search** | ⭐⭐⭐⭐ Built-in | ⭐⭐⭐ pg_trgm extension |
| **Horizontal Scale** | ⭐⭐⭐⭐⭐ Sharding native | ⭐⭐⭐ Harder (Citus) |
| **Learning Curve** | ⭐⭐⭐⭐ Easy | ⭐⭐⭐⭐ Easy (if know SQL) |
| **Ecosystem** | ⭐⭐⭐⭐ Good | ⭐⭐⭐⭐⭐ Excellent |
| **Cost** | ⭐⭐⭐ Atlas pricing | ⭐⭐⭐⭐ Cheaper |
| **Type Safety** | ⭐⭐⭐ Mongoose/Prisma | ⭐⭐⭐⭐ Prisma/Drizzle |

#### Hybrid Approach: Best of Both Worlds

**Use Both!**

```
Cloudflare Durable Objects (SQLite)
├─ Feature state (active features, live data)
├─ Session state (current sessions)
├─ Real-time context (learnings, decisions)
└─ Chat & notes (ephemeral collaboration)

MongoDB Atlas
├─ Feature archive (completed features)
├─ Analytics (usage patterns, metrics)
├─ User profiles & teams
├─ Audit logs
└─ Search index (full-text across all features)

PostgreSQL (optional - if need analytics)
├─ Time-series data (session metrics)
├─ Aggregated reports
└─ Complex joins for dashboards
```

#### Recommendation for Canopy

**Primary: Durable Objects (SQLite) + MongoDB**

**Why MongoDB over PostgreSQL**:
1. ✅ Schema flexibility (context structure will evolve)
2. ✅ Natural fit for hierarchical features/sessions
3. ✅ Change Streams (real-time sync from DOs to Mongo)
4. ✅ Full-text search (search across all features/sessions)
5. ✅ Horizontal scaling (when you have 1000s of teams)
6. ✅ Good for unstructured agent outputs

**When to choose PostgreSQL instead**:
- Your team already experts in PostgreSQL
- Need complex analytical queries
- Want to use pg_vector for embeddings (RAG)
- Prefer ACID guarantees over flexibility
- Want to minimize vendor count

#### Recommended Data Flow

```
Active Feature Session
      ↓ (real-time)
Durable Object (SQLite)
      ↓ (on completion)
MongoDB Atlas (archive)
      ↓ (daily)
Analytics (if needed)
```

**Example Schema (MongoDB)**:
```typescript
// Features Collection
interface Feature {
  _id: string;
  teamId: string;
  title: string;
  status: 'active' | 'completed' | 'archived';

  // Denormalized for fast access
  sessions: {
    id: string;
    title: string;
    status: string;
    createdBy: string;
    duration: number;
    prUrl?: string;
    merged?: boolean;
  }[];

  context: {
    learnings: Array<{
      content: string;
      fromSession: string;
      importance: 'low' | 'medium' | 'high';
      timestamp: Date;
    }>;
    decisions: Array<{
      decision: string;
      rationale: string;
      alternatives: string[];
      madeBy: string;
      timestamp: Date;
    }>;
  };

  metrics: {
    totalSessions: number;
    completedSessions: number;
    avgSessionDuration: number;
    totalPrompts: number;
    successRate: number;
  };

  collaboration: {
    participants: string[];
    chatMessageCount: number;
    notesCount: number;
  };

  createdAt: Date;
  updatedAt: Date;
  completedAt?: Date;

  // Flexible - can add anything
  tags?: string[];
  priority?: number;
  linkedIssues?: string[];
  customFields?: Record<string, any>;
}

// Users Collection
interface User {
  _id: string;
  githubId: string;
  email: string;
  name: string;
  teams: string[];
  stats: {
    featuresCreated: number;
    sessionsParticipated: number;
    promptsSent: number;
    prsMerged: number;
  };
  createdAt: Date;
}

// Teams Collection
interface Team {
  _id: string;
  name: string;
  members: Array<{
    userId: string;
    role: 'admin' | 'member' | 'viewer';
    joinedAt: Date;
  }>;
  repositories: Array<{
    url: string;
    enabled: boolean;
  }>;
  quotas: {
    maxConcurrentSessions: number;
    maxSessionDuration: number;
  };
  createdAt: Date;
}
```

**MongoDB Indexes**:
```javascript
// Features
db.features.createIndex({ teamId: 1, status: 1 });
db.features.createIndex({ "sessions.id": 1 });
db.features.createIndex({ createdAt: -1 });
db.features.createIndex({ "$**": "text" }); // Full-text

// Users
db.users.createIndex({ githubId: 1 }, { unique: true });
db.users.createIndex({ email: 1 }, { unique: true });

// Teams
db.teams.createIndex({ "members.userId": 1 });
```

**MongoDB Advantages Recap**:
- Schema evolution without downtime
- Hierarchical data natural fit
- Full-text search built-in
- Change streams for sync
- Atlas global clusters
- Great for AI/agent outputs (unstructured)

**Cost Estimate**:
- MongoDB Atlas: ~$60/month (M10 shared, 10GB)
- Cloudflare: ~$5/month (Durable Objects usage)
- **Total**: ~$65/month for DB layer

### Final Recommendation on Cloudflare

**Use Cloudflare Durable Objects for**:
- ✅ Feature coordination (ONE DO per feature, not per session!)
- ✅ Session state management (all sessions in feature)
- ✅ Real-time WebSocket handling (feature-level collaboration)
- ✅ API layer
- ✅ Feature context storage (learnings, decisions)
- ✅ Team chat within feature
- ✅ Collaborative notes

**Do NOT use Cloudflare for**:
- ❌ Running OpenCode sandboxes (use E2B/Modal)
- ❌ Long-running agent execution
- ❌ Full Linux development environments
- ❌ Global/persistent data (use MongoDB)

**Best Architecture** (Updated):
```
Frontend: Cloudflare Pages
API: Cloudflare Workers
State: Cloudflare Durable Objects (ONE per feature)
  ├─ Sessions (all sessions in feature)
  ├─ Context (cross-session learnings)
  ├─ Chat (team collaboration)
  └─ Notes (shared docs)
Real-time: Cloudflare Agents SDK
Sandboxes: E2B or Modal (NOT Cloudflare)
Object Storage: Cloudflare R2
Global Database: MongoDB Atlas
  ├─ Users & Teams
  ├─ Feature Archive
  ├─ Analytics
  └─ Search Index
```

**Key Insight**:
- **Active features**: Durable Objects (fast, real-time)
- **Completed features**: MongoDB (searchable, analytics)
- **Sandboxes**: E2B/Modal (only option for OpenCode)

This gives you:
- Ramp's proven approach (they use Durable Objects)
- Best-in-class real-time (WebSocket Hibernation)
- Proper sandboxing (E2B/Modal)
- Cross-session queries (same Feature DO)
- Team collaboration (chat, notes in DO)
- Global edge distribution
- Cost efficiency
- Schema flexibility (MongoDB)

---

## Recommended Architecture

### Hybrid Approach: Cloudflare Edge + Sandboxed Execution

**Why**: Combines best of both worlds - Cloudflare edge for API/state/real-time, E2B/Modal for sandbox execution.

**This is Ramp's approach**: Cloudflare Durable Objects + Modal sandboxes

```
                    ┌─────────────────────────────────┐
                    │         Frontend Clients        │
                    │  (Web, Slack, Chrome Extension) │
                    └─────────────────────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────┐
│                      API Gateway Layer                        │
│              (REST API + WebSocket Handler)                   │
└──────────────────────────────────────────────────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              ▼                    ▼                    ▼
    ┌──────────────────┐  ┌──────────────┐  ┌──────────────────┐
    │  Feature API     │  │  Session API │  │  Auth/User API   │
    │  - Create        │  │  - Manage    │  │  - GitHub OAuth  │
    │  - Shared context│  │  - Prompts   │  │  - Permissions   │
    └──────────────────┘  └──────────────┘  └──────────────────┘
              │                    │                    │
              └────────────────────┼────────────────────┘
                                   ▼
┌──────────────────────────────────────────────────────────────┐
│                  Feature Coordinator Layer                    │
│            (Manages feature lifecycle + context)              │
│                                                                │
│  ┌──────────────────────────────────────────────────┐        │
│  │   Feature "Add OAuth"                             │        │
│  │   ├─ Shared Context Store (Redis)                │        │
│  │   ├─ Session Registry                             │        │
│  │   └─ Event Bus (Feature-scoped)                  │        │
│  └──────────────────────────────────────────────────┘        │
│                                                                │
│      │                    │                    │              │
│      ▼                    ▼                    ▼              │
│  ┌─────────┐        ┌─────────┐        ┌─────────┐          │
│  │Session  │        │Session  │        │Session  │          │
│  │Manager 1│        │Manager 2│        │Manager 3│          │
│  └─────────┘        └─────────┘        └─────────┘          │
└──────────────────────────────────────────────────────────────┘
       │                     │                     │
       └─────────────────────┼─────────────────────┘
                             ▼
┌──────────────────────────────────────────────────────────────┐
│              Sandbox Orchestration Layer                      │
│                   (E2B or Modal)                              │
│                                                                │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │ Sandbox 1       │  │ Sandbox 2       │  │ Sandbox 3    │ │
│  ├─────────────────┤  ├─────────────────┤  ├──────────────┤ │
│  │ OpenCode Server │  │ OpenCode Server │  │ OpenCode...  │ │
│  │   + Plugins:    │  │   + Plugins:    │  │              │ │
│  │   - Feature     │  │   - Feature     │  │              │ │
│  │     Context     │  │     Context     │  │              │ │
│  │   - Cross       │  │   - Cross       │  │              │ │
│  │     Session     │  │     Session     │  │              │ │
│  │   - Verify      │  │   - Verify      │  │              │ │
│  ├─────────────────┤  ├─────────────────┤  ├──────────────┤ │
│  │ Git Repo        │  │ Git Repo        │  │ Git Repo     │ │
│  │ Dev Environment │  │ Dev Environment │  │ Dev Env...   │ │
│  │ VS Code Server  │  │ VS Code Server  │  │              │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└──────────────────────────────────────────────────────────────┘
                             │
                             ▼
              ┌──────────────────────────────┐
              │    Claude API (Anthropic)    │
              └──────────────────────────────┘

                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                    Persistence Layer                          │
│                                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │ PostgreSQL   │  │ Redis        │  │ S3/Storage   │       │
│  │              │  │              │  │              │       │
│  │ - Features   │  │ - Context    │  │ - Snapshots  │       │
│  │ - Sessions   │  │ - Pub/Sub    │  │ - Artifacts  │       │
│  │ - Events     │  │ - Cache      │  │ - Screenshots│       │
│  │ - Users      │  │ - Queues     │  │              │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└──────────────────────────────────────────────────────────────┘

                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                External Integrations                          │
│                                                                │
│  ┌────────┐  ┌────────┐  ┌─────────┐  ┌─────────┐          │
│  │ GitHub │  │ Sentry │  │Datadog  │  │  Slack  │  ...     │
│  └────────┘  └────────┘  └─────────┘  └─────────┘          │
└──────────────────────────────────────────────────────────────┘
```

### Recommended Tech Stack for Canopy

#### ⭐ PRIMARY RECOMMENDATION: Cloudflare + E2B/Modal

**Frontend**:
- **Hosting**: Cloudflare Pages
- **Framework**: React/Next.js, Vue, or Svelte
- **Real-time**: Native WebSocket → Cloudflare Workers

**API & State Management**:
- **Platform**: Cloudflare Workers + Durable Objects
- **Language**: TypeScript
- **State Storage**: SQLite (built into Durable Objects)
- **Real-Time**: Cloudflare Agents SDK (WebSocket Hibernation)
- **Each Feature** = One Durable Object instance

**Sandbox Execution**:
- **Primary**: E2B (TypeScript-first, cost-effective) or Modal (Python-friendly, proven)
- **Agent Runtime**: OpenCode server with custom plugins
- **Image Building**: GitHub Actions or similar CI pipeline

**Data Layer**:
- **Session/Feature State**: SQLite in Durable Objects (transient)
- **Global Data**: Cloudflare D1 (SQLite at edge) for users, teams, analytics
- **Object Storage**: Cloudflare R2 (snapshots, artifacts, screenshots)
- **Cache**: Durable Object storage (key-value)

**Authentication & Integrations**:
- **Auth**: GitHub OAuth (handled in Workers)
- **Git Operations**: Via OpenCode in sandboxes
- **GitHub API**: Octokit (@octokit/rest) in Workers

**Monitoring & Observability**:
- **Logging**: Cloudflare Tail + Logpush → DataDog/Axiom
- **Metrics**: Workers Analytics + custom metrics
- **Tracing**: Workers Traces
- **Error Tracking**: Sentry (via Workers)

**Why This Stack**:
- ✅ Same as Ramp (proven at scale)
- ✅ Minimal infrastructure (no servers to manage)
- ✅ Edge-native (low latency globally)
- ✅ Cost-efficient (free tier generous)
- ✅ Excellent DX (Wrangler CLI)
- ✅ Built-in real-time (WebSocket Hibernation)

#### Alternative Stack: Traditional Server + E2B

**If you prefer traditional backend**:

**API & Backend**:
- **Language**: TypeScript/Node.js
- **Framework**: Fastify or Hono
- **Real-Time**: Socket.io
- **Event Bus**: Redis Streams (pub/sub + persistence)

**Data Layer**:
- **Primary DB**: PostgreSQL 16+ (JSONB for flexible schemas)
- **Cache & Pub/Sub**: Redis 7+ (Streams, Hash, Sorted Sets)
- **Object Storage**: S3 or Minio

**Infrastructure**:
- **Hosting**: Railway, Render, or self-hosted
- **Container**: Docker + Docker Compose (dev) or Kubernetes (prod)

**When to choose this**:
- Team already experienced with traditional stack
- Need more control over infrastructure
- Want to avoid Cloudflare vendor lock-in
- Already have ops team for servers

#### Tech Stack Comparison

| Aspect | Cloudflare + E2B | Traditional + E2B |
|--------|------------------|-------------------|
| **Time to MVP** | ⭐⭐⭐⭐⭐ Fastest | ⭐⭐⭐ Slower |
| **Scalability** | ⭐⭐⭐⭐⭐ Auto | ⭐⭐⭐ Manual |
| **Cost (early)** | ⭐⭐⭐⭐⭐ Free tier | ⭐⭐⭐ $50+/month |
| **Complexity** | ⭐⭐⭐⭐ Low | ⭐⭐ High |
| **Control** | ⭐⭐⭐ Limited | ⭐⭐⭐⭐⭐ Full |
| **Vendor Lock-in** | ⭐⭐ High | ⭐⭐⭐⭐ Low |
| **Global Edge** | ⭐⭐⭐⭐⭐ Built-in | ❌ Not easily |
| **Real-time** | ⭐⭐⭐⭐⭐ Free WS | ⭐⭐⭐ Need server |

### Implementation Phases for Canopy

**Phase 1: Single Session MVP** (1-2 weeks)
Goals: Prove basic agent execution in sandbox
- [ ] Set up E2B or Modal account
- [ ] Build OpenCode container image
- [ ] Simple API: POST /sessions (create session + run prompt)
- [ ] Connect to OpenCode server in sandbox
- [ ] Stream agent responses via WebSocket
- [ ] Basic PostgreSQL schema (sessions, events)
- [ ] GitHub OAuth (basic, for git operations)
- [ ] Manual testing with one user

**Phase 2: Feature-Based Grouping** (2-3 weeks)
Goals: Add feature abstraction and shared context
- [ ] Add Features table and API endpoints
- [ ] Feature coordinator service
- [ ] Redis-based shared context store
- [ ] Sessions belong to features
- [ ] Create first custom OpenCode plugin: Feature Context
- [ ] Tool: `read_feature_context`
- [ ] Tool: `add_feature_learning`
- [ ] System prompt enrichment with feature context
- [ ] Feature dashboard UI (list sessions, show context)

**Phase 3: Cross-Session Intelligence** (2-3 weeks)
Goals: Enable sessions to learn from each other
- [ ] Cross-session query plugin
- [ ] Tool: `query_sibling_sessions` (RAG over session history)
- [ ] Tool: `spawn_related_session`
- [ ] Session dependency tracking (depends_on, blocks)
- [ ] Event bus for feature-level events
- [ ] Session completion triggers notification to blocked sessions

**Phase 4: Multiplayer & Collaboration** (2-3 weeks)
Goals: Multiple users in same session/feature
- [ ] Multi-user session support
- [ ] User presence (who's active in session)
- [ ] Prompt attribution (track who sent what)
- [ ] Git commit attribution (use correct user)
- [ ] RBAC: owner/contributor/viewer roles
- [ ] Real-time sync across all connected clients
- [ ] Team management (invite users, permissions)

**Phase 5: Production Hardening** (3-4 weeks)
Goals: Make it reliable and observable
- [ ] Resource limits (CPU, memory, time per session)
- [ ] Rate limiting (prompts per user/team)
- [ ] Sandbox cleanup (auto-terminate idle sessions)
- [ ] Error handling & retry logic
- [ ] Comprehensive logging (structured, searchable)
- [ ] Metrics (Prometheus): sessions created, prompts sent, PRs merged
- [ ] Alerting (failed sessions, high error rates)
- [ ] Audit logging (compliance)

**Phase 6: Client Surfaces** (3-4 weeks)
Goals: Multiple ways to interact
- [ ] Polished web UI (React/Next.js)
- [ ] Slack bot integration
  - [ ] Repository classifier
  - [ ] Thread-based conversations
  - [ ] Status updates with rich formatting
- [ ] Chrome extension (for visual changes)
  - [ ] Screenshot tool with DOM extraction
  - [ ] Sidebar chat interface
- [ ] VS Code extension (optional, for local integration)

**Phase 7: Verification & Quality** (2-3 weeks)
Goals: Agent can verify its own work
- [ ] Verification plugin for OpenCode
- [ ] Tool: `run_tests` (execute test suite, analyze results)
- [ ] Tool: `visual_verify` (screenshot UI, compare)
- [ ] Tool: `check_types` (TypeScript type errors)
- [ ] Tool: `lint_code` (ESLint, Prettier)
- [ ] Integration with CI/CD (trigger builds, get results)
- [ ] Auto-add test results to PR descriptions

**Phase 8: Optimization & Scale** (3-4 weeks)
Goals: Fast enough to be default workflow
- [ ] Image pre-building pipeline (30-min schedule like Ramp)
- [ ] Warm sandbox pools (keep sandboxes ready)
- [ ] Optimize git sync (parallel reads before sync done)
- [ ] Context caching (embeddings for RAG)
- [ ] Query optimization (database indexes)
- [ ] CDN for static assets
- [ ] Load testing (100+ concurrent sessions)
- [ ] Cost optimization (shut down unused sandboxes quickly)

**Phase 9: Advanced Features** (4-6 weeks)
Goals: Unique capabilities
- [ ] Session templates (common patterns)
- [ ] Feature planning agent (break down feature → sessions)
- [ ] Smart session decomposition suggestions
- [ ] Learning repository (common patterns, solutions)
- [ ] Agent skill system (custom skills per team/repo)
- [ ] Multi-repo features (span multiple repositories)
- [ ] Advanced analytics dashboard
  - Session success rate (% merged)
  - Time savings metrics
  - Most common failures
  - Team adoption trends

**Total Timeline**: ~6-9 months to full production with advanced features
**Core MVP**: Phases 1-4 (~2-3 months)

---

## Alternative Lightweight Architecture

If you want to start simpler:

### Simplified Stack
```
Frontend (React/Vue/Svelte)
         ↓
  API Gateway (Node.js/Express)
         ↓
  WebSocket Server (Socket.io)
         ↓
  PostgreSQL (sessions + events)
         ↓
  Agent Runner (Python/Node.js)
```

**Benefits**:
- Single language (Node.js) for easy development
- Fewer moving parts
- Easier to deploy (single server initially)
- Lower operational complexity

**Trade-offs**:
- Harder to scale horizontally
- No built-in fault tolerance
- Manual state management
- More coupling between components

---

## Conclusion

### For Rapid Prototyping
Start with **Strategy 1 (Event-Driven)** using:
- Node.js + Express + Socket.io
- Redis for pub/sub
- PostgreSQL for persistence
- Simple monolithic deployment

### For Production Scale
Evolve to **Hybrid Approach** with:
- Elixir/OTP actor system for session management
- Redis Streams for event bus
- Distributed agent runners
- Multi-region deployment

### Key Success Factors
1. **Start Simple**: Get core multiplayer experience working first
2. **Instrument Everything**: Logging, metrics, tracing from day one
3. **Design for Failure**: Agents will crash, handle gracefully
4. **Optimize for Collaboration**: UX around multiple users is critical
5. **Generic APIs**: Keep frontend completely decoupled from backend

### Next Steps
1. Validate core assumptions with spike/prototype
2. Load test session join/leave patterns
3. Benchmark agent execution times
4. Define API contracts (OpenAPI spec)
5. Set up infrastructure (IaC with Terraform/Pulumi)

---

## Key Decisions Summary

To help you move forward, here are the critical decisions to make:

### 1. Backend Platform
**Decision needed**: Traditional server or edge/serverless?

**Recommendation**: **Cloudflare Workers + Durable Objects**

**Rationale**:
- Same stack Ramp uses (proven at scale)
- Built-in real-time (WebSocket Hibernation = free)
- Perfect for feature/session state (SQLite per DO)
- Edge distribution (low latency globally)
- Minimal ops burden (no servers to manage)
- Cost-efficient (generous free tier)

**Alternative**: Traditional Node.js + PostgreSQL + Redis (more control, less vendor lock-in)

**Action**:
1. Create Cloudflare account
2. Follow Durable Objects tutorial
3. Build simple feature prototype
4. Test WebSocket Hibernation

### 2. Sandbox Provider
**Decision needed**: Which sandbox solution?

**Recommendation**: **E2B** for TypeScript teams, **Modal** for Python teams

**Rationale**:
- Both proven in production
- E2B: Better DX for Node.js/TypeScript, cost-effective
- Modal: Better Python support, used by Ramp
- Both support snapshots, fast startup, good APIs
- Cloudflare can't do this (30s CPU limit)

**Action**: Set up accounts for both, run benchmarks with OpenCode, choose based on:
- Language preference of your team
- Cost at expected scale
- Developer experience

### 3. Real-Time Transport
**Decision needed**: WebSocket library?

**Recommendation**: **Cloudflare Agents SDK** (if using Cloudflare)

**Rationale**:
- WebSocket Hibernation = connections open for free
- No separate WebSocket server needed
- Built into Durable Objects
- Automatic scaling

**Alternative (if not using Cloudflare)**: Socket.io (easy, reliable, good DX)

### 4. Feature Context Strategy
**Decision needed**: How to implement shared context?

**Recommendation**: **Durable Objects (if using Cloudflare)** or **Redis Shared Store (traditional)**

**Rationale for Durable Objects**:
- Each feature = one Durable Object
- Built-in SQLite for structured context
- Built-in WebSocket broadcasting
- Strong consistency within feature
- No separate Redis needed

**Rationale for Redis (traditional)**:
- Simpler than coordinator (no single point of failure)
- Redis is fast, reliable, easy to operate
- Pub/sub naturally handles multi-subscriber
- Easy to scale horizontally

**Implementation (Cloudflare)**:
```typescript
// Feature context in Durable Object's SQLite
await this.db.exec(`
  CREATE TABLE context (
    id TEXT PRIMARY KEY,
    type TEXT, -- 'learning' | 'decision' | 'file'
    content TEXT,
    from_session TEXT,
    created_at INTEGER
  )
`);
```

**Implementation (Redis)**:
```typescript
Feature context in Redis Hash:
  key: feature:{feature_id}
  fields: { learnings: JSON, decisions: JSON, files: JSON }

Feature events in Redis Streams:
  key: feature:{feature_id}:events
  messages: { type, payload, timestamp }
```

### 5. Development Priorities
**Decision needed**: Which phases to do first?

**Recommendation**: Phases 1-4 for MVP (2-3 months)

**Why skip others initially**:
- Phase 5 (hardening): Can add as issues arise
- Phase 6 (clients): Start with web only, add Slack once proven
- Phase 7 (verification): Nice-to-have, not critical for adoption
- Phase 8 (optimization): Premature optimization

**Critical path**: Feature abstraction + shared context → this is your differentiation

---

## Risk Mitigation

### Risk 1: OpenCode Maturity
**Risk**: OpenCode may have bugs or limitations
**Mitigation**:
- Contribute fixes upstream (open source)
- Design abstraction layer over OpenCode
- Be ready to switch agent runtime if needed
- Keep agent logic in plugins (portable)

### Risk 2: Sandbox Costs
**Risk**: E2B/Modal costs could be high at scale
**Mitigation**:
- Implement aggressive timeouts (auto-terminate idle)
- Warm pools only for active hours
- Monitor costs per session
- Plan migration to self-hosted Docker if costs exceed threshold ($X/month)

### Risk 3: Context Overload
**Risk**: Too much context could confuse agents
**Mitigation**:
- Use RAG (semantic search) instead of dumping all context
- Limit context to top-K most relevant items
- Let agent explicitly query (tool) vs. auto-inject
- A/B test context strategies

### Risk 4: Multiplayer Complexity
**Risk**: Concurrent prompts could cause conflicts
**Mitigation**:
- Start with FIFO queue (simple)
- Add visible queue UI (users see position)
- Allow cancellation (stop current, start new)
- Add "request control" feature (explicit turn-taking)

### Risk 5: Adoption
**Risk**: Users might not adopt if not better than local
**Mitigation**:
- **Speed is critical**: Must feel instant
- Start with Slack (virality)
- Show metrics (PRs merged, time saved)
- Celebrate wins (share successful sessions)
- Make it fun (good UX, fast feedback)

---

## Success Metrics

Track these to validate product-market fit:

### North Star Metric
**% of merged PRs written with Canopy** (target: 20-30% like Ramp)

### Leading Indicators
- Daily active users (DAU)
- Sessions created per day
- Prompts sent per session
- Session completion rate (% that result in PR)
- Time to first prompt (onboarding friction)

### Quality Metrics
- PR approval rate (% of AI-generated PRs that get approved)
- PR iteration count (how many revisions needed)
- Time from session start to PR merge
- User satisfaction (NPS or similar)

### Collaboration Metrics
- % of sessions with multiple participants
- Cross-session context usage (tool invocations)
- Feature completion rate (% of features that finish all planned sessions)

### Technical Metrics
- Session startup time (target: < 5 seconds)
- Agent time-to-first-token (target: < 2 seconds)
- Sandbox utilization (% of time sandboxes are active)
- Cost per session (target: < $1)

---

## Differentiation from Existing Tools

### vs. Cursor/Claude Code (Local Agents)
**Canopy wins on**:
- Multiplayer collaboration
- Unlimited concurrency (not limited by laptop)
- Shared context across sessions
- Works from anywhere (Slack, mobile)
- No local setup needed

### vs. Ramp Inspect (Private)
**Canopy's advantages**:
- Feature-based grouping (better for complex work)
- Cross-session intelligence (sessions learn from each other)
- Open architecture (can customize everything)
- Can be self-hosted (data privacy)

### vs. GitHub Copilot Workspace
**Canopy wins on**:
- Runs actual dev environment (not simulated)
- Real-time collaboration
- More control over agent behavior
- Can integrate with your tools

---

## Conclusion & Recommendation

### Start Here (Week 1-2)

#### Option A: Cloudflare Stack (Recommended)
1. **Set up Cloudflare account** (free tier)
2. **Install Wrangler**: `npm install -g wrangler`
3. **Create Durable Object project**: `wrangler init canopy-api`
4. **Set up E2B account** (or Modal)
5. **Build simple flow**:
   - POST /features → Create Feature DO
   - POST /sessions → Spawn E2B sandbox → Start OpenCode
   - WS /features/:id → Real-time updates
6. **Test end-to-end**: User prompt → Agent response → Code change
7. **Deploy to Cloudflare**: `wrangler deploy`
8. **Validate**: Can you get a simple change merged?

**Time investment**: ~3-5 days for basic prototype

#### Option B: Traditional Stack (More Control)
1. **Set up PostgreSQL + Redis** (local or Railway)
2. **Create Node.js + Fastify API**
3. **Set up E2B account** (or Modal)
4. **Build OpenCode container image**
5. **Create simple API**: POST /sessions → spawn sandbox → run OpenCode
6. **Test end-to-end**: User prompt → Agent response → Code change
7. **Validate**: Can you get a simple change merged?

**Time investment**: ~5-7 days (more setup required)

### Then (Week 3-4)
1. **Add Features table and API**
2. **Implement shared context (Redis)**
3. **Build first custom plugin**: Feature Context
4. **Test**: Two sessions in same feature sharing learnings

### Finally (Week 5-8)
1. **Add multiplayer** (multiple users per session)
2. **Build web UI** (feature dashboard, session view)
3. **Add verification tools** (tests, types)
4. **Launch internally** (dogfood with your team)

### Goal
By end of 2 months: Working prototype with feature-based grouping, shared context, and basic multiplayer. This is enough to validate if the concept works and drives value.

**The key insight**: Feature-based grouping + shared context is your unique value prop. Focus on proving this drives better outcomes than single-session agents.

---

## Additional Resources

### OpenCode
- Docs: https://opencode.dev/docs
- GitHub: https://github.com/opencode-hq/opencode
- Discord: Join OpenCode community for support

### E2B
- Docs: https://e2b.dev/docs
- Examples: https://github.com/e2b-dev/examples
- Templates: Pre-built Node.js, Python environments

### Modal
- Docs: https://modal.com/docs
- Examples: https://github.com/modal-labs/modal-examples
- Guide: Container snapshots

### Cloudflare Durable Objects
- Docs: https://developers.cloudflare.com/durable-objects/
- Agents SDK: https://developers.cloudflare.com/agents/

### Architecture Patterns
- CQRS: https://martinfowler.com/bliki/CQRS.html
- Event Sourcing: https://martinfowler.com/eaaDev/EventSourcing.html
- Actor Model: https://www.brianstorti.com/the-actor-model/

---

---

## Final Architecture Summary (Incorporating Your Insights)

### The Winning Architecture: Cloudflare + MongoDB + E2B

Based on your excellent insights about Durable Objects and MongoDB:

```
┌────────────────────────────────────────────────────┐
│                 Client Layer                        │
│  Web (Cloudflare Pages) + Slack + Chrome Ext       │
└────────────────────────────────────────────────────┘
                        ↓
┌────────────────────────────────────────────────────┐
│              Cloudflare Workers                     │
│          (API Gateway + Router)                     │
└────────────────────────────────────────────────────┘
                        ↓
┌────────────────────────────────────────────────────┐
│       ONE Durable Object PER FEATURE               │
│                                                     │
│  ┌──────────────────────────────────────────┐     │
│  │  Feature "Add OAuth Authentication"      │     │
│  │                                           │     │
│  │  SQLite Tables:                           │     │
│  │  ├─ sessions (all 5 sessions)            │     │
│  │  ├─ context (learnings, decisions)       │     │
│  │  ├─ chat_messages (team discussion)      │     │
│  │  ├─ notes (collaborative docs)           │     │
│  │  └─ events (all session events)          │     │
│  │                                           │     │
│  │  WebSockets:                              │     │
│  │  ├─ All team members connected           │     │
│  │  ├─ See all sessions in feature          │     │
│  │  ├─ Chat in real-time                    │     │
│  │  └─ Collaborative notes                  │     │
│  │                                           │     │
│  │  Easy Cross-Session Queries:             │     │
│  │  SELECT * FROM sessions WHERE ...        │     │
│  │  SELECT * FROM context WHERE ...         │     │
│  └──────────────────────────────────────────┘     │
└────────────────────────────────────────────────────┘
                        ↓
         ┌──────────────┴──────────────┐
         ↓                              ↓
┌─────────────────┐          ┌──────────────────────┐
│  E2B/Modal      │          │  MongoDB Atlas       │
│  Sandboxes      │          │                      │
│                 │          │  Collections:        │
│  ┌───────────┐  │          │  ├─ features         │
│  │ Session 1 │  │          │  ├─ users            │
│  │ OpenCode  │  │          │  ├─ teams            │
│  └───────────┘  │          │  ├─ analytics        │
│  ┌───────────┐  │          │  └─ search_index    │
│  │ Session 2 │  │          │                      │
│  │ OpenCode  │  │          │  (Feature archive    │
│  └───────────┘  │          │   when completed)    │
│       ...       │          │                      │
└─────────────────┘          └──────────────────────┘
         ↓
┌─────────────────┐
│  Cloudflare R2  │
│  ├─ Snapshots   │
│  ├─ Screenshots │
│  └─ Artifacts   │
└─────────────────┘
```

### Why This Architecture Wins

**1. Durable Objects per Feature (Your Insight)**:
- ✅ All sessions in same SQLite = easy cross-session queries
- ✅ Natural place for team chat and notes
- ✅ WebSocket per feature = all team sees everything
- ✅ Simpler than DO per session
- ✅ Perfect for "feature grouping" vision

**2. MongoDB for Global Data (Your Insight)**:
- ✅ Schema flexibility (context structure will evolve)
- ✅ Hierarchical data natural fit
- ✅ Full-text search built-in
- ✅ Great for unstructured agent outputs
- ✅ Cheaper than vendor-specific DBs

**3. E2B/Modal for Sandboxes (Unavoidable)**:
- ❌ Cloudflare sandboxes don't support OpenCode
- ✅ E2B/Modal purpose-built for code execution
- ✅ Proven at scale

### Complete Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| **Frontend** | Cloudflare Pages + React | Edge hosting, fast |
| **API** | Cloudflare Workers | Serverless, edge |
| **Feature State** | Durable Objects (SQLite) | ONE per feature, real-time |
| **Global Data** | MongoDB Atlas | Flexible schema, search |
| **Sandboxes** | E2B or Modal | Only option for OpenCode |
| **Storage** | Cloudflare R2 | S3-compatible, cheap |
| **Real-time** | Agents SDK | WebSocket Hibernation |
| **Auth** | GitHub OAuth | User attribution |

### Data Flow

```
1. User creates feature → Feature DO created

2. User creates session →
   ├─ Recorded in Feature DO's SQLite
   └─ E2B sandbox spawned for OpenCode

3. User sends prompt →
   ├─ Forwarded to OpenCode in sandbox
   └─ Broadcast to all WebSocket clients (team members)

4. Agent discovers learning →
   ├─ Saved to Feature DO's context table
   └─ Broadcast to team (visible immediately)

5. Other session queries context →
   ├─ Simple SQLite query (same DB!)
   └─ Gets all learnings from sibling sessions

6. Team members chat →
   ├─ Messages saved to chat_messages table
   └─ Real-time via WebSockets

7. Feature completes →
   ├─ Feature DO data exported to MongoDB
   └─ Archived for search and analytics
```

### Cost Estimate (100 Features, 500 Sessions)

| Service | Cost/Month | Notes |
|---------|-----------|-------|
| Cloudflare Workers | $5 | Mostly free tier |
| Cloudflare Durable Objects | $15 | 100 DOs, light usage |
| MongoDB Atlas | $60 | M10 tier (10GB) |
| E2B Sandboxes | $1000 | Assuming 4hr avg |
| Cloudflare R2 | $5 | 100GB storage |
| **Total** | **$1085/month** | ~$2.17 per session |

### What You Get

**Collaboration Features** (enabled by DO per feature):
- [x] Team chat within feature
- [x] Collaborative notes
- [x] See all sessions in feature
- [x] Cross-session learnings visible
- [x] @mentions, reactions
- [x] Real-time presence (who's online)

**Developer Experience**:
- [x] Deploy in seconds (Wrangler)
- [x] No migrations (MongoDB)
- [x] TypeScript everywhere
- [x] Edge-native (low latency)

**Production Ready**:
- [x] Auto-scaling (Cloudflare + E2B)
- [x] Global distribution
- [x] Built-in monitoring
- [x] Cost-efficient

### What Makes This Different from Other Solutions

| Feature | Cursor/Claude | GitHub Copilot | **Canopy** |
|---------|---------------|----------------|------------|
| Multiplayer | ❌ | ❌ | ✅ Feature-level |
| Cross-session context | ❌ | ❌ | ✅ Automatic |
| Team chat | ❌ | ❌ | ✅ Built-in |
| Collaborative notes | ❌ | ❌ | ✅ Built-in |
| Sandboxed | ❌ Local | ✅ Cloud | ✅ Cloud |
| Concurrent sessions | ⚠️ Limited | ⚠️ Limited | ✅ Unlimited |
| Works from anywhere | ❌ | ⚠️ Partial | ✅ Yes |

---

## Next Actions

### Week 1: Proof of Concept
1. Create Cloudflare account
2. Build simple Feature DO:
   ```bash
   wrangler init canopy-poc
   # Add Durable Object
   # Test SQLite + WebSockets
   ```
3. Set up MongoDB Atlas (free tier)
4. Connect them together
5. Test: Create feature → Add session → Query context

### Week 2: E2B Integration
1. Set up E2B account
2. Build OpenCode container
3. Connect Feature DO → E2B sandbox
4. Test: Send prompt → OpenCode executes → Response back

### Week 3: Real Feature
1. Implement full Feature DO schema
2. Add custom OpenCode plugins
3. Build simple web UI
4. Test with real coding task

### Week 4: Polish & Deploy
1. Add team chat
2. Add collaborative notes
3. Deploy to Cloudflare
4. Invite team to test

**Goal**: Working prototype with feature grouping, cross-session context, and team collaboration in 4 weeks.

---

**Questions or Need Clarification?**

Based on your insights, here are some follow-up areas we can explore:

1. **Feature DO implementation guide**: Complete TypeScript code for Feature Durable Object?
2. **MongoDB schema design**: Detailed collections and indexes?
3. **E2B + OpenCode setup**: Step-by-step integration guide?
4. **Team chat implementation**: Real-time chat with @mentions, reactions?
5. **Collaborative notes**: CRDTs for conflict-free editing?
6. **Cost optimization**: Strategies to reduce E2B costs?
7. **Migration from Durable Objects**: If you need to scale beyond Cloudflare?

The architecture is now much stronger with:
- ✅ Durable Objects per Feature (not session)
- ✅ MongoDB for flexible global data
- ✅ E2B/Modal for sandboxes (Cloudflare can't do this)

Let me know what to dive into next!
