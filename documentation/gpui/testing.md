# Testing GPUI Applications

GPUI provides a specialized testing environment centered around the `#[gpui::test]` macro and the `TestAppContext`.

## Critical Requirements

### Tests Must Be in Separate Files

**IMPORTANT**: Due to a known issue in `gpui-macros 0.2.2`, tests using `#[gpui::test]` **must** be placed in separate files from code containing `Render` trait implementations. Placing tests in the same file as `Render` implementations causes a SIGBUS error (stack overflow in proc-macro expansion).

**Correct structure:**
```
src/
  lib.rs          # Export types for testing
  main.rs         # Application entry point
  my_view.rs      # Contains Render impl
tests/
  my_view_tests.rs  # Tests go here (separate file)
```

### Tests Must Be Async

All `#[gpui::test]` functions must be `async fn`, not regular `fn`:

```rust
// CORRECT
#[gpui::test]
async fn test_my_feature(cx: &mut TestAppContext) {
    // ...
}

// WRONG - will cause SIGBUS
#[gpui::test]
fn test_my_feature(cx: &mut TestAppContext) {
    // ...
}
```

## Core Components

### `#[gpui::test]`
The primary macro for defining tests. It must be applied to `async` functions, providing a `&mut TestAppContext` to the test body.

```rust
use gpui::TestAppContext;

#[gpui::test]
async fn test_my_feature(cx: &mut TestAppContext) {
    // Test logic here
}
```

### `TestAppContext`
A testing-specific context that allows you to:
- Open windows and create views/models
- Simulate user interactions (clicks, typing)
- Control the execution of the application (background tasks, time)
- Inspect the UI state and bounds

## Common Operations

### Setting Up the UI

To test a View, open a window using `cx.add_window()`. The closure receives two parameters: `window` and `cx`.

```rust
use my_crate::MyView;
use gpui::TestAppContext;

#[gpui::test]
async fn test_view_rendering(cx: &mut TestAppContext) {
    let window = cx.add_window(|_window, cx| MyView::new(cx));
    cx.run_until_parked();
}
```

### Updating Window State

Use `window.update()` to access and modify the view. The closure receives three parameters: `view`, `window`, and `cx`.

```rust
#[gpui::test]
async fn test_view_state(cx: &mut TestAppContext) {
    let window = cx.add_window(|_window, cx| MyView::new(cx));
    cx.run_until_parked();

    window
        .update(cx, |view, _window, _cx| {
            assert_eq!(view.count, 0);
        })
        .unwrap();
}
```

### Reading Entity State

When accessing child entities, use `.read(cx)` within an update closure:

```rust
#[gpui::test]
async fn test_child_entity(cx: &mut TestAppContext) {
    let window = cx.add_window(|_window, cx| RootView::new(cx));
    cx.run_until_parked();

    window
        .update(cx, |root, _window, cx| {
            let sidebar = root.sidebar.read(cx);
            // Assert on sidebar state
        })
        .unwrap();
}
```

### Simulating Interactions

#### Keyboard
Use `simulate_keystroke` to send keyboard events.

```rust
cx.simulate_keystroke("enter");
cx.simulate_keystroke("cmd-s");
cx.simulate_keystroke("a");
```

#### Mouse
Use `simulate_click` with a coordinate. You can find coordinates of elements using `debug_bounds`.

```rust
// Find an element by its ID (if set via .id("my-button"))
let bounds = cx.debug_bounds("my-button").expect("button not found");
cx.simulate_click(bounds.center(), gpui::Modifiers::none());
```

### Managing Async Work

GPUI is highly asynchronous. If your code spawns tasks or triggers animations, you need to wait for them to settle.

```rust
cx.run_until_parked(); // Processes all pending background tasks and foreground updates
```

## Assertion Patterns

### State Assertions

Use `window.update()` to read from views and verify state:

```rust
window
    .update(cx, |view, _window, _cx| {
        assert_eq!(view.some_value, expected_value);
    })
    .unwrap();
```

### Entity Assertions

```rust
window
    .update(cx, |view, _window, cx| {
        let entity_id = view.child_entity.entity_id();
        assert!(entity_id.as_u64() > 0);
    })
    .unwrap();
```

## Complete Example

```rust
//! tests/counter_tests.rs

use my_crate::CounterView;
use gpui::TestAppContext;

#[gpui::test]
async fn test_counter_creation(cx: &mut TestAppContext) {
    let window = cx.add_window(|_window, cx| CounterView::new(cx));
    cx.run_until_parked();

    window
        .update(cx, |view, _window, _cx| {
            assert_eq!(view.count, 0);
        })
        .unwrap();
}

#[gpui::test]
async fn test_counter_increment(cx: &mut TestAppContext) {
    let window = cx.add_window(|_window, cx| CounterView::new(cx));
    cx.run_until_parked();

    // Find increment button and click it
    let bounds = cx.debug_bounds("increment-btn").unwrap();
    cx.simulate_click(bounds.center(), gpui::Modifiers::none());

    // Wait for update
    cx.run_until_parked();

    // Verify state
    window
        .update(cx, |view, _window, _cx| {
            assert_eq!(view.count, 1);
        })
        .unwrap();
}
```

## Project Setup

### Cargo.toml Configuration

```toml
[dependencies]
gpui = { version = "0.2.2", features = ["runtime_shaders"] }

# Required: Pin core-text to avoid version conflicts
core-text = "=21.0.0"

[dev-dependencies]
gpui = { version = "0.2.2", features = ["test-support", "runtime_shaders"] }
```

### File Organization

Organize tests by component in the `tests/` directory:

```
tests/
  root_view_tests.rs     # Tests for RootView
  sidebar_tests.rs       # Tests for SidebarView
  window_tests.rs        # App/window-level integration tests
```

Each test file imports the types from your library crate:

```rust
use my_crate::{RootView, SidebarView};
use gpui::TestAppContext;
```

## Best Practices

1. **Always use async tests**: The `#[gpui::test]` macro requires `async fn`.

2. **Keep tests in separate files**: Never place `#[gpui::test]` in files with `Render` implementations.

3. **Use `run_until_parked()`**: Call this after any action that triggers async work or state changes.

4. **Export types via lib.rs**: Make your views public and export them from `lib.rs` so integration tests can access them.

5. **Use deterministic time**: `TestAppContext` controls a virtual clock. Avoid `std::thread::sleep` or real-time operations.

6. **Test components in isolation**: Create individual components in fresh test windows rather than testing the entire app.

7. **Handle Results**: Always call `.unwrap()` on `window.update()` results to catch window-closed errors.
