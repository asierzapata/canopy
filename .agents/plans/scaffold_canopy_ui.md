# Plan: Scaffold Canopy UI

## Goal
Scaffold the basic UI structure for Canopy using GPUI. This includes a sidebar and a main workspace with two tabs: "Coding Agent" and "Git Flow". No business logic will be implemented, only the architectural layout and view hierarchy.

## Context
- `Cargo.toml`: Needs GPUI dependency.
- `src/main.rs`: Will be updated to initialize the GPUI application.
- `documentation/gpui/`: Reference for GPUI patterns and testing.

## Phases

### Phase 1: GPUI Foundation
**Description:** Initialize the GPUI application, GPUI Component library, and open a basic window.
- [x] Add `gpui` and `gpui-component` dependencies to `Cargo.toml`.
- [x] Update `src/main.rs` to initialize `gpui::App`.
- [ ] Initialize `gpui_component::init(cx)` in `main`.
- [x] Open a native window with a simple background color.
**Verification:**
- Manual: Run `cargo run` and see a blank window appear.
- Automated: Implement a basic `#[gpui::test]` that adds a window and verifies it doesn't panic.

### Phase 2: Root Layout & Sidebar
**Description:** Create the `RootView` which divides the window into a Sidebar and a Main Area, wrapped in a GPUI Component `Root`.
- [ ] Implement `SidebarView` component using `v_flex()` and `Button` for navigation items.
- [ ] Implement `RootView` component with `.id("root-view")`.
- [ ] Set window root to `gpui_component::Root::new(RootView, window, cx)`.
**Verification:**
- Manual: `cargo run` shows a sidebar on the left and an empty area on the right.
- Automated: Use `cx.debug_bounds("sidebar")` in a test to ensure the sidebar is rendered.

### Phase 3: Tabbed Workspace with GPUI Component
**Description:** Implement `WorkspaceView` using the `TabBar` component from `gpui-component`.
- [ ] Define `Tab` enum (`CodingAgent`, `GitFlow`).
- [ ] Create `AppState` model to hold the active tab.
- [ ] Implement `WorkspaceView` using `TabBar` and `Tab` components for switching between views.
**Verification:**
- Manual: Clicking tabs in the `TabBar` changes the active view highlight.
- Automated: Simulate a click on the "Git Flow" tab and verify `AppState` updates.

### Phase 4: Tab Content Scaffolding
**Description:** Create placeholder views for each tab using `gpui-component` elements.
- [ ] Implement `AgentView` stub using `GroupBox` or `div()`.
- [ ] Implement `GitFlowView` stub using `Table` or `List` placeholders.
- [ ] Update `WorkspaceView` to render the active view based on `AppState`.
**Verification:**
- Manual: Switching tabs correctly displays the corresponding placeholder text.
- Automated: Switch tabs and verify that `cx.debug_bounds("agent-content")` or `cx.debug_bounds("git-flow-content")` exists accordingly.

## Next step
Start Phase 2: Implement `RootView` and `SidebarView` and set them as the window root.
