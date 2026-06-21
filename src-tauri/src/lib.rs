use tauri_plugin_shell::ShellExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      } else {
        // In release builds, spawn the bundled backend sidecar
        let shell = app.shell();
        shell
          .sidecar("backend-server")
          .expect("backend-server sidecar not found")
          .spawn()
          .expect("failed to spawn backend-server");
      }

      Ok(())
    })
    .plugin(tauri_plugin_shell::init())
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
