# Canopy Backend Architecture

## 1. Overview & Inspiration

Canopy is a multiplayer coding agent platform enabling teams to collaborate on AI-assisted development sessions. It allows multiple developers to collaborate on a feature by spawning different sessions, join them, observe real-time agent actions, and guide the work via prompts.

**Key Things:**

- **Multiplayer is Mission-Critical**: Collaboration is the default, not an addon.
- **Attribution**: Every prompt and git commit is linked to a specific human user for auditability.
- **Feature Grouping**: Developers collaborate on features, which could cover different agent sessions

## 2. High Level Architecture

The clients of canopy will be varied, and thats by design. All will connect to a server that will expose the following:

- General data like the workspace the user is in
- The features inside a workspace
- The status of each feature and the running sessions
- A way to connect to a session and receive real time information about the agent and a full fledge development environment

To do so we will use 2 different backend mechanisms:

- MongoDB to store all data except the real-time session state
- The realtime session state will be saved into a Cloudflare Agent which is an SDK to develop those real time sessions. On Mongo we will need to save the name of the agent to be able to connect to it.

For the agent running we will use a combination of cloudflare sandbox sdk and the opencode server. On the sandbox, the opencode server will run and we will need to update the cloudflare agent state accordingly. From the client we will send then request to the cloudflare agent and there we will need to communicate with opencode
