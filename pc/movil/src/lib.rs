//! Mi Bodega dentro del APK: la misma copia principal que en la PC (servidor /sync en
//! 127.0.0.1, solo para la propia app) más Nexo, que la sincroniza con los demás aparatos del
//! grupo por el Wi-Fi. La app web se sincroniza con esta copia exactamente como con la PC.
//!
//! Desde Java: `NodoPlugin.iniciarNodo(dir, nombre, puente)` →
//! `{"codigo": "mibodega-sync://127.0.0.1:…"}` o `{"error": "…"}`. Se puede llamar varias
//! veces: arranca una sola vez. `puente` (NsdPuente.java) es cómo Nexo encuentra a los demás.
mod nsd;

use jni::objects::{JClass, JObject, JString};
use jni::sys::jstring;
use jni::JNIEnv;
use mi_bodega::nodo::Red;
use mi_bodega::servidor::{iniciar_nexo, preparar_en, servir};
use serde_json::json;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

static CODIGO: Mutex<Option<String>> = Mutex::new(None);

fn iniciar(dir: &str, nombre: &str, red: Red) -> Result<String, String> {
    let mut codigo = CODIGO.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(c) = codigo.as_ref() {
        return Ok(c.clone());
    }
    let base = PathBuf::from(dir);
    // Puerto 0: uno libre. Solo 127.0.0.1: nadie de la red habla con esta copia salvo por Nexo.
    let (s, server) = preparar_en("127.0.0.1", base.join("datos"), base.join("web"), &base.join("clave.txt"), 0)
        .map_err(|e| format!("No se pudo abrir la copia local: {e}"))?;
    let c = s.codigo_con("127.0.0.1");
    iniciar_nexo(&s, base.join("nexo"), nombre.to_string(), red);
    std::thread::spawn(move || servir(s, server));
    *codigo = Some(c.clone());
    Ok(c)
}

fn texto(env: &mut JNIEnv, s: &JString) -> String {
    env.get_string(s).map(|t| t.into()).unwrap_or_default()
}

#[no_mangle]
pub extern "system" fn Java_pe_mibodega_app_NodoPlugin_iniciarNodo<'a>(
    mut env: JNIEnv<'a>,
    _clase: JClass<'a>,
    dir: JString<'a>,
    nombre: JString<'a>,
    puente: JObject<'a>,
) -> jstring {
    let (dir, nombre) = (texto(&mut env, &dir), texto(&mut env, &nombre));
    let red = match (env.get_java_vm(), env.new_global_ref(&puente)) {
        (Ok(vm), Ok(puente)) => Red { descubrimiento: Some(Arc::new(nsd::DescubrimientoNsd { vm, puente })), direccion: None },
        // Sin el puente, mDNS en Rust (menos confiable en celulares, pero algo es algo).
        _ => Red::default(),
    };
    let r = match std::panic::catch_unwind(std::panic::AssertUnwindSafe(move || iniciar(&dir, &nombre, red))) {
        Ok(Ok(codigo)) => json!({ "codigo": codigo }),
        Ok(Err(e)) => json!({ "error": e }),
        Err(_) => json!({ "error": "Falló el arranque de la sincronización" }),
    };
    env.new_string(r.to_string()).map(|s| s.into_raw()).unwrap_or(std::ptr::null_mut())
}
