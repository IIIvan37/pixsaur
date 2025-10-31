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
    .plugin(tauri_plugin_global_shortcut::Builder::new().build())
    .invoke_handler(tauri::generate_handler![log_to_file, open_debug_window])
    .setup(|app| {
      // Enable logging in debug builds or when PIXSAUR_DEBUG env var is set
      if cfg!(debug_assertions) || std::env::var("PIXSAUR_DEBUG").is_ok() {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .target(tauri_plugin_log::Target::new(
              tauri_plugin_log::Target::Kind::LogDir { file_name: Some("pixsaur.log".to_string()) },
            ))
            .target(tauri_plugin_log::Target::new(
              tauri_plugin_log::Target::Kind::Stdout,
            ))
            .build(),
        )?;
      }

      // Setup global shortcut for debug window
      let app_handle = app.handle().clone();
      app.global_shortcut().register("F12", move || {
        let _ = app_handle.get_webview_window("debug").unwrap().show();
      })?;

      // Get main window
      let main_window = app.get_webview_window("main").unwrap();

      // Show main window immediately
      main_window.show().unwrap();

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
