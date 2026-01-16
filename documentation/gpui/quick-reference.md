# GPUI Quick Reference

## Core Types

- **App** - Application entry point
- **View** - Local UI state + rendering
- **Model** - Shared business logic state
- **Context Types**: `AppContext`, `WindowContext`, `ViewContext<T>`, `ModelContext<T>`

## State Management Rules

- **View** = UI-only state (selection, scroll, local forms)
- **Model** = Shared/business state (data, background processes)
- Always call `cx.notify()` after mutations to trigger re-render
- Clone `Model<T>` freely (cheap Arc), share one instance across views

## Testing

GPUI testing is performed using the `#[gpui::test]` macro and `TestAppContext`. See `documentation/testing.md` for a full guide.

- `cx.simulate_keystroke("key")` - Simulate typing
- `cx.simulate_click(point, modifiers)` - Simulate clicking
- `cx.run_until_parked()` - Wait for async/rendering tasks to settle
- `cx.debug_bounds("id")` - Get bounds of an element for interaction

## Essential Methods

### Creating Things

```
cx.new_view(|cx| MyView { })
cx.new_model(|cx| MyModel { })
cx.open_window(options, |cx| { })
```

### Updating State

```
model.update(cx, |data, cx| { data.field = value; cx.notify(); })
view.update(&mut cx, |view, cx| { view.field = value; cx.notify(); })
```

### Reading State

```
model.read(cx).field
```

### Async Work

```
cx.spawn(|view, mut cx| async move {
    let result = work().await;
    view.update(&mut cx, |v, cx| { v.result = result; cx.notify(); }).ok();
})
```

### Observing Changes

```
cx.observe(&model, |view, model, cx| { cx.notify(); })
cx.subscribe(&model, |view, model, event, cx| { })
```

## Rendering Primitives

**Container**: `div()`
**Methods**: `.child()`, `.children()`, `.when()`, `.when_some()`

## GPUI Component (New)

The project uses `gpui-component` for pre-built UI elements.
- **Docs**: `documentation/gpui/gpui-component.md`
- **Init**: `gpui_component::init(cx)` in `main`
- **Root**: Wrap window content in `Root::new(view, window, cx)`

## Layout & Styling

**Flexbox**: `.flex()`, `.flex_col()`, `.flex_row()`, `.flex_1()`
**Spacing**: `.gap_2()`, `.p_4()`, `.m_2()`, `.px_2()`, `.py_1()`
**Sizing**: `.w_full()`, `.h(px(200))`, `.min_w()`, `.max_w()`, `.relative(0.5)`
**Colors**: `.bg(rgb(0x1e1e1e))`, `.text_color()`, `.border_color()`
**Borders**: `.border_1()`, `.rounded_md()`, `.rounded_lg()`
**Overflow**: `.overflow_y_scroll()`, `.overflow_hidden()`

## Events

**Click**: `.on_click(cx.listener(|view, _event, cx| { }))`
**Keyboard**: `.on_key_down(cx.listener(|view, event, cx| { }))`
**Actions**:

```
actions!(namespace, [ActionName]);
cx.bind_keys([KeyBinding::new("cmd-enter", ActionName, Some("context"))]);
cx.on_action(Self::action_handler);
```

## Common Patterns

**Conditional**:

```
.when(condition, |el| el.child("shown"))
```

**List**:

```
.children(items.iter().map(|i| div().child(i)))
```

**Selected Item**:

```
.when(is_selected, |el| el.bg(selected_color))
```

**Theme Colors**:

```
cx.theme().colors().background
```

## Executors

- `cx.background_executor()` - CPU work, I/O
- `cx.foreground_executor()` - Main thread only

## Subscription Lifecycle

Store subscriptions in view: `_subscription: Subscription` (dropped = unsubscribed)

## Critical Rules

1. **Always `cx.notify()` after state changes**
2. **Never block UI thread** - use `cx.spawn()` for I/O
3. **Model updates need `model.update()`** - can't mutate directly
4. **Handle dropped views** - use `.ok()` on `view.update()` in async
5. **Key contexts** - set with `.key_context("name")` for scoped shortcuts

## Debugging Checklist

- [ ] Did you call `cx.notify()`?
- [ ] Is async work in `cx.spawn()`?
- [ ] Are subscriptions stored (not dropped)?
- [ ] Using correct context type?
- [ ] Model wrapped in `Model<T>`, not raw?

## Common Imports

```
use gpui::*;
use gpui::{actions, div, px, rgb, relative};
```
