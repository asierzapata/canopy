#![recursion_limit = "2048"]

mod sidebar;

use gpui::*;
use sidebar::SidebarView;

struct RootView {
    sidebar: Entity<SidebarView>,
}

impl RootView {
    fn new(cx: &mut Context<Self>) -> Self {
        Self {
            sidebar: cx.new(|_| SidebarView {}),
        }
    }
}

impl Render for RootView {
    fn render(&mut self, _window: &mut Window, _cx: &mut Context<Self>) -> impl IntoElement {
        div()
            .id("root-view")
            .size_full()
            .flex()
            .flex_row()
            .bg(rgb(0x1e1e1e))
            .child(self.sidebar.clone())
            .child(
                div()
                    .flex_1()
                    .h_full()
                    .flex()
                    .justify_center()
                    .items_center()
                    .text_color(rgb(0xcccccc))
                    .child("Main Content Area"),
            )
    }
}

fn main() {
    Application::new().run(|cx: &mut App| {
        cx.open_window(WindowOptions::default(), |_, cx| {
            cx.new(|cx| RootView::new(cx))
        })
        .unwrap();
    });
}

#[cfg(test)]
mod tests {
    use super::*;
    // use gpui::TestAppContext;

    // #[gpui::test]
    // async fn test_root_layout(cx: &mut gpui::TestAppContext) {
    //     cx.add_window(|_, cx| cx.new(|cx| RootView::new(cx)));

    //     // Verify sidebar is rendered
    //     cx.run_until_parked();
    //     assert!(cx.debug_bounds("sidebar").is_some());
    //     assert!(cx.debug_bounds("root-view").is_some());
    // }
}
