//! Window and application-level integration tests

use canopy::RootView;
use gpui::TestAppContext;

#[gpui::test]
async fn test_multiple_windows_have_independent_views(cx: &mut TestAppContext) {
    let window1 = cx.add_window(|_window, cx| RootView::new(cx));
    let window2 = cx.add_window(|_window, cx| RootView::new(cx));
    cx.run_until_parked();

    let sidebar1_id = window1
        .update(cx, |root, _window, _cx| root.sidebar.entity_id())
        .unwrap();

    let sidebar2_id = window2
        .update(cx, |root, _window, _cx| root.sidebar.entity_id())
        .unwrap();

    assert_ne!(sidebar1_id, sidebar2_id, "Each window should have its own sidebar");
}

#[gpui::test]
async fn test_app_context_update(cx: &mut TestAppContext) {
    let mut counter = 0;

    cx.update(|_app| {
        counter += 1;
    });

    assert_eq!(counter, 1);
}

#[gpui::test]
async fn test_run_until_parked_processes_tasks(cx: &mut TestAppContext) {
    let window = cx.add_window(|_window, cx| RootView::new(cx));

    // Before run_until_parked, pending tasks may not be complete
    cx.run_until_parked();

    // After run_until_parked, window should be fully initialized
    let result = window.update(cx, |_root, _window, _cx| true);
    assert!(result.is_ok());
}
