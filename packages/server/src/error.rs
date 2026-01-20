use thiserror::Error;

#[derive(Error, Debug)]
pub enum ServerError {
    #[error("Worktree not found: {0}")]
    WorktreeNotFound(String),

    #[error("Agent not found: {0}")]
    AgentNotFound(String),

    #[error("Git operation failed: {0}")]
    GitError(String),

    #[error("Process error: {0}")]
    ProcessError(String),

    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),

    #[error("Internal error: {0}")]
    Internal(String),
}

pub type Result<T> = std::result::Result<T, ServerError>;
