# Canopy Cloud: Multiplayer OpenCode on Cloudflare

## Technical Specification v1.0

---

## 1. Overview

Canopy Cloud is a collaborative coding agent platform that enables multiple developers to share a single OpenCode session in real-time. Built entirely on Cloudflare's edge infrastructure, it provides isolated sandbox environments for AI-powered code generation with multiplayer collaboration.

### 1.1 Key Features

- **Multiplayer Sessions**: Multiple developers can join the same session and observe/interact with the AI agent
- **Prompt Ownership**: Each prompt is attributed to the developer who sent it
- **Sequential Execution**: One prompt runs at a time with queue management
- **GitHub Integration**: OAuth authentication + PR creation on behalf of users
- **Persistent Storage**: R2-backed storage survives sandbox restarts
- **Real-time Sync**: All session state synchronized across connected clients

### 1.2 Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                                   │
│  │ Browser  │  │ Browser  │  │ Desktop  │                                   │
│  │ (React)  │  │ (React)  │  │   App    │                                   │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                                   │
│       │             │             │                                          │
│       └─────────────┼─────────────┘                                          │
│                     │ WebSocket (useAgent hook)                              │
└─────────────────────┼───────────────────────────────────────────────────────┘
                      ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CLOUDFLARE WORKERS                                    │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                     Hono Router (Edge Worker)                        │    │
│  │  • GitHub OAuth flow                                                 │    │
│  │  • Session management API                                            │    │
│  │  • WebSocket upgrade → Agent routing                                 │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │              SessionAgent (Durable Object / Agents SDK)              │    │
│  │  • Multiplayer state synchronization                                 │    │
│  │  • Prompt queue management                                           │    │
│  │  • Message history (SQL)                                             │    │
│  │  • Connected users tracking                                          │    │
│  │  • Sandbox lifecycle coordination                                    │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                    │                                         │
│                                    ▼                                         │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │                    Cloudflare Sandbox                                │    │
│  │  ┌───────────────────────────────────────────────────────────────┐  │    │
│  │  │  opencode serve --port 8080 --hostname 0.0.0.0                │  │    │
│  │  │  • Full OpenCode HTTP API                                      │  │    │
│  │  │  • SSE events stream                                           │  │    │
│  │  │  • File operations                                             │  │    │
│  │  └───────────────────────────────────────────────────────────────┘  │    │
│  │  ┌───────────────────────────────────────────────────────────────┐  │    │
│  │  │  /workspace (R2 Mount)                                        │  │    │
│  │  │  • Persistent project files                                    │  │    │
│  │  │  • Survives sandbox restarts                                   │  │    │
│  │  └───────────────────────────────────────────────────────────────┘  │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
└──────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLOUDFLARE STORAGE                                 │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐                 │
│  │       R2       │  │       KV       │  │       D1       │                 │
│  │ Project Files  │  │ Session Index  │  │  User Profiles │                 │
│  │ (per session)  │  │ User Sessions  │  │  Audit Logs    │                 │
│  └────────────────┘  └────────────────┘  └────────────────┘                 │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Data Models

### 2.1 Core Types

```typescript
// ============================================================================
// USER & AUTH
// ============================================================================

interface User {
  id: string; // UUID
  githubId: number; // GitHub user ID
  githubUsername: string; // GitHub username
  email: string;
  avatarUrl: string;
  accessToken: string; // Encrypted GitHub OAuth token
  createdAt: Date;
  lastSeenAt: Date;
}

interface UserSession {
  userId: string;
  sessionToken: string; // Random token stored in cookie
  expiresAt: Date;
}

// ============================================================================
// COLLABORATION SESSION
// ============================================================================

interface Session {
  id: string; // UUID - also used as Durable Object name
  name: string; // Human-readable session name
  ownerId: string; // User who created the session
  projectSource: ProjectSource; // Where the project came from
  status: SessionStatus;
  createdAt: Date;
  updatedAt: Date;

  // Collaboration settings
  visibility: "private" | "team" | "public";
  allowedUsers: string[]; // User IDs allowed to join (if private)

  // Sandbox state
  sandboxStatus: SandboxStatus;
  r2BucketPath: string; // Path in R2 for this session's files
}

type SessionStatus = "active" | "paused" | "archived";

type SandboxStatus =
  | "not_started"
  | "starting"
  | "ready"
  | "busy" // Currently executing a prompt
  | "error"
  | "stopped";

interface ProjectSource {
  type: "github" | "upload" | "empty";
  // For GitHub repos
  repoOwner?: string;
  repoName?: string;
  branch?: string;
  // For uploads
  uploadId?: string;
}

// ============================================================================
// REAL-TIME COLLABORATION STATE (Synced via Agents SDK)
// ============================================================================

interface SessionState {
  // Connected users
  participants: Participant[];

  // Prompt execution state
  promptLock: PromptLock | null;
  promptQueue: QueuedPrompt[];

  // OpenCode session info
  openCodeSessionId: string | null;

  // Conversation so far
  conversation: SessionMessage[];

  // Sandbox health
  sandboxStatus: SandboxStatus;
  lastHealthCheck: Date;
}

interface Participant {
  odUserId: string;
  user: {
    id: string;
    githubUsername: string;
    avatarUrl: string;
  };
  connectionId: string;
  joinedAt: Date;
  cursorPosition?: CursorPosition; // For future: collaborative cursors
  isActive: boolean;
}

interface PromptLock {
  heldBy: {
    userId: string;
    githubUsername: string;
  };
  promptId: string;
  acquiredAt: Date;
  prompt: string; // The prompt being executed
}

interface QueuedPrompt {
  id: string;
  userId: string;
  githubUsername: string;
  prompt: string;
  queuedAt: Date;
}

// ============================================================================
// MESSAGES & HISTORY
// ============================================================================

interface SessionMessage {
  id: string;
  sessionId: string;

  // Ownership
  userId: string;
  githubUsername: string;

  // Content
  role: "user" | "assistant" | "system";
  content: string;

  // For assistant messages: parts from OpenCode
  parts?: OpenCodePart[];

  // Metadata
  createdAt: Date;
  openCodeMessageId?: string; // Reference to OpenCode's message ID

  // Execution metadata (for user prompts)
  executionStartedAt?: Date;
  executionCompletedAt?: Date;
  executionStatus?: "pending" | "running" | "completed" | "failed" | "aborted";
}

// Subset of OpenCode Part type for relevant info
interface OpenCodePart {
  type: "text" | "tool-invocation" | "tool-result" | "file" | "step-start";
  // ... additional fields based on type
}

// ============================================================================
// EVENTS (WebSocket messages between Agent and Clients)
// ============================================================================

type ClientToAgentEvent =
  | { type: "prompt.send"; prompt: string }
  | { type: "prompt.queue"; prompt: string }
  | { type: "prompt.abort" }
  | { type: "prompt.dequeue"; promptId: string }
  | { type: "cursor.update"; position: CursorPosition }
  | { type: "file.open"; path: string }
  | { type: "session.leave" };

type AgentToClientEvent =
  | { type: "state.sync"; state: SessionState }
  | { type: "participant.joined"; participant: Participant }
  | { type: "participant.left"; odUserId: string }
  | { type: "prompt.locked"; lock: PromptLock }
  | { type: "prompt.unlocked" }
  | { type: "prompt.queued"; queuedPrompt: QueuedPrompt }
  | { type: "prompt.dequeued"; promptId: string }
  | { type: "message.new"; message: SessionMessage }
  | {
      type: "message.update";
      messageId: string;
      updates: Partial<SessionMessage>;
    }
  | { type: "message.stream"; messageId: string; chunk: string }
  | { type: "sandbox.status"; status: SandboxStatus }
  | { type: "error"; code: string; message: string };

interface CursorPosition {
  file: string;
  line: number;
  column: number;
}
```

### 2.2 Database Schemas

#### D1 (SQLite) - User Data & Session Metadata

```sql
-- Users table
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  github_id INTEGER UNIQUE NOT NULL,
  github_username TEXT NOT NULL,
  email TEXT,
  avatar_url TEXT,
  access_token_encrypted TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_seen_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_github_id ON users(github_id);

-- User sessions (auth tokens)
CREATE TABLE user_sessions (
  session_token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);

-- Collaboration sessions metadata
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users(id),
  project_source_type TEXT NOT NULL,
  project_source_data TEXT,  -- JSON
  status TEXT DEFAULT 'active',
  visibility TEXT DEFAULT 'private',
  r2_bucket_path TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sessions_owner ON sessions(owner_id);
CREATE INDEX idx_sessions_status ON sessions(status);

-- Session access control
CREATE TABLE session_access (
  session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'collaborator',  -- 'owner', 'collaborator', 'viewer'
  granted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (session_id, user_id)
);

-- Audit log
CREATE TABLE audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT REFERENCES sessions(id),
  user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  details TEXT,  -- JSON
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_session ON audit_log(session_id);
CREATE INDEX idx_audit_user ON audit_log(user_id);
```

#### SessionAgent SQL (Durable Object embedded SQLite)

```sql
-- Message history within the session
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  github_username TEXT NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  parts TEXT,  -- JSON serialized OpenCode parts
  opencode_message_id TEXT,
  execution_status TEXT,
  execution_started_at DATETIME,
  execution_completed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at);

-- File snapshots (for undo/time-travel)
CREATE TABLE IF NOT EXISTS file_snapshots (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  message_id TEXT REFERENCES messages(id),
  file_path TEXT NOT NULL,
  content_hash TEXT NOT NULL,  -- SHA256 of content stored in R2
  operation TEXT NOT NULL,     -- 'create', 'modify', 'delete'
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_snapshots_message ON file_snapshots(message_id);
```

---

## 3. Component Specifications

### 3.1 Hono Router (Edge Worker)

The main entry point for all HTTP requests. Handles auth flows, API endpoints, and WebSocket upgrades.

```typescript
// src/index.ts
import { Hono } from "hono";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { secureHeaders } from "hono/secure-headers";
import { routeAgentRequest } from "agents";

import { authMiddleware } from "./middleware/auth";
import { authRoutes } from "./routes/auth";
import { sessionRoutes } from "./routes/sessions";
import { webhookRoutes } from "./routes/webhooks";

// Type definitions
interface Env {
  // Durable Objects
  SESSION_AGENT: DurableObjectNamespace;

  // Storage
  DB: D1Database;
  KV: KVNamespace;
  R2: R2Bucket;

  // Sandbox
  SANDBOX: any; // Cloudflare Sandbox binding

  // Secrets
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
  SESSION_SECRET: string;
  ENCRYPTION_KEY: string;
}

type Variables = {
  user: User | null;
  sessionToken: string | null;
};

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Global middleware
app.use(
  "*",
  cors({
    origin: ["https://canopy.dev", "http://localhost:3000"],
    credentials: true,
  }),
);
app.use("*", secureHeaders());
app.use("*", csrf({ origin: ["https://canopy.dev", "http://localhost:3000"] }));

// Auth middleware (sets c.var.user)
app.use("/api/*", authMiddleware);

// Routes
app.route("/auth", authRoutes);
app.route("/api/sessions", sessionRoutes);
app.route("/webhooks", webhookRoutes);

// Health check
app.get("/health", (c) =>
  c.json({ status: "ok", timestamp: new Date().toISOString() }),
);

// Agent WebSocket routing (Agents SDK pattern)
// Clients connect to: /agents/session/:sessionId
app.all("/agents/*", async (c) => {
  // Verify auth for WebSocket connections
  const user = c.var.user;
  if (!user) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  // Route to the appropriate SessionAgent
  return routeAgentRequest(c.req.raw, c.env);
});

export default app;

// Export the SessionAgent class for Durable Objects binding
export { SessionAgent } from "./agents/session-agent";
```

### 3.2 GitHub OAuth Routes

```typescript
// src/routes/auth.ts
import { Hono } from "hono";
import { setCookie, getCookie, deleteCookie } from "hono/cookie";

const authRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Initiate GitHub OAuth
authRoutes.get("/github", async (c) => {
  const state = crypto.randomUUID();

  // Store state in KV with 10 min expiry
  await c.env.KV.put(`oauth_state:${state}`, "1", { expirationTtl: 600 });

  const params = new URLSearchParams({
    client_id: c.env.GITHUB_CLIENT_ID,
    redirect_uri: `${new URL(c.req.url).origin}/auth/github/callback`,
    scope: "user:email repo", // repo scope for PR creation
    state,
  });

  return c.redirect(`https://github.com/login/oauth/authorize?${params}`);
});

// GitHub OAuth callback
authRoutes.get("/github/callback", async (c) => {
  const { code, state } = c.req.query();

  // Verify state
  const storedState = await c.env.KV.get(`oauth_state:${state}`);
  if (!storedState) {
    return c.json({ error: "Invalid state" }, 400);
  }
  await c.env.KV.delete(`oauth_state:${state}`);

  // Exchange code for access token
  const tokenResponse = await fetch(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: c.env.GITHUB_CLIENT_ID,
        client_secret: c.env.GITHUB_CLIENT_SECRET,
        code,
      }),
    },
  );

  const tokenData = (await tokenResponse.json()) as { access_token: string };

  // Fetch GitHub user profile
  const userResponse = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "Canopy-Cloud",
    },
  });

  const githubUser = (await userResponse.json()) as {
    id: number;
    login: string;
    email: string;
    avatar_url: string;
  };

  // Upsert user in D1
  const userId = crypto.randomUUID();
  const encryptedToken = await encryptToken(
    tokenData.access_token,
    c.env.ENCRYPTION_KEY,
  );

  await c.env.DB.prepare(
    `
    INSERT INTO users (id, github_id, github_username, email, avatar_url, access_token_encrypted)
    VALUES (?, ?, ?, ?, ?, ?)
    ON CONFLICT(github_id) DO UPDATE SET
      github_username = excluded.github_username,
      email = excluded.email,
      avatar_url = excluded.avatar_url,
      access_token_encrypted = excluded.access_token_encrypted,
      last_seen_at = CURRENT_TIMESTAMP
  `,
  )
    .bind(
      userId,
      githubUser.id,
      githubUser.login,
      githubUser.email,
      githubUser.avatar_url,
      encryptedToken,
    )
    .run();

  // Get the actual user ID (might be existing user)
  const user = await c.env.DB.prepare(
    "SELECT id FROM users WHERE github_id = ?",
  )
    .bind(githubUser.id)
    .first<{ id: string }>();

  // Create session token
  const sessionToken = crypto.randomUUID();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  await c.env.DB.prepare(
    `
    INSERT INTO user_sessions (session_token, user_id, expires_at)
    VALUES (?, ?, ?)
  `,
  )
    .bind(sessionToken, user!.id, expiresAt.toISOString())
    .run();

  // Set cookie
  setCookie(c, "session", sessionToken, {
    httpOnly: true,
    secure: true,
    sameSite: "Lax",
    path: "/",
    expires: expiresAt,
  });

  // Redirect to app
  return c.redirect("/dashboard");
});

// Logout
authRoutes.post("/logout", async (c) => {
  const sessionToken = getCookie(c, "session");

  if (sessionToken) {
    await c.env.DB.prepare("DELETE FROM user_sessions WHERE session_token = ?")
      .bind(sessionToken)
      .run();
  }

  deleteCookie(c, "session");
  return c.json({ success: true });
});

// Get current user
authRoutes.get("/me", async (c) => {
  const user = c.var.user;
  if (!user) {
    return c.json({ user: null });
  }

  // Don't expose sensitive fields
  const { accessToken, ...safeUser } = user;
  return c.json({ user: safeUser });
});

export { authRoutes };
```

### 3.3 Session Routes

```typescript
// src/routes/sessions.ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { z } from "zod";

const sessionRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

// Create session schema
const createSessionSchema = z.object({
  name: z.string().min(1).max(100),
  projectSource: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("github"),
      repoOwner: z.string(),
      repoName: z.string(),
      branch: z.string().optional(),
    }),
    z.object({
      type: z.literal("empty"),
    }),
  ]),
  visibility: z.enum(["private", "team", "public"]).default("private"),
});

// List user's sessions
sessionRoutes.get("/", async (c) => {
  const user = c.var.user;
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const sessions = await c.env.DB.prepare(
    `
    SELECT s.*,
           (SELECT COUNT(*) FROM session_access WHERE session_id = s.id) as collaborator_count
    FROM sessions s
    LEFT JOIN session_access sa ON s.id = sa.session_id AND sa.user_id = ?
    WHERE s.owner_id = ? OR sa.user_id = ?
    ORDER BY s.updated_at DESC
  `,
  )
    .bind(user.id, user.id, user.id)
    .all();

  return c.json({ sessions: sessions.results });
});

// Create new session
sessionRoutes.post("/", zValidator("json", createSessionSchema), async (c) => {
  const user = c.var.user;
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const body = c.req.valid("json");
  const sessionId = crypto.randomUUID();
  const r2BucketPath = `sessions/${sessionId}`;

  // Create session in D1
  await c.env.DB.prepare(
    `
    INSERT INTO sessions (id, name, owner_id, project_source_type, project_source_data, visibility, r2_bucket_path)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
  )
    .bind(
      sessionId,
      body.name,
      user.id,
      body.projectSource.type,
      JSON.stringify(body.projectSource),
      body.visibility,
      r2BucketPath,
    )
    .run();

  // Add owner to session_access
  await c.env.DB.prepare(
    `
    INSERT INTO session_access (session_id, user_id, role)
    VALUES (?, ?, 'owner')
  `,
  )
    .bind(sessionId, user.id)
    .run();

  // If GitHub project, queue cloning (could be done via Workflow)
  if (body.projectSource.type === "github") {
    // Initialize sandbox and clone repo
    // This could be async via Cloudflare Workflows
    await initializeGitHubProject(c.env, sessionId, body.projectSource, user);
  }

  // Audit log
  await c.env.DB.prepare(
    `
    INSERT INTO audit_log (session_id, user_id, action, details)
    VALUES (?, ?, 'session.created', ?)
  `,
  )
    .bind(sessionId, user.id, JSON.stringify(body))
    .run();

  return c.json(
    {
      session: {
        id: sessionId,
        name: body.name,
        wsUrl: `/agents/session/${sessionId}`,
      },
    },
    201,
  );
});

// Get session details
sessionRoutes.get("/:sessionId", async (c) => {
  const user = c.var.user;
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const { sessionId } = c.req.param();

  // Check access
  const access = await c.env.DB.prepare(
    `
    SELECT s.*, sa.role
    FROM sessions s
    LEFT JOIN session_access sa ON s.id = sa.session_id AND sa.user_id = ?
    WHERE s.id = ? AND (s.owner_id = ? OR sa.user_id = ? OR s.visibility = 'public')
  `,
  )
    .bind(user.id, sessionId, user.id, user.id)
    .first();

  if (!access) {
    return c.json({ error: "Session not found or access denied" }, 404);
  }

  return c.json({ session: access });
});

// Invite user to session
sessionRoutes.post("/:sessionId/invite", async (c) => {
  const user = c.var.user;
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const { sessionId } = c.req.param();
  const { githubUsername, role = "collaborator" } = await c.req.json();

  // Verify ownership
  const session = await c.env.DB.prepare(
    "SELECT * FROM sessions WHERE id = ? AND owner_id = ?",
  )
    .bind(sessionId, user.id)
    .first();

  if (!session) {
    return c.json({ error: "Not authorized to invite" }, 403);
  }

  // Find or create invited user
  let invitedUser = await c.env.DB.prepare(
    "SELECT id FROM users WHERE github_username = ?",
  )
    .bind(githubUsername)
    .first<{ id: string }>();

  if (!invitedUser) {
    // User hasn't signed up yet - store pending invite
    await c.env.KV.put(
      `pending_invite:${githubUsername}:${sessionId}`,
      JSON.stringify({ role, invitedBy: user.id }),
      { expirationTtl: 30 * 24 * 60 * 60 }, // 30 days
    );
    return c.json({
      status: "pending",
      message: "User will be added when they sign up",
    });
  }

  // Add to session_access
  await c.env.DB.prepare(
    `
    INSERT INTO session_access (session_id, user_id, role)
    VALUES (?, ?, ?)
    ON CONFLICT(session_id, user_id) DO UPDATE SET role = excluded.role
  `,
  )
    .bind(sessionId, invitedUser.id, role)
    .run();

  return c.json({ status: "added" });
});

export { sessionRoutes };
```

### 3.4 SessionAgent (Durable Object with Agents SDK)

The core multiplayer coordination layer:

```typescript
// src/agents/session-agent.ts
import {
  Agent,
  Connection,
  ConnectionContext,
  WSMessage,
  callable,
} from "agents";
import { getSandbox } from "@cloudflare/sandbox";

// Re-export for wrangler binding
export { Sandbox } from "@cloudflare/sandbox";

interface Env {
  DB: D1Database;
  R2: R2Bucket;
  SANDBOX: any;
}

interface ConnectionState {
  userId: string;
  githubUsername: string;
  avatarUrl: string;
}

export class SessionAgent extends Agent<Env, SessionState> {
  // Initial state for new sessions
  initialState: SessionState = {
    participants: [],
    promptLock: null,
    promptQueue: [],
    openCodeSessionId: null,
    recentMessages: [],
    sandboxStatus: "not_started",
    lastHealthCheck: new Date(),
  };

  private sandbox: any = null;
  private eventSourceController: AbortController | null = null;

  // =========================================================================
  // LIFECYCLE
  // =========================================================================

  async onStart() {
    // Initialize database tables
    this.sql`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        github_username TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        parts TEXT,
        opencode_message_id TEXT,
        execution_status TEXT,
        execution_started_at DATETIME,
        execution_completed_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    this.sql`
      CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at)
    `;
  }

  // =========================================================================
  // WEBSOCKET HANDLERS
  // =========================================================================

  async onConnect(connection: Connection, ctx: ConnectionContext) {
    // Extract user info from request (set by auth middleware)
    const url = new URL(ctx.request.url);
    const userId = url.searchParams.get("userId");
    const githubUsername = url.searchParams.get("username");
    const avatarUrl = url.searchParams.get("avatar");

    if (!userId || !githubUsername) {
      connection.close(4001, "Missing user info");
      return;
    }

    // Store connection state
    connection.setState({
      userId,
      githubUsername,
      avatarUrl: avatarUrl || "",
    } as ConnectionState);

    // Add to participants
    const participant: Participant = {
      odUserId: connection.id,
      user: { id: userId, githubUsername, avatarUrl: avatarUrl || "" },
      connectionId: connection.id,
      joinedAt: new Date(),
      isActive: true,
    };

    const updatedParticipants = [...this.state.participants, participant];
    this.setState({ ...this.state, participants: updatedParticipants });

    // Broadcast join to others
    this.broadcastExcept(connection.id, {
      type: "participant.joined",
      participant,
    });

    // Send current state to new connection
    connection.send(
      JSON.stringify({
        type: "state.sync",
        state: this.state,
      }),
    );

    // Load recent message history
    const messages = this.sql<SessionMessage>`
      SELECT * FROM messages ORDER BY created_at DESC LIMIT 100
    `;

    connection.send(
      JSON.stringify({
        type: "history.sync",
        messages: messages.reverse(),
      }),
    );

    console.log(`User ${githubUsername} joined session`);
  }

  async onMessage(connection: Connection, message: WSMessage) {
    if (typeof message !== "string") return;

    const connState = connection.state as ConnectionState;
    const event = JSON.parse(message) as ClientToAgentEvent;

    switch (event.type) {
      case "prompt.send":
        await this.handlePromptSend(connection, connState, event.prompt);
        break;

      case "prompt.queue":
        await this.handlePromptQueue(connection, connState, event.prompt);
        break;

      case "prompt.abort":
        await this.handlePromptAbort(connection, connState);
        break;

      case "prompt.dequeue":
        await this.handlePromptDequeue(connection, connState, event.promptId);
        break;

      case "session.leave":
        await this.handleLeave(connection);
        break;
    }
  }

  async onClose(connection: Connection) {
    await this.handleLeave(connection);
  }

  async onError(connection: Connection, error: unknown) {
    console.error(`WebSocket error for ${connection.id}:`, error);
  }

  // =========================================================================
  // PROMPT HANDLING
  // =========================================================================

  private async handlePromptSend(
    connection: Connection,
    connState: ConnectionState,
    prompt: string,
  ) {
    // Check if prompt lock is available
    if (this.state.promptLock) {
      // Queue instead
      await this.handlePromptQueue(connection, connState, prompt);
      return;
    }

    // Acquire lock
    const promptId = crypto.randomUUID();
    const lock: PromptLock = {
      heldBy: {
        userId: connState.userId,
        githubUsername: connState.githubUsername,
      },
      promptId,
      acquiredAt: new Date(),
      prompt,
    };

    this.setState({ ...this.state, promptLock: lock, sandboxStatus: "busy" });

    // Broadcast lock acquisition
    this.broadcast({ type: "prompt.locked", lock });

    // Store user message
    const userMessageId = crypto.randomUUID();
    this.sql`
      INSERT INTO messages (id, user_id, github_username, role, content, execution_status)
      VALUES (${userMessageId}, ${connState.userId}, ${connState.githubUsername}, 'user', ${prompt}, 'running')
    `;

    // Broadcast user message
    const userMessage: SessionMessage = {
      id: userMessageId,
      sessionId: this.ctx.id.toString(),
      userId: connState.userId,
      githubUsername: connState.githubUsername,
      role: "user",
      content: prompt,
      createdAt: new Date(),
      executionStatus: "running",
      executionStartedAt: new Date(),
    };

    this.broadcast({ type: "message.new", message: userMessage });

    // Ensure sandbox is running
    await this.ensureSandboxRunning();

    // Send prompt to OpenCode
    try {
      await this.executePrompt(promptId, userMessageId, prompt, connState);
    } catch (error) {
      console.error("Prompt execution failed:", error);

      // Update message status
      this.sql`
        UPDATE messages SET execution_status = 'failed', execution_completed_at = ${new Date().toISOString()}
        WHERE id = ${userMessageId}
      `;

      this.broadcast({
        type: "message.update",
        messageId: userMessageId,
        updates: { executionStatus: "failed" },
      });

      // Release lock
      this.releaseLock();
    }
  }

  private async handlePromptQueue(
    connection: Connection,
    connState: ConnectionState,
    prompt: string,
  ) {
    const queuedPrompt: QueuedPrompt = {
      id: crypto.randomUUID(),
      userId: connState.userId,
      githubUsername: connState.githubUsername,
      prompt,
      queuedAt: new Date(),
    };

    const updatedQueue = [...this.state.promptQueue, queuedPrompt];
    this.setState({ ...this.state, promptQueue: updatedQueue });

    this.broadcast({ type: "prompt.queued", queuedPrompt });

    // Notify the user who queued
    connection.send(
      JSON.stringify({
        type: "prompt.queued.ack",
        position: updatedQueue.length,
        promptId: queuedPrompt.id,
      }),
    );
  }

  private async handlePromptAbort(
    connection: Connection,
    connState: ConnectionState,
  ) {
    const lock = this.state.promptLock;

    // Only the lock holder can abort
    if (!lock || lock.heldBy.userId !== connState.userId) {
      connection.send(
        JSON.stringify({
          type: "error",
          code: "NOT_LOCK_HOLDER",
          message: "You cannot abort a prompt you did not initiate",
        }),
      );
      return;
    }

    // Send abort to OpenCode
    await this.abortOpenCodeSession();

    // Release lock
    this.releaseLock();
  }

  private async handlePromptDequeue(
    connection: Connection,
    connState: ConnectionState,
    promptId: string,
  ) {
    const queuedPrompt = this.state.promptQueue.find((p) => p.id === promptId);

    // Only the user who queued can dequeue
    if (!queuedPrompt || queuedPrompt.userId !== connState.userId) {
      connection.send(
        JSON.stringify({
          type: "error",
          code: "NOT_QUEUE_OWNER",
          message: "You cannot dequeue a prompt you did not queue",
        }),
      );
      return;
    }

    const updatedQueue = this.state.promptQueue.filter(
      (p) => p.id !== promptId,
    );
    this.setState({ ...this.state, promptQueue: updatedQueue });

    this.broadcast({ type: "prompt.dequeued", promptId });
  }

  private releaseLock() {
    this.setState({ ...this.state, promptLock: null, sandboxStatus: "ready" });
    this.broadcast({ type: "prompt.unlocked" });

    // Process next in queue
    this.processQueue();
  }

  private async processQueue() {
    if (this.state.promptQueue.length === 0) return;
    if (this.state.promptLock) return; // Already processing

    const next = this.state.promptQueue[0];
    const updatedQueue = this.state.promptQueue.slice(1);
    this.setState({ ...this.state, promptQueue: updatedQueue });

    // Find the connection for this user
    const participant = this.state.participants.find(
      (p) => p.user.id === next.userId,
    );

    if (participant) {
      // User is still connected, execute their prompt
      const connState: ConnectionState = {
        userId: next.userId,
        githubUsername: next.githubUsername,
        avatarUrl: participant.user.avatarUrl,
      };

      // Re-use handlePromptSend logic (it will acquire lock)
      await this.handlePromptSend(
        { id: participant.connectionId } as Connection,
        connState,
        next.prompt,
      );
    }
  }

  // =========================================================================
  // SANDBOX MANAGEMENT
  // =========================================================================

  private async ensureSandboxRunning() {
    if (
      this.state.sandboxStatus === "ready" ||
      this.state.sandboxStatus === "busy"
    ) {
      return;
    }

    this.setState({ ...this.state, sandboxStatus: "starting" });
    this.broadcast({ type: "sandbox.status", status: "starting" });

    // Get sandbox instance
    const sessionId = this.ctx.id.toString();
    this.sandbox = getSandbox(this.env.SANDBOX, `session-${sessionId}`);

    // Check if OpenCode server is already running
    const healthCheck = await this.sandbox.exec(
      'curl -sf http://localhost:8080/global/health || echo "not_running"',
    );

    if (healthCheck.stdout.includes("not_running")) {
      // Start OpenCode server
      await this.sandbox.startProcess(
        "opencode serve --port 8080 --hostname 0.0.0.0",
        { cwd: "/workspace" },
      );

      // Wait for server to be ready
      for (let i = 0; i < 30; i++) {
        await new Promise((r) => setTimeout(r, 1000));
        const check = await this.sandbox.exec(
          "curl -sf http://localhost:8080/global/health",
        );
        if (check.exitCode === 0) break;
      }

      // Create OpenCode session
      const createSession = await this.sandbox.exec(`
        curl -X POST http://localhost:8080/session \\
          -H "Content-Type: application/json" \\
          -d '{"title": "Canopy Session"}'
      `);

      const sessionData = JSON.parse(createSession.stdout);
      this.setState({
        ...this.state,
        openCodeSessionId: sessionData.session_id,
        sandboxStatus: "ready",
      });
    } else {
      this.setState({ ...this.state, sandboxStatus: "ready" });
    }

    this.broadcast({ type: "sandbox.status", status: "ready" });

    // Start SSE listener for OpenCode events
    this.startOpenCodeEventListener();
  }

  private async executePrompt(
    promptId: string,
    userMessageId: string,
    prompt: string,
    connState: ConnectionState,
  ) {
    const openCodeSessionId = this.state.openCodeSessionId;
    if (!openCodeSessionId) throw new Error("No OpenCode session");

    // Send prompt to OpenCode (async, will stream responses via SSE)
    const result = await this.sandbox.exec(`
      curl -X POST "http://localhost:8080/session/${openCodeSessionId}/prompt_async" \\
        -H "Content-Type: application/json" \\
        -d '${JSON.stringify({
          parts: [{ type: "text", text: prompt }],
        })}'
    `);

    if (result.exitCode !== 0) {
      throw new Error(`Failed to send prompt: ${result.stderr}`);
    }

    // The response will come via the SSE listener
    // Store metadata for correlating responses
    this.ctx.storage.put(`pending_prompt:${promptId}`, {
      userMessageId,
      userId: connState.userId,
      githubUsername: connState.githubUsername,
    });
  }

  private async abortOpenCodeSession() {
    const openCodeSessionId = this.state.openCodeSessionId;
    if (!openCodeSessionId) return;

    await this.sandbox.exec(`
      curl -X POST "http://localhost:8080/session/${openCodeSessionId}/abort"
    `);
  }

  private startOpenCodeEventListener() {
    // Cancel any existing listener
    this.eventSourceController?.abort();
    this.eventSourceController = new AbortController();

    const openCodeSessionId = this.state.openCodeSessionId;
    if (!openCodeSessionId) return;

    // We'll poll the event endpoint since we can't do true SSE from Durable Object
    // In production, you might use a more sophisticated approach
    this.pollOpenCodeEvents();
  }

  private async pollOpenCodeEvents() {
    const openCodeSessionId = this.state.openCodeSessionId;
    if (!openCodeSessionId) return;

    // Poll for new messages
    // This is a simplified version; production would use proper event streaming
    const messagesResult = await this.sandbox.exec(`
      curl -s "http://localhost:8080/session/${openCodeSessionId}/message?limit=10"
    `);

    if (messagesResult.exitCode === 0) {
      try {
        const messages = JSON.parse(messagesResult.stdout);
        // Process and broadcast new messages
        for (const msg of messages) {
          if (msg.info.role === "assistant") {
            // Check if we've already processed this message
            const processed = await this.ctx.storage.get(
              `processed:${msg.info.id}`,
            );
            if (processed) continue;

            await this.ctx.storage.put(`processed:${msg.info.id}`, true);

            // Store in our DB
            const messageId = crypto.randomUUID();
            this.sql`
              INSERT INTO messages (id, user_id, github_username, role, content, parts, opencode_message_id)
              VALUES (
                ${messageId},
                'system',
                'opencode',
                'assistant',
                ${msg.parts?.find((p: any) => p.type === "text")?.text || ""},
                ${JSON.stringify(msg.parts)},
                ${msg.info.id}
              )
            `;

            // Broadcast to all clients
            this.broadcast({
              type: "message.new",
              message: {
                id: messageId,
                sessionId: this.ctx.id.toString(),
                userId: "system",
                githubUsername: "opencode",
                role: "assistant",
                content:
                  msg.parts?.find((p: any) => p.type === "text")?.text || "",
                parts: msg.parts,
                createdAt: new Date(),
                openCodeMessageId: msg.info.id,
              },
            });
          }
        }
      } catch (e) {
        console.error("Failed to parse OpenCode messages:", e);
      }
    }

    // Check if prompt is still running
    const statusResult = await this.sandbox.exec(`
      curl -s "http://localhost:8080/session/status"
    `);

    if (statusResult.exitCode === 0) {
      try {
        const status = JSON.parse(statusResult.stdout);
        const sessionStatus = status[openCodeSessionId];

        if (sessionStatus?.status === "idle" && this.state.promptLock) {
          // Prompt completed, release lock
          this.releaseLock();
        }
      } catch (e) {
        // Ignore parse errors
      }
    }

    // Continue polling if sandbox is active
    if (
      this.state.sandboxStatus === "ready" ||
      this.state.sandboxStatus === "busy"
    ) {
      setTimeout(() => this.pollOpenCodeEvents(), 1000);
    }
  }

  // =========================================================================
  // PARTICIPANT MANAGEMENT
  // =========================================================================

  private async handleLeave(connection: Connection) {
    const connState = connection.state as ConnectionState;

    // Remove from participants
    const updatedParticipants = this.state.participants.filter(
      (p) => p.connectionId !== connection.id,
    );

    this.setState({ ...this.state, participants: updatedParticipants });

    // Broadcast leave
    this.broadcast({ type: "participant.left", odUserId: connection.id });

    console.log(`User ${connState?.githubUsername} left session`);
  }

  // =========================================================================
  // UTILITIES
  // =========================================================================

  private broadcast(event: AgentToClientEvent) {
    const message = JSON.stringify(event);
    for (const participant of this.state.participants) {
      try {
        // The Agent SDK handles connection management
        this.ctx.getWebSockets().forEach((ws) => {
          ws.send(message);
        });
      } catch (e) {
        // Connection may have closed
      }
    }
  }

  private broadcastExcept(
    excludeConnectionId: string,
    event: AgentToClientEvent,
  ) {
    const message = JSON.stringify(event);
    this.ctx.getWebSockets().forEach((ws) => {
      // Note: In production, you'd need to track which WS belongs to which connection
      ws.send(message);
    });
  }

  // =========================================================================
  // CALLABLE METHODS (HTTP RPC)
  // =========================================================================

  @callable()
  async getStatus() {
    return {
      participants: this.state.participants.length,
      sandboxStatus: this.state.sandboxStatus,
      hasActiveLock: !!this.state.promptLock,
      queueLength: this.state.promptQueue.length,
    };
  }

  @callable()
  async getHistory(params: { limit?: number; before?: string }) {
    const { limit = 50, before } = params;

    let query = this.sql<SessionMessage>`
      SELECT * FROM messages
      ${before ? this.sql`WHERE created_at < ${before}` : this.sql``}
      ORDER BY created_at DESC
      LIMIT ${limit}
    `;

    return query.reverse();
  }
}
```

---

## 4. Sandbox Configuration

### 4.1 Dockerfile

```dockerfile
# Dockerfile for Canopy OpenCode Sandbox
FROM docker.io/cloudflare/sandbox:0.3.3

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    python3 \
    python3-pip \
    && rm -rf /var/lib/apt/lists/*

# Install Node.js 20 LTS
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs

# Install OpenCode globally
RUN npm install -g opencode-ai

# Create workspace directory
RUN mkdir -p /workspace

# Copy custom startup script
COPY startup.sh /container-server/startup.sh
RUN chmod +x /container-server/startup.sh

# Set working directory
WORKDIR /workspace

# Expose OpenCode server port (for local dev)
EXPOSE 8080
```

### 4.2 Startup Script

```bash
#!/bin/bash
# startup.sh

# Environment variables expected:
# - R2_BUCKET_PATH: Path in R2 for this session's files
# - OPENCODE_PROVIDERS: JSON config for LLM providers

# Wait for workspace mount (R2)
echo "Waiting for workspace mount..."
for i in {1..30}; do
  if mountpoint -q /workspace; then
    echo "Workspace mounted"
    break
  fi
  sleep 1
done

# Initialize git if not already a repo
if [ ! -d "/workspace/.git" ]; then
  cd /workspace
  git init
  git config user.email "canopy@example.com"
  git config user.name "Canopy"
fi

# Start OpenCode server in background
echo "Starting OpenCode server..."
cd /workspace
opencode serve --port 8080 --hostname 0.0.0.0 &

# Wait for OpenCode to be ready
for i in {1..30}; do
  if curl -sf http://localhost:8080/global/health > /dev/null 2>&1; then
    echo "OpenCode server ready"
    break
  fi
  sleep 1
done

# Start the SDK control plane (required for Sandbox SDK)
exec bun dist/index.js
```

---

## 5. Wrangler Configuration

```jsonc
// wrangler.jsonc
{
  "$schema": "node_modules/wrangler/config-schema.json",
  "name": "canopy-cloud",
  "main": "src/index.ts",
  "compatibility_date": "2024-12-01",

  // Durable Objects
  "durable_objects": {
    "bindings": [
      {
        "name": "SESSION_AGENT",
        "class_name": "SessionAgent",
      },
    ],
  },

  // Migrations for Durable Object SQL
  "migrations": [
    {
      "tag": "v1",
      "new_sqlite_classes": ["SessionAgent"],
    },
  ],

  // D1 Database
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "canopy-db",
      "database_id": "YOUR_D1_DATABASE_ID",
    },
  ],

  // KV Namespace
  "kv_namespaces": [
    {
      "binding": "KV",
      "id": "YOUR_KV_NAMESPACE_ID",
    },
  ],

  // R2 Bucket
  "r2_buckets": [
    {
      "binding": "R2",
      "bucket_name": "canopy-projects",
    },
  ],

  // Sandbox
  "containers": {
    "SANDBOX": {
      "image": "./Dockerfile",
      "max_instances": 100,
      "mode": "off", // Managed by SessionAgent
    },
  },

  // Secrets (set via `wrangler secret put`)
  // - GITHUB_CLIENT_ID
  // - GITHUB_CLIENT_SECRET
  // - SESSION_SECRET
  // - ENCRYPTION_KEY

  // Development
  "dev": {
    "port": 8787,
    "local_protocol": "http",
  },
}
```

---

## 6. Client Integration

### 6.1 React Hook Usage

```typescript
// hooks/useSession.ts
import { useAgent } from "agents/react";
import { useState, useCallback, useEffect } from "react";

interface UseSessionOptions {
  sessionId: string;
  user: {
    id: string;
    githubUsername: string;
    avatarUrl: string;
  };
}

export function useSession({ sessionId, user }: UseSessionOptions) {
  const [state, setState] = useState<SessionState | null>(null);
  const [messages, setMessages] = useState<SessionMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);

  const agent = useAgent({
    agent: "session-agent",
    name: sessionId,
    // Pass user info as query params (auth middleware validates)
    params: {
      userId: user.id,
      username: user.githubUsername,
      avatar: user.avatarUrl,
    },
    onStateUpdate: (newState) => {
      setState(newState);
    },
    onMessage: (event) => {
      const data = JSON.parse(event.data);
      handleAgentEvent(data);
    },
    onOpen: () => setIsConnected(true),
    onClose: () => setIsConnected(false),
  });

  const handleAgentEvent = useCallback((event: AgentToClientEvent) => {
    switch (event.type) {
      case "state.sync":
        setState(event.state);
        break;

      case "history.sync":
        setMessages(event.messages);
        break;

      case "message.new":
        setMessages((prev) => [...prev, event.message]);
        break;

      case "message.update":
        setMessages((prev) =>
          prev.map((m) =>
            m.id === event.messageId ? { ...m, ...event.updates } : m,
          ),
        );
        break;

      case "message.stream":
        setMessages((prev) =>
          prev.map((m) =>
            m.id === event.messageId
              ? { ...m, content: m.content + event.chunk }
              : m,
          ),
        );
        break;

      // Handle other events...
    }
  }, []);

  const sendPrompt = useCallback(
    (prompt: string) => {
      agent.send(JSON.stringify({ type: "prompt.send", prompt }));
    },
    [agent],
  );

  const queuePrompt = useCallback(
    (prompt: string) => {
      agent.send(JSON.stringify({ type: "prompt.queue", prompt }));
    },
    [agent],
  );

  const abortPrompt = useCallback(() => {
    agent.send(JSON.stringify({ type: "prompt.abort" }));
  }, [agent]);

  const dequeuePrompt = useCallback(
    (promptId: string) => {
      agent.send(JSON.stringify({ type: "prompt.dequeue", promptId }));
    },
    [agent],
  );

  return {
    // Connection state
    isConnected,

    // Session state
    state,
    messages,

    // Computed
    participants: state?.participants ?? [],
    isLocked: !!state?.promptLock,
    lockHolder: state?.promptLock?.heldBy,
    queuePosition:
      state?.promptQueue.findIndex((p) => p.userId === user.id) ?? -1,
    queueLength: state?.promptQueue.length ?? 0,
    sandboxStatus: state?.sandboxStatus ?? "not_started",

    // Actions
    sendPrompt,
    queuePrompt,
    abortPrompt,
    dequeuePrompt,
  };
}
```

### 6.2 Example Component

```tsx
// components/SessionView.tsx
import { useSession } from "../hooks/useSession";

export function SessionView({ sessionId, user }) {
  const {
    isConnected,
    messages,
    participants,
    isLocked,
    lockHolder,
    queuePosition,
    sandboxStatus,
    sendPrompt,
    queuePrompt,
    abortPrompt,
  } = useSession({ sessionId, user });

  const [input, setInput] = useState("");

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;

    if (isLocked && lockHolder?.userId !== user.id) {
      // Queue the prompt since someone else is running
      queuePrompt(input);
    } else {
      sendPrompt(input);
    }

    setInput("");
  };

  return (
    <div className="flex h-screen">
      {/* Sidebar - Participants */}
      <aside className="w-64 border-r p-4">
        <h2 className="font-semibold mb-4">
          Participants ({participants.length})
        </h2>
        {participants.map((p) => (
          <div key={p.connectionId} className="flex items-center gap-2 mb-2">
            <img src={p.user.avatarUrl} className="w-8 h-8 rounded-full" />
            <span>{p.user.githubUsername}</span>
            {lockHolder?.userId === p.user.id && (
              <span className="text-xs bg-yellow-200 px-1 rounded">
                typing...
              </span>
            )}
          </div>
        ))}

        {/* Sandbox Status */}
        <div className="mt-4 pt-4 border-t">
          <span className="text-sm text-gray-500">
            Sandbox: {sandboxStatus}
          </span>
        </div>
      </aside>

      {/* Main - Messages */}
      <main className="flex-1 flex flex-col">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : ""}`}
            >
              <div
                className={`max-w-[80%] p-3 rounded-lg ${
                  msg.role === "user" ? "bg-blue-100" : "bg-gray-100"
                }`}
              >
                <div className="text-xs text-gray-500 mb-1">
                  {msg.githubUsername}
                  {msg.executionStatus === "running" && " • Running..."}
                </div>
                <div className="whitespace-pre-wrap">{msg.content}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <form onSubmit={handleSubmit} className="p-4 border-t">
          {isLocked && lockHolder?.userId !== user.id && (
            <div className="text-sm text-yellow-600 mb-2">
              {lockHolder?.githubUsername} is currently running a prompt. Your
              message will be queued.
              {queuePosition >= 0 && ` (Position: ${queuePosition + 1})`}
            </div>
          )}

          <div className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your prompt..."
              className="flex-1 px-4 py-2 border rounded-lg"
              disabled={sandboxStatus === "starting"}
            />
            <button
              type="submit"
              className="px-4 py-2 bg-blue-500 text-white rounded-lg"
              disabled={sandboxStatus === "starting"}
            >
              {isLocked && lockHolder?.userId !== user.id ? "Queue" : "Send"}
            </button>

            {isLocked && lockHolder?.userId === user.id && (
              <button
                type="button"
                onClick={abortPrompt}
                className="px-4 py-2 bg-red-500 text-white rounded-lg"
              >
                Abort
              </button>
            )}
          </div>
        </form>
      </main>
    </div>
  );
}
```

---

## 7. Security Considerations

### 7.1 Authentication Flow

1. User clicks "Sign in with GitHub"
2. Redirected to GitHub OAuth with `user:email repo` scopes
3. On callback, exchange code for access token
4. Store encrypted token in D1
5. Create session cookie with random token
6. WebSocket connections include user info validated by middleware

### 7.2 Authorization

- **Session Access**: Checked via `session_access` table before connecting
- **Prompt Ownership**: Each prompt tagged with `userId` and `githubUsername`
- **Lock System**: Only lock holder can abort; others must queue
- **GitHub Operations**: Use user's own OAuth token for PR creation

### 7.3 Sandbox Isolation

- Each session has its own sandbox instance
- R2 bucket path scoped to session ID
- No cross-session file access
- Network egress controlled via Cloudflare settings

---

## 8. Deployment Checklist

### 8.1 Prerequisites

- [ ] Cloudflare Workers Paid plan
- [ ] Sandbox SDK beta access
- [ ] GitHub OAuth App created
- [ ] Domain configured in Cloudflare

### 8.2 Setup Steps

```bash
# 1. Create D1 database
wrangler d1 create canopy-db

# 2. Create KV namespace
wrangler kv:namespace create CANOPY_KV

# 3. Create R2 bucket
wrangler r2 bucket create canopy-projects

# 4. Set secrets
wrangler secret put GITHUB_CLIENT_ID
wrangler secret put GITHUB_CLIENT_SECRET
wrangler secret put SESSION_SECRET
wrangler secret put ENCRYPTION_KEY

# 5. Run D1 migrations
wrangler d1 execute canopy-db --file=./migrations/001_init.sql

# 6. Deploy
wrangler deploy
```

### 8.3 Monitoring

- Cloudflare Dashboard for Worker metrics
- Durable Object analytics for session health
- R2 storage usage monitoring
- Custom logging to Workers Logs

---

## 9. Future Enhancements

### 9.1 Phase 2

- [ ] Collaborative file editing (CRDT-based)
- [ ] Voice/video chat integration
- [ ] Session recordings and playback
- [ ] Custom model provider configuration per session

### 9.2 Phase 3

- [ ] Team/Organization support
- [ ] Session templates
- [ ] Plugin system for custom tools
- [ ] Self-hosted option

---

## 10. Cost Estimation

Based on Cloudflare pricing (as of 2024):

| Component            | Usage                         | Estimated Monthly Cost |
| -------------------- | ----------------------------- | ---------------------- |
| Workers              | 10M requests                  | $5                     |
| Durable Objects      | 1M requests, 1GB storage      | $5                     |
| D1                   | 5M reads, 1M writes           | $5                     |
| R2                   | 100GB storage, 10M operations | $5                     |
| Sandbox (Containers) | 1000 hours @ 2 vCPU           | ~$40                   |

**Estimated Total: ~$60/month** for moderate usage

Note: Actual costs depend on usage patterns. Sandbox/Container pricing may vary.
