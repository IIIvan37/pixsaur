#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  use tauri::Manager;
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_process::init())
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // Create splash screen window programmatically
      let splashscreen_window = tauri::WebviewWindowBuilder::new(
        app,
        "splashscreen",
        tauri::WebviewUrl::App("splashscreen.html".into())
      )
      .title("Pixsaur")
      .inner_size(400.0, 300.0)
      .decorations(false)
      .transparent(true)
      .center()
      .always_on_top(true)
      .skip_taskbar(true)
      .build()
      .unwrap();

      // Get main window
      let main_window = app.get_webview_window("main").unwrap();

      // Show splash screen
      splashscreen_window.show().unwrap();

      // Close splash screen after a short delay to show the main window
      let splashscreen_window_clone = splashscreen_window.clone();
      let main_window_clone = main_window.clone();

      std::thread::spawn(move || {
        std::thread::sleep(std::time::Duration::from_secs(2));
        if let Err(e) = splashscreen_window_clone.close() {
          eprintln!("Failed to close splash screen: {}", e);
        }
        if let Err(e) = main_window_clone.show() {
          eprintln!("Failed to show main window: {}", e);
        }
      });

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
