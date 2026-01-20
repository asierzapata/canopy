use serde::{Deserialize, Serialize};

/// Represents a git worktree in the project
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Worktree {
    pub id: String,
    pub path: String,
    pub branch: String,
    pub is_bare: bool,
}

/// Configuration for spawning an agent
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentConfig {
    pub agent_type: String,
    pub environment: Vec<(String, String)>,
}

/// Represents an agent instance
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Agent {
    pub id: String,
    pub worktree_id: String,
    pub state: AgentState,
    pub pid: Option<u32>,
}

/// Agent execution states
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub enum AgentState {
    Idle,
    Thinking,
    Executing,
    AwaitingInput,
    Paused,
    Terminated,
}

/// Git repository status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GitStatus {
    pub branch: String,
    pub staged: Vec<String>,
    pub unstaged: Vec<String>,
    pub untracked: Vec<String>,
    pub ahead: u32,
    pub behind: u32,
}
