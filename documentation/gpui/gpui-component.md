# GPUI Component Documentation

`gpui-component` is a library of 60+ pre-built, stateless UI components for GPUI. It is inspired by shadcn/ui and provides a modern look and feel for desktop applications.

## Quick Start

### 1. Initialization
You MUST initialize the library in your main entry point:

```rust
fn main() {
    Application::new().run(|cx: &mut App| {
        // Initialize gpui-component
        gpui_component::init(cx);
        
        cx.open_window(WindowOptions::default(), |window, cx| {
            let view = cx.new(|cx| RootView::new(cx));
            // Wrap your main view in a gpui_component::Root
            cx.new(|cx| Root::new(view, window, cx))
        })
        .unwrap();
    });
}
```

### 2. Basic Component Usage
Components in `gpui-component` are stateless and follow a builder pattern.

```rust
use gpui_component::button::*;

// Inside a render function:
Button::new("my-button")
    .primary()
    .label("Click Me")
    .on_click(|_, _, _| println!("Clicked!"))
```

## Key Components

| Component | Usage |
|-----------|-------|
| `Button` | Standard buttons with `primary()`, `outline()`, `ghost()` variants. |
| `Input` | Text input fields. |
| `Checkbox` | Boolean toggles. |
| `Select` | Dropdown menus. |
| `Table` | Virtualized tables for large datasets. |
| `List` | Virtualized lists. |
| `Root` | Mandatory wrapper for the window content. |
| `Icon` | SVG icon support (requires local SVG files matching `IconName`). |
| `GroupBox` | Visual container with an optional label. |
| `Tag` | Small labels for categories or status. |
| `Collapsible` | Toggleable content visibility. |
| `DropdownMenu` | Contextual or navigation menus. |
| `Progress` | Progress bars. |
| `Tab` / `TabBar` | For tabbed interfaces. |
| `Kbd` | Visual representation of keyboard shortcuts. |
| `Markdown` | Native markdown rendering (`gpui_component::text::markdown`). |
| `Html` | Basic HTML rendering (`gpui_component::text::html`). |
| `Spinner` | Loading indicators. |
| `Resizable` | Layouts with draggable resize handles. |

## Layout Utilities

`gpui-component` provides its own versions of flex layout utilities that integrate better with its theme system:

- `h_flex()`: Horizontal flex container.
- `v_flex()`: Vertical flex container.

## Themes

The library has a built-in theme system. You can access the active theme using:

```rust
use gpui_component::ActiveTheme;

let theme = cx.theme();
let colors = theme.colors();
```

## Guidelines for AI Agents

To create "delightful" UIs with `gpui-component`, follow these patterns:

### 1. Use the Builder Pattern
Always chain methods to configure components. Most components support `.size(Size::Sm)`, `.variant()`, etc.

### 2. Layout with Flex
Prefer using GPUI's built-in flex methods (`v_flex()`, `h_flex()`, `gap_2()`) to arrange `gpui-component` elements.

### 3. Consistent Sizing
Use standard sizes across your UI for consistency: `Size::Xs`, `Size::Sm`, `Size::Md`, `Size::Lg`.

### 4. Handling Icons
Icons are not bundled. Ensure your project has the required SVGs in the assets folder and they match the expected naming convention in `IconName`.

### 5. Root Wrapper
NEVER forget to wrap your top-level window view in `gpui_component::Root`. It handles themes, overlays, and other global UI states.

## Example: A "Delightful" Settings Panel

```rust
fn render_settings(&mut self, cx: &mut ViewContext<Self>) -> impl IntoElement {
    v_flex()
        .gap_4()
        .p_4()
        .child(
            h_flex()
                .justify_between()
                .child(div().child("Notifications").font_weight(FontWeight::BOLD))
                .child(Checkbox::new("notif-toggle").checked(true))
        )
        .child(
            Button::new("save")
                .primary()
                .label("Save Changes")
                .w_full()
        )
}
```
