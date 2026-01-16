use gpui::*;

pub struct SidebarView {}

impl Render for SidebarView {
    fn render(&mut self, _window: &mut Window, _cx: &mut Context<Self>) -> impl IntoElement {
        div()
            .id("sidebar")
            .flex()
            .flex_col()
            .w(px(240.0))
            .h_full()
            .bg(rgb(0x2d2d2d))
            .border_r_1()
            .border_color(rgb(0x1e1e1e))
            .p_4()
            .text_color(rgb(0xffffff))
            .child("Sidebar")
    }
}
