# Documentation Guidelines

This document defines how AI agents and humans should document the Canopy project. Our goal is to maintain a high-signal, low-noise knowledge base that explains the **reasoning** and **implications** of our technical and product choices.

## Core Principles

1.  **Insights over References:** Do not document what the code is doing (the code already says that). Document **why** it is doing it and what the trade-offs were.
2.  **Product + Tech Synergy:** Every technical decision should be linked to its product impact. Every product feature should explain its technical implementation strategy.
3.  **Bilingual (AI & Human):** Write clearly for humans, but use structured headers and precise terminology so AI agents can quickly parse context and constraints.
4.  **Future-Proofing:** Document the "intent." Code changes frequently; the underlying rationale usually lasts longer.

## What to Document

You should create or update documentation when:

- A new **feature** or **app area** is introduced.
- A significant **architectural decision** is made (e.g., choosing a specific state management pattern).
- A **complex interaction** between components is implemented.
- A **non-obvious constraint** is discovered (e.g., GPUI rendering limitations).

## Where to Document

All documentation lives in the `documentation/` directory.

- Organize by feature or area: `documentation/feature-name.md`.
- Use subdirectories for complex systems: `documentation/tauri/rendering.md`.

## Structure of a Documentation Entry

Every documentation file should follow this general flow:

### 1. Context & Motivation (The "Why")

- What problem does this solve for the user?
- What was the state of the system before this change?
- What product pillar does this support (Visibility, Direction, or Control)?

### 2. Technical Implementation

- High-level architectural approach.
- Key components and their responsibilities.
- Avoid line-by-line code references; focus on patterns and data flow.

### 3. Decisions & Trade-offs

- What alternatives were considered?
- Why was this specific path chosen? (e.g., performance vs. maintainability).
- List any "known unknowns" or technical debt intentionally introduced.

### 4. Consequences & Implications

- How does this affect other parts of the system?
- Are there new constraints for future development?
- What should an AI agent or developer be careful of when touching this area?

## Style Guidelines

- **Be Concise:** If it can be said in one sentence, don't use a paragraph.
- **Use Diagrams (Mermaid):** For complex state transitions or data flows.
- **Link Liberally:** Link to other documentation files to provide full context.
- **Product-First Language:** Start with the user benefit, then drill into the tech.

## Template

Use this template when creating new files:

```markdown
# [Feature/Area Name]

## Overview

Brief 1-2 sentence description of what this is.

## Motivation

Why does this exist? What is the product value?

## Architecture

How is it structured? (Patterns used, main structs/traits).

## Key Decisions

- **[Decision 1]**: Why we did X instead of Y.
- **[Decision 2]**: Implication of using Z.

## Safety & Constraints

What to watch out for. What could break?
```
