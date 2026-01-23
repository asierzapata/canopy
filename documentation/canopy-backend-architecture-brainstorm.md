# Canopy Backend Architecture

## 1. Overview & Inspiration

Canopy is a multiplayer coding agent platform enabling teams to collaborate on AI-assisted development sessions. It allows multiple developers to join a session, observe real-time agent actions, and guide the work via prompts.

**Inspiration**: This architecture is heavily influenced by Ramp's "Inspect" system, which achieved 30% of all merged PRs being written by their background agent.

**Key Learnings Applied:**

- **Multiplayer is Mission-Critical**: Collaboration is the default, not an addon.
- **Fast Session Startup**: Waiting for containers kills adoption. We use warm pools/snapshots.
- **Full Dev Environment**: The agent needs a real shell, git, and LSP, not just a text generator.
- **Attribution**: Every prompt and git commit is linked to a specific human user for auditability.

---

## 2. Core Architecture: Cloudflare + OpenCode

We utilize a **Cloudflare-native** stack for coordination and **Sandboxes** for heavy compute.

### High-Level Topology

```mermaid
graph TD
    Client[Web/Desktop Clients] <-->|WebSocket| Edge[Cloudflare Edge]
    Edge -->|Route| DO[Durable Object (Session Host)]
    DO <-->|HTTP/SSE| Sandbox[Cloudflare/Modal Sandbox]
    Sandbox -->|Read/Write| R2[R2 Storage (Workspace)]
    Edge -->|Read/Write| Mongo[MongoDB Atlas (Knowledge Base)]
```

### Component Deep Dive

#### 1. Coordination Layer: Cloudflare Durable Objects (DO)

The DO acts as the "Server" for a single session.

- **Role**: Single source of truth for session state.
- **Why DOs?**:
  - **Isolation**: One DO per session ensures performance isolation.
  - **WebSocket Hibernation**: Handles thousands of idle connections cheaply.
  - **State**: Embedded SQLite stores message history and queue state instantly.

#### 2. Knowledge Layer: MongoDB Atlas

MongoDB acts as the persistent store for **Features** and **Context**.

- **Role**: Stores Feature documents, shared learnings, and performs Vector Search.
- **Why MongoDB?**:
  - **Document Model**: Perfect for storing the nested, unstructured data of "Feature Context" (decisions, code snippets, notes).
  - **Vector Search**: Enables the "Context Inheritance" system. When a new session starts, we query MongoDB for semantically similar learnings from past sessions to prime the agent.

#### 3. Execution Layer: Sandboxes & OpenCode

The heavy lifting happens in isolated micro-VMs.

- **Runtime**: `opencode serve` runs inside the sandbox, exposing an HTTP API.
- **Persistence**: Workspaces are backed by R2. On startup, the sandbox mounts or clones the repo.
- **Security**: Agents run in full isolation; they cannot access other sessions or the host.

---

## 3. The "Feature" Abstraction

Canopy differentiates itself by grouping sessions into **Features** rather than treating them as isolated chats.

### The Concept

A **Feature** (e.g., "Add OAuth Support") is the parent container.

- **Shared Context**: All sessions within a feature share "Learnings" (e.g., "We decided to use Passport.js").
- **Parallelism**:
  - _Session A_: "Update the backend API" (Running)
  - _Session B_: "Build the login UI" (Running)
  - _Session C_: "Write docs" (Pending)

### Context Inheritance

When a new session starts within a Feature:

1.  It inherits the **Repository State** (branch/commit).
2.  It ingests **Shared Learnings** from sibling sessions (reducing "amnesia").
3.  It updates the Feature's global context upon completion.

---

## 4. Data Models

### Feature Model

Tracks the high-level goal and shared knowledge.

```json
{
	"feature_id": "uuid",
	"title": "Add OAuth authentication",
	"status": "in_progress",
	"shared_context": {
		"decisions": [{ "decision": "Use Passport.js", "made_by": "session_1" }],
		"key_files": ["src/auth.ts"]
	},
	"sessions": ["session_1", "session_2"]
}
```

### Session Model (Stored in Durable Object)

Represents a single collaborative coding thread.

```json
{
	"session_id": "uuid",
	"feature_id": "uuid",
	"status": "active",
	"participants": [
		{
			"user_id": "u1",
			"role": "owner",
			"cursor": { "file": "index.ts", "line": 10 }
		}
	],
	"prompt_queue": [
		{ "id": "p1", "user_id": "u2", "content": "Fix the type error in auth.ts" }
	],
	"sandbox_config": {
		"image": "node-20",
		"repo": "github.com/org/repo"
	}
}
```

### Prompt Model

Crucial for queue management and attribution.

```json
{
	"prompt_id": "uuid",
	"user_id": "uuid",
	"content": "Refactor the login handler",
	"status": "queued|running|completed",
	"attribution": {
		"git_author": "User Name <user@email.com>"
	}
}
```

---

## 5. Critical Workflows

### Prompt Execution Flow

1.  **Queue**: User submits prompt → DO adds to FIFO queue.
2.  **Lock**: DO processes head of queue → Acquires "Prompt Lock".
3.  **Execute**: DO sends prompt to OpenCode Sandbox via HTTP.
4.  **Stream**: OpenCode streams tool execution events (logs, file edits).
5.  **Broadcast**: DO forwards events to all connected WebSockets.
6.  **Complete**: OpenCode finishes → DO releases lock → Next prompt starts.

### Multiplayer Sync

- **State**: Participant list, cursor positions, and queue state are synced 1:1 via WebSockets.
- **File Sync**: When the agent edits a file, the "File Change" event is broadcast, triggering a refresh on all clients.

---

## 6. Integration Strategy

We treat OpenCode as a **subprocess** governed by the Durable Object.

- **Communication**: The DO talks to the Sandbox via HTTP (Control Plane).
- **Events**: The Sandbox streams logic/execution events back to the DO.
- **Storage**: Both read/write to the same underlying R2/Git source of truth.

This separation allows the "Brain" (Cloudflare DO) to remain lightweight and highly responsive, while the "Body" (Sandbox) handles the heavy compilation and execution tasks.
