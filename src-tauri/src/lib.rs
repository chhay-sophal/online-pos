use tauri::Manager;
use tauri_plugin_shell::ShellExt;
use tauri_plugin_shell::process::{CommandChild, CommandEvent};
use std::sync::Mutex;

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
        // Kill any stale backend-server left over from a previous crash or session.
        #[cfg(target_os = "windows")]
        let _ = std::process::Command::new("taskkill")
          .args(["/F", "/IM", "backend-server-x86_64-pc-windows-msvc.exe"])
          .output();
        #[cfg(target_os = "macos")]
        let _ = std::process::Command::new("pkill")
          .args(["-f", "backend-server-aarch64-apple-darwin"])
          .output();
        #[cfg(target_os = "linux")]
        let _ = std::process::Command::new("pkill")
          .args(["-f", "backend-server-x86_64-unknown-linux-gnu"])
          .output();

        let shell = app.shell();
        let (mut rx, child) = shell
          .sidecar("backend-server")
          .expect("backend-server sidecar not found")
          .spawn()
          .expect("failed to spawn backend-server");

        // Forward sidecar stdout/stderr to the main process output.
        tauri::async_runtime::spawn(async move {
          while let Some(event) = rx.recv().await {
            match event {
              CommandEvent::Stdout(line) => {
                print!("[backend] {}", String::from_utf8_lossy(&line));
              }
              CommandEvent::Stderr(line) => {
                eprint!("[backend] {}", String::from_utf8_lossy(&line));
              }
              _ => {}
            }
          }
        });

        // Store the child handle so we can kill it cleanly when the window closes.
        app.manage(Mutex::new(Some(child)));
      }

      Ok(())
    })
    .on_window_event(|window, event| {
      if let tauri::WindowEvent::Destroyed = event {
        if let Some(state) = window.app_handle().try_state::<Mutex<Option<CommandChild>>>() {
          if let Ok(mut guard) = state.lock() {
            if let Some(child) = guard.take() {
              let _ = child.kill();
            }
          }
        }
      }
    })
    .plugin(tauri_plugin_shell::init())
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
