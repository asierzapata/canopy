# Testing Strategy: GPUI Tests vs Unit Tests

This guide helps you decide when to use `#[gpui::test]` integration tests versus standard `#[test]` unit tests in a GPUI application.

## Quick Decision Guide

| What you're testing | Use |
|---------------------|-----|
| Pure business logic (no UI) | `#[test]` |
| Data transformations | `#[test]` |
| Algorithms | `#[test]` |
| View rendering | `#[gpui::test]` |
| User interactions (clicks, keyboard) | `#[gpui::test]` |
| Entity lifecycle | `#[gpui::test]` |
| Component state after events | `#[gpui::test]` |
| Window behavior | `#[gpui::test]` |

## When to Use `#[test]` (Unit Tests)

Standard Rust unit tests are faster and simpler. Use them for:

### Pure Functions and Business Logic

```rust
// src/utils.rs
pub fn calculate_total(items: &[Item]) -> f64 {
    items.iter().map(|i| i.price * i.quantity as f64).sum()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_total() {
        let items = vec![
            Item { price: 10.0, quantity: 2 },
            Item { price: 5.0, quantity: 3 },
        ];
        assert_eq!(calculate_total(&items), 35.0);
    }
}
```

### Data Structures and Transformations

```rust
// src/models.rs
pub struct Config {
    pub theme: Theme,
    pub font_size: u32,
}

impl Config {
    pub fn from_json(json: &str) -> Result<Self, Error> {
        // parsing logic
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_config_parsing() {
        let json = r#"{"theme": "dark", "font_size": 14}"#;
        let config = Config::from_json(json).unwrap();
        assert_eq!(config.font_size, 14);
    }
}
```

### State Machine Logic

```rust
pub enum EditorState {
    Normal,
    Insert,
    Visual,
}

impl EditorState {
    pub fn transition(&self, key: char) -> Self {
        match (self, key) {
            (EditorState::Normal, 'i') => EditorState::Insert,
            (EditorState::Insert, '\x1b') => EditorState::Normal,
            _ => self.clone(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_state_transitions() {
        let state = EditorState::Normal;
        let state = state.transition('i');
        assert!(matches!(state, EditorState::Insert));
    }
}
```

### Advantages of `#[test]`

- **Fast**: No GPUI runtime overhead
- **Simple**: No async, no context management
- **Inline**: Can live in the same file as the code
- **Focused**: Tests exactly one thing

## When to Use `#[gpui::test]` (Integration Tests)

Use GPUI tests when you need the GPUI runtime, window context, or UI interactions.

### View Rendering and State

```rust
// tests/counter_tests.rs
use my_app::CounterView;
use gpui::TestAppContext;

#[gpui::test]
async fn test_counter_initial_state(cx: &mut TestAppContext) {
    let window = cx.add_window(|_window, cx| CounterView::new(cx));
    cx.run_until_parked();

    window
        .update(cx, |view, _window, _cx| {
            assert_eq!(view.count, 0);
        })
        .unwrap();
}
```

### User Interactions

```rust
#[gpui::test]
async fn test_button_click(cx: &mut TestAppContext) {
    let window = cx.add_window(|_window, cx| ButtonView::new(cx));
    cx.run_until_parked();

    let bounds = cx.debug_bounds("submit-btn").unwrap();
    cx.simulate_click(bounds.center(), gpui::Modifiers::none());
    cx.run_until_parked();

    window
        .update(cx, |view, _window, _cx| {
            assert!(view.was_clicked);
        })
        .unwrap();
}
```

### Entity Relationships

```rust
#[gpui::test]
async fn test_parent_child_relationship(cx: &mut TestAppContext) {
    let window = cx.add_window(|_window, cx| ParentView::new(cx));
    cx.run_until_parked();

    window
        .update(cx, |parent, _window, cx| {
            let child = parent.child.read(cx);
            assert_eq!(child.parent_id, parent.id);
        })
        .unwrap();
}
```

### Async Operations

```rust
#[gpui::test]
async fn test_async_data_loading(cx: &mut TestAppContext) {
    let window = cx.add_window(|_window, cx| DataView::new(cx));

    // Wait for async loading to complete
    cx.run_until_parked();

    window
        .update(cx, |view, _window, _cx| {
            assert!(view.data.is_some());
        })
        .unwrap();
}
```

### Advantages of `#[gpui::test]`

- **Realistic**: Tests actual GPUI behavior
- **Complete**: Can test rendering, interactions, and state together
- **Integration**: Verifies components work together

## Hybrid Approach: Extract Logic for Unit Testing

The best strategy often combines both approaches. Extract testable logic from views:

### Before (Hard to Unit Test)

```rust
pub struct CalculatorView {
    display: String,
    operand: f64,
    operator: Option<char>,
}

impl CalculatorView {
    pub fn press_digit(&mut self, digit: char) {
        // Complex logic mixed with UI state
        if self.display == "0" {
            self.display = digit.to_string();
        } else {
            self.display.push(digit);
        }
        // More logic...
    }
}
```

### After (Easy to Unit Test)

```rust
// src/calculator_logic.rs - Pure logic, unit testable
pub struct CalculatorState {
    pub display: String,
    pub operand: f64,
    pub operator: Option<char>,
}

impl CalculatorState {
    pub fn press_digit(&mut self, digit: char) {
        if self.display == "0" {
            self.display = digit.to_string();
        } else {
            self.display.push(digit);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_press_digit_replaces_zero() {
        let mut state = CalculatorState::default();
        state.press_digit('5');
        assert_eq!(state.display, "5");
    }
}
```

```rust
// src/calculator_view.rs - Thin UI wrapper
pub struct CalculatorView {
    state: CalculatorState,
}

impl CalculatorView {
    pub fn press_digit(&mut self, digit: char) {
        self.state.press_digit(digit);
    }
}
```

```rust
// tests/calculator_view_tests.rs - Integration tests for UI behavior
#[gpui::test]
async fn test_digit_button_updates_display(cx: &mut TestAppContext) {
    let window = cx.add_window(|_window, cx| CalculatorView::new(cx));
    cx.run_until_parked();

    let bounds = cx.debug_bounds("btn-5").unwrap();
    cx.simulate_click(bounds.center(), gpui::Modifiers::none());
    cx.run_until_parked();

    window
        .update(cx, |view, _window, _cx| {
            assert_eq!(view.state.display, "5");
        })
        .unwrap();
}
```

## File Organization

```
src/
  lib.rs                    # Exports for integration tests
  main.rs                   # Entry point
  calculator_logic.rs       # Pure logic with inline #[test]
  calculator_view.rs        # UI component (Render impl)
tests/
  calculator_view_tests.rs  # GPUI integration tests
```

## Summary

| Aspect | `#[test]` | `#[gpui::test]` |
|--------|-----------|-----------------|
| Speed | Fast | Slower (GPUI overhead) |
| Location | Same file or `tests/` | Must be in `tests/` |
| Async | Optional | Required |
| UI interactions | No | Yes |
| Entity/Context | No | Yes |
| Complexity | Low | Higher |

**Rule of thumb**: If you can test it without GPUI context, use `#[test]`. If you need windows, entities, or user interactions, use `#[gpui::test]`.
