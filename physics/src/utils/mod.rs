// physics/src/utils/mod.rs

use wasm_bindgen::prelude::*;

pub fn set_panic_hook() {
    // Better error messages in the browser console
    console_error_panic_hook::set_once();
}

#[wasm_bindgen]
extern "C" {
    #[wasm_bindgen(js_namespace = console)]
    pub fn log(s: &str);
}

#[macro_export]
macro_rules! console_log {
    ($($t:tt)*) => ($crate::utils::log(&format!($($t)*)))
}