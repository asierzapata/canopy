pub mod sidebar;

use gpui::*;
pub use sidebar::SidebarView;

pub struct RootView {
    pub sidebar: Entity<SidebarView>,
}

impl RootView {
    pub fn new(cx: &mut Context<Self>) -> Self {
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
