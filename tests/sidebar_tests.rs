//! Tests for SidebarView

use canopy::SidebarView;
use gpui::TestAppContext;

#[gpui::test]
async fn test_creation(cx: &mut TestAppContext) {
    let window = cx.add_window(|_window, _cx| SidebarView {});
    cx.run_until_parked();

    window
        .update(cx, |_sidebar, _window, _cx| {
            // SidebarView created successfully
        })
        .unwrap();
}

#[gpui::test]
async fn test_multiple_instances_are_independent(cx: &mut TestAppContext) {
    let window1 = cx.add_window(|_window, _cx| SidebarView {});
    let window2 = cx.add_window(|_window, _cx| SidebarView {});
    cx.run_until_parked();

    // Both windows should exist and be accessible independently
    window1.update(cx, |_, _, _| {}).unwrap();
    window2.update(cx, |_, _, _| {}).unwrap();
}
