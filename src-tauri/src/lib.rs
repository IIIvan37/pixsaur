use tauri::{Manager, Listener, Emitter, CustomMenuItem, Menu, MenuItem, Submenu};
use tauri_plugin_updater::UpdaterExt;
use serde_json;

#[tauri::command]
fn log_to_file(message: String) {
  println!("[PIXSAUR] {}", message);
}

#[tauri::command]
fn open_debug_window(app: tauri::AppHandle) {
  use tauri::Manager;
  let _ = app.get_webview_window("debug").unwrap().show();
}

#[tauri::command]
async fn test_updater(app: tauri::AppHandle) -> Result<String, String> {
  println!("[PIXSAUR] Testing updater from main window");

  let updater = app.updater().map_err(|e| format!("Failed to get updater: {:?}", e))?;
  println!("[PIXSAUR] Updater obtained, checking for updates...");
  match updater.check().await {
    Ok(update) => {
      println!("[PIXSAUR] Updater check completed");
      if let Some(update) = update {
        println!("[PIXSAUR] Update available: {}", update.version);
        Ok(format!("{{\"available\": true, \"version\": \"{}\"}}", update.version))
      } else {
        println!("[PIXSAUR] No updates available");
        Ok("{\"available\": false}".to_string())
      }
    }
    Err(e) => {
      println!("[PIXSAUR] Updater check failed: {:?}", e);
      Err(format!("Updater check failed: {:?}", e))
    }
  }
}

pub fn run() {
  tauri::Builder::default()
    // Add a small native menu with a Quit action so users can exit the
    // application even when the window has no decorations / close button.
    .menu({
      let quit = CustomMenuItem::new("quit".to_string(), "Quit").accelerator("CmdOrCtrl+Q");
      let file = Menu::new().add_item(quit);
      Menu::new().add_submenu(Submenu::new("File", file))
    })
    .on_menu_event(|event| {
      match event.menu_item_id() {
        "quit" => {
          // Quit the entire application with success code 0
          event.window().app_handle().exit(0);
        }
        _ => {}
      }
    })
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_updater::Builder::new().build())
    .plugin(tauri_plugin_process::init())
    .plugin(tauri_plugin_shell::init())
    .invoke_handler(tauri::generate_handler![log_to_file, open_debug_window, test_updater])
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

      // Quit app when main window is closed
      let app_handle = app.handle().clone();
      main_window.on_window_event(move |event| {
        if let tauri::WindowEvent::CloseRequested { .. } = event {
          app_handle.exit(0);
        }
      });

      // Listen for debug window requests
      let app_handle = app.handle().clone();
      let main_window_clone = main_window.clone();
      tauri::async_runtime::spawn(async move {
        let main_window_for_listener = main_window_clone.clone();
        let _listener = main_window_clone.listen("debug-request", move |event| {
          println!("[PIXSAUR] Received debug request: {}", event.payload());

          if let Ok(payload) = serde_json::from_str::<serde_json::Value>(event.payload()) {
            if let Some(action) = payload.get("action").and_then(|a| a.as_str()) {
              if action == "TEST_UPDATER" {
                let app_handle = app_handle.clone();
                let main_window = main_window_for_listener.clone();

                tauri::async_runtime::spawn(async move {
                  let updater_result = app_handle.updater();
                  match updater_result {
                    Ok(updater) => {
                      match updater.check().await {
                        Ok(update) => {
                          let result = if let Some(update) = update {
                            println!("[PIXSAUR] Update available: {}", update.version);
                            format!("{{\"available\": true, \"version\": \"{}\"}}", update.version)
                          } else {
                            println!("[PIXSAUR] No updates available");
                            "{\"available\": false}".to_string()
                          };

                          let _ = main_window.emit("debug-response", serde_json::json!({
                            "result": serde_json::from_str::<serde_json::Value>(&result).unwrap_or(serde_json::json!({"error": "Parse error"}))
                          }));
                        }
                        Err(e) => {
                          println!("[PIXSAUR] Updater check failed: {:?}", e);
                          let _ = main_window.emit("debug-response", serde_json::json!({
                            "error": format!("{:?}", e)
                          }));
                        }
                      }
                    }
                    Err(e) => {
                      println!("[PIXSAUR] Failed to get updater: {:?}", e);
                      let _ = main_window.emit("debug-response", serde_json::json!({
                        "error": format!("Failed to get updater: {:?}", e)
                      }));
                    }
                  }
                });
              }
            }
          }
        });
      });

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
