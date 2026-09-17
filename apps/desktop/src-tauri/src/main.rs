// Windows 릴리스 빌드에서 콘솔 창을 띄우지 않는다 (macOS에는 영향 없음)
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    nodii_lib::run()
}
