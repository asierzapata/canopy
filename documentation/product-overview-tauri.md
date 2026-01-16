# Product Spec: Canopy (Tauri Edition)

## Executive Summary

**Canopy** is a high-performance desktop "mission control" for parallel AI development. It orchestrates multiple AI agents working in isolated `git worktrees`, allowing a single engineer to direct, monitor, and review a fleet of autonomous coding tasks from a unified, low-latency interface.

*Note: This is an alternative specification using Tauri instead of GPUI.*

## Problem Statement

### Core Problems

1. **The "Black Box" Problem:** CLI-based agents are hard to monitor in parallel; having multiple terminals or sessions open complicate things.
2. **Context Fragmentation:** Injecting updated design docs or constraints into multiple active worktrees is manual and error-prone.
3. **Review Friction:** Checking the work of 4 parallel agents requires constant context-switching between branches/worktrees in a traditional IDE.
   - High cognitive load leads to missed issues

### Competitive Landscape Gaps

- **tmux/screen:** No git integration, no visual diffing, manual window management
- **Multiple IDE instances:** Memory intensive (2GB+ per instance), no unified context
- **Web-based dashboards:** Latency issues, browser resource limits, no local file system access
- **Existing AI tools:** Single-agent focus, no parallel orchestration capabilities

## Core Philosophy

The developer maintaining control over what is being developed is crucial. Control is maintained with high-quality signals among all the noise that multiple agents in parallel create.

**Why Desktop Native (Tauri):**

- **Hybrid Performance:** Rust backend for heavy lifting (git, processes) combined with the flexibility of modern Web UI.
- **Direct File System Access:** Essential for real-time git operations and agent management.
- **Rich Ecosystem:** Leverage mature web libraries (React, xterm.js, Monaco Editor) for complex UI components.
- **Cross-Platform:** Native-like experience on macOS, Linux, and Windows.

## App Pillars

### A. The Birds-Eye Dashboard (Visibility)

- **Real-time Status:**
  - Worktree health indicators (git status, last activity, agent state)
- **Live Stream:**
  - PTY emulation via **xterm.js** connected to Rust backend
  - Search/filter capabilities across all agent outputs
- **Resource Monitoring:**
  - Seeing which agents are "Thinking" vs. "Executing" vs "Idle".

### B. The Context Engine (Direction)

- **Global Context Injection:**
  - Central panel for Markdown/requirements
- **Context System Specifications:**
  - File size limit: 10MB per context file
  - Format support: Markdown, JSON, YAML, plain text
  - Validation rules: required fields, format compliance, dependency checking

### C. The Review & Merge Flow (Control)

- **Side-by-Side Diffing:**
  - **Monaco Editor** diff view for industry-standard code review experience
  - Three-way merge support for conflict resolution
  - Complexity scoring for changed files
- **One-Click Actions:**
  - Commit & Push: with automatic message generation and conflict detection
  - Nuke Worktree: complete cleanup with 10-second grace period

## Functional Requirements

| Feature                | Description                                                        |
| ---------------------- | ------------------------------------------------------------------ |
| **Worktree Discovery** | Automatically detect and list existing worktrees from root project |
| **Worktree Creation**  | Spawn new worktrees with agent initialization                      |
| **Log Streaming**      | PTY output streamed from Rust to xterm.js in the frontend          |
| **Unified Diff View**  | Monaco-based diff editor to review changes                         |
| **Process Control**    | Interrupt/kill agent processes and clear worktree state            |
| **Agent Lifecycle**    | Spawn, pause, resume, terminate agents with state management       |

## Agent Observability & Integration

To solve the "Black Box" problem, Canopy uses a **Semantic Terminal Wrapper** in the Rust backend to "watch" the agent's output before it reaches the UI.

### Strategy: The Stream Interceptor
`Agent Process` → `(PTY Output)` → **`Rust State Analyzer`** → `(State Events)` → `Frontend UI`

### State Detection Logic
We define **"Agent Profiles"** (parsers) for supported tools:

1.  **Claude Code (Heuristic Parsing):**
    - **`AWAITING_INPUT`:** Detected when output stream pauses (>200ms) AND buffer ends with prompt patterns (e.g., `>`, `?`, `(y/n)`).
    - **`THINKING`:** Detected via high-frequency token streaming or "Thinking..." patterns.
    - **`EXECUTING`:** Detected via keywords like `Running command...` or `Exec:`.

2.  **OpenCode (Structured Integration):**
    - Run with `CANOPY_INTEGRATION=1`.
    - Emits specific non-printing control sequences or JSON-structured logs to explicitly signal state changes to Canopy.

## Technical Constraints & Architecture

- **Backend:** Rust (Tauri Core)
  - Handles git operations, file system access, and agent process spawning.
  - Uses `tokio` for async I/O.
- **Frontend:** React + TypeScript + Tailwind CSS
  - Responsible for the presentation layer.
  - Interacts with backend via Tauri Commands/Events.
- **Terminal:** `xterm.js` for rendering PTY streams.
- **Editor/Diff:** `monaco-editor` (VS Code's editor core) for viewing and diffing code.
- **Data Persistence:** SQLite via **Tauri SQL Plugin**.
  - Frontend: Direct queries for UI state/history (reduces boilerplate).
  - Backend: Uses `sqlx` directly for high-performance agent state updates (shared database access).

## User Journey: The "Parallel Refactor"

1. **Initialize**
   - User opens Canopy and selects repo.
   - Rust backend scans directory and sends worktree data to frontend.

2. **Spawn**
   - User creates 3 features → 3 new worktrees via UI.
   - Frontend invokes Tauri command `spawn_agent`.
   - Backend creates worktrees and spawns isolated processes.

3. **Direct**
   - User writes architectural plan in the UI.
   - Plan is injected into the coding agent's context.

4. **Monitor**
   - Real-time status grid updates via Tauri events.
   - Log output streams from backend to xterm.js instances.

5. **Audit**
   - Agent status changes to "Blocked".
   - User clicks to focus; xterm.js takes input and sends it to the backend PTY.
   - User unblocks the agent via chat/terminal.

6. **Finalize**
   - Review gallery loads file diffs into Monaco Editor.
   - User commits changes via UI button (triggers git command in backend).
   - Cleanup: archive completed worktrees.

### Potential Risks to Mitigate

- **IPC Overhead:** Ensure high-frequency logs don't clog the bridge between Rust and WebView. Batching might be required.
- **State Sync:** Keep frontend state in sync with backend file system events (use file watchers).
