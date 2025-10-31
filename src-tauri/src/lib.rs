use tauri::Manager;

#[tauri::command]
fn log_to_file(message: String) {
  println!("[PIXSAUR] {}", message);
}

#[tauri::command]
fn open_debug_window(app: tauri::AppHandle) {
  use tauri::Manager;
  let _ = app.get_webview_window("debug").unwrap().show();
}

pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_process::init())
    .invoke_handler(tauri::generate_handler![log_to_file, open_debug_window])
    .setup(|app| {
      // Enable logging in debug builds or when PIXSAUR_DEBUG env var is set
      if cfg!(debug_assertions) || std::env::var("PIXSAUR_DEBUG").is_ok() {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }

      // Get main window
      let main_window = app.get_webview_window("main").unwrap();

      // Show main window immediately
      main_window.show().unwrap();

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
