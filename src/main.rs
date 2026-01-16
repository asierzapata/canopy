use canopy::RootView;
use gpui::*;

fn main() {
    Application::new().run(|cx: &mut App| {
        cx.open_window(WindowOptions::default(), |_, cx| {
            cx.new(|cx| RootView::new(cx))
        })
        .unwrap();
    });
}
