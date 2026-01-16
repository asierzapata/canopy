# Testing GPUI Applications

GPUI provides a specialized testing environment centered around the `#[gpui::test]` macro and the `TestAppContext`.

## Core Components

### `#[gpui::test]`
The primary macro for defining tests. It can be applied to `async` functions, providing a `&mut TestAppContext` to the test body.

```rust
#[gpui::test]
async fn test_my_feature(cx: &mut gpui::TestAppContext) {
    // Test logic here
}
```

### `TestAppContext`
A testing-specific context that allows you to:
- Open windows and create views/models.
- Simulate user interactions (clicks, typing).
- Control the execution of the application (background tasks, time).
- Inspect the UI state and bounds.

## Common Operations

### Setting Up the UI
To test a View, you typically open a window and render it.

```rust
#[gpui::test]
async fn test_view_rendering(cx: &mut gpui::TestAppContext) {
    cx.add_window(|cx| {
        cx.new_view(|_| MyView { state: 0 })
    });
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
GPUI is highly asynchronous. If your code spawns tasks or triggers animations, you often need to wait for them to settle.

```rust
cx.run_until_parked(); // Processes all pending background tasks and foreground updates
```

## Assertion Patterns

### State Assertions
Read from models or views to verify they updated correctly.

```rust
model.read_with(cx, |model, _| {
    assert_eq!(model.some_value, expected_value);
});
```

### UI Assertions
While GPUI doesn't typically use "snapshot" tests for the pixel-perfect output in unit tests, you can assert on the existence of elements or their properties via `debug_bounds`.

## Example: Counter Test

```rust
#[gpui::test]
async fn test_counter_increment(cx: &mut gpui::TestAppContext) {
    let view = cx.add_window(|cx| {
        cx.new_view(|_| CounterView::new())
    });

    // Find increment button and click it
    let bounds = cx.debug_bounds("increment-btn").unwrap();
    cx.simulate_click(bounds.center(), gpui::Modifiers::none());

    // Wait for update
    cx.run_until_parked();

    // Verify state
    view.update(cx, |view, _| {
        assert_eq!(view.count, 1);
    });
}
```

## Best Practices
1. **Use `run_until_parked()`**: Whenever you simulate an action that triggers async work or state changes that require a re-render.
2. **Deterministic Time**: `TestAppContext` controls a virtual clock. Avoid `std::thread::sleep` or real-time `Instant::now()` if possible.
3. **Small Contexts**: Test individual components (Views) in isolation by creating them in a fresh test window.
