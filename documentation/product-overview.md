# Product Spec: Canopy

## Executive Summary

**Canopy** is a high-performance desktop "mission control" for parallel AI development. It orchestrates multiple AI agents working in isolated `git worktrees`, allowing a single engineer to direct, monitor, and review a fleet of autonomous coding tasks from a unified, low-latency interface.

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

## Core Philoshopy

The developer maintaining control over what is being developed is crucial. Control is maintained with high-quality signals among all the noise that multiple agents in parallel create.

**Why Desktop Native:**

- Fast UI response times
- Direct file system access for real-time git operations
- Native process management for agent lifecycle control
- GPU acceleration for rendering multiple high-frequency log streams

## App Pillars

### A. The Birds-Eye Dashboard (Visibility)

- **Real-time Status:**
  - Worktree health indicators (git status, last activity, agent state)

- **Live Stream:**
  - PTY emulation
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
  - Native diff viewer with syntax highlighting
  - Three-way merge support for conflict resolution
  - Complexity scoring for changed files (lines added/removed, cyclomatic complexity?)
- **One-Click Actions:**
  - Commit & Push: with automatic message generation and conflict detection
  - Nuke Worktree: complete cleanup with 10-second grace period

## Functional Requirements

| Feature                | Description                                                        |
| ---------------------- | ------------------------------------------------------------------ |
| **Worktree Discovery** | Automatically detect and list existing worktrees from root project |
| **Worktree Creation**  | Spawn new worktrees with agent initialization                      |
| **Log Streaming**      | High-performance PTY/log viewer for agent output                   |
| **Unified Diff View**  | Native view to review changes without separate IDE                 |
| **Process Control**    | Interrupt/kill agent processes and clear worktree state            |
| **Agent Lifecycle**    | Spawn, pause, resume, terminate agents with state management       |

## Technical Constraints & Architecture

- **Language:** Rust (memory safety, performance, concurrency)
- **UI Framework:** GPUI (GPU-accelerated, <16ms frame times)
- **Concurrency:** tokio for async I/O, rayon for CPU-bound tasks
- **Data Persistence:** SQLite for relational data, JSON for configuration

## User Journey: The "Parallel Refactor"

1. **Initialize**
   - User opens Canopy and selects repo
   - Auto-discovery shows existing worktrees with status

2. **Spawn**
   - User creates 3 features → 3 new worktrees
   - Each worktree gets isolated agent process
   - Agent initialization: environment setup, dependency check, context loading
   - Failure handling: rollback on agent spawn failure

3. **Direct**
   - User writes architectural plan for each feature
   - Architecture plan is injected to the coding agent

4. **Monitor**
   - Real-time status grid shows all 3 agents
   - Log streaming at 60 FPS with syntax highlighting
   - Blocked state detection with automatic user notification

5. **Audit**
   - Agent status changes to "Blocked" (red indicator)
   - User clicks → immediate terminal access within Canopy
   - Context shows the terminal and the last agent actions
   - User unblocks the agent with the chat

6. **Finalize**
   - Review gallery shows all 3 feature diffs
   - Batch operations: commit all, push all, or selective merge
   - Cleanup: archive completed worktrees, free resources

### Potential Risks to Mitigate

- **State Sync:** Ensuring the UI doesn't drift from the actual state of the file system if a user runs a manual `git` command in the terminal.
