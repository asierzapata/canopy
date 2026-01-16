//! Tests for RootView

use canopy::{RootView, SidebarView};
use gpui::TestAppContext;

#[gpui::test]
async fn test_creation(cx: &mut TestAppContext) {
    let window = cx.add_window(|_window, cx| RootView::new(cx));
    cx.run_until_parked();

    window
        .update(cx, |root_view, _window, _cx| {
            assert!(root_view.sidebar.entity_id().as_u64() > 0);
        })
        .unwrap();
}

#[gpui::test]
async fn test_contains_sidebar(cx: &mut TestAppContext) {
    let window = cx.add_window(|_window, cx| RootView::new(cx));
    cx.run_until_parked();

    window
        .update(cx, |root_view, _window, cx| {
            // Access the sidebar entity - verifies it exists and is readable
            let _sidebar: &SidebarView = root_view.sidebar.read(cx);
        })
        .unwrap();
}

#[gpui::test]
async fn test_sidebar_persists_across_updates(cx: &mut TestAppContext) {
    let window = cx.add_window(|_window, cx| RootView::new(cx));
    cx.run_until_parked();

    let id1 = window
        .update(cx, |root, _window, _cx| root.sidebar.entity_id())
        .unwrap();

    let id2 = window
        .update(cx, |root, _window, _cx| root.sidebar.entity_id())
        .unwrap();

    assert_eq!(id1, id2, "Sidebar entity should persist across updates");
}
