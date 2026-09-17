// Rust 셸은 OS 연동(창, 메뉴, 저장소)만 맡는다. 데이터 처리는 모두 TypeScript (설계서 §1 원칙 3)

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_store::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .run(tauri::generate_context!())
        .expect("error while running Nodii");
}
