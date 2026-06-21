use tauri_plugin_shell::ShellExt;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .setup(|app| {
      app.handle().plugin(
        tauri_plugin_log::Builder::default()
          .level(log::LevelFilter::Info)
          .build(),
      )?;

      if !cfg!(debug_assertions) {
        // In release builds, spawn the bundled backend sidecar and pipe its output to the log.
        let shell = app.shell();
        let (_rx, _child) = shell
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
