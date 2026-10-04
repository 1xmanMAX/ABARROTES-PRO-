//! Cómo encuentra Nexo a los demás aparatos en Android: con NsdManager (el mDNS del sistema), a
//! través de `NsdPuente.java`. Es lo que usa la biblioteca Android de Nexo (DescubrimientoNsd.kt);
//! el mDNS en Rust puro no es confiable en los celulares. Los avisos de Java vuelven por
//! `NsdPuente.visto` / `NsdPuente.perdido` (funciones nativas de abajo).
use jni::objects::{GlobalRef, JObject, JString, JValue};
use jni::sys::jint;
use jni::{JNIEnv, JavaVM};
use nexo::{Descubrimiento, EventoVecino, Vecino};
use nexo_red::error::Resultado;
use std::collections::BTreeMap;
use std::net::IpAddr;
use std::sync::Mutex;
use tokio::sync::mpsc;

/// Adónde van los vecinos que encuentra Java (el nodo de Nexo escucha la otra punta).
static OYENTE: Mutex<Option<mpsc::Sender<EventoVecino>>> = Mutex::new(None);

pub struct DescubrimientoNsd {
    pub vm: JavaVM,
    pub puente: GlobalRef,
}

impl DescubrimientoNsd {
    /// Llama a `NsdPuente` desde cualquier hilo (se engancha a la JVM si hace falta). Lo creado
    /// dentro de `f` se libera al terminar (marco local de JNI).
    fn con_java(&self, f: impl FnOnce(&mut JNIEnv) -> jni::errors::Result<()>) {
        let Ok(mut env) = self.vm.attach_current_thread() else { return };
        let _ = env.with_local_frame(8, |env| f(env));
        if env.exception_check().unwrap_or(false) {
            let _ = env.exception_clear();
        }
    }
}

impl Descubrimiento for DescubrimientoNsd {
    fn anunciar(&self, instancia: &str, puerto: u16, txt: BTreeMap<String, String>) -> Resultado<()> {
        let txt = serde_json::to_string(&txt).unwrap_or_else(|_| "{}".into());
        self.con_java(|env| {
            let (i, t) = (env.new_string(instancia)?, env.new_string(&txt)?);
            let args = [JValue::Object(&i), JValue::Object(&t), JValue::Int(i32::from(puerto))];
            env.call_method(&self.puente, "anunciar", "(Ljava/lang/String;Ljava/lang/String;I)V", &args)?;
            Ok(())
        });
        Ok(())
    }

    fn retirar(&self, instancia: &str) -> Resultado<()> {
        self.con_java(|env| {
            let i = env.new_string(instancia)?;
            env.call_method(&self.puente, "retirar", "(Ljava/lang/String;)V", &[JValue::Object(&i)])?;
            Ok(())
        });
        Ok(())
    }

    fn buscar(&self) -> Resultado<mpsc::Receiver<EventoVecino>> {
        let (tx, rx) = mpsc::channel(256);
        *OYENTE.lock().unwrap_or_else(|e| e.into_inner()) = Some(tx);
        self.con_java(|env| env.call_method(&self.puente, "buscar", "()V", &[]).map(|_| ()));
        Ok(rx)
    }

    fn dejar_de_buscar(&self) {
        self.con_java(|env| env.call_method(&self.puente, "dejarDeBuscar", "()V", &[]).map(|_| ()));
    }
}

fn avisar(e: EventoVecino) {
    if let Some(tx) = OYENTE.lock().unwrap_or_else(|e| e.into_inner()).as_ref() {
        let _ = tx.try_send(e);
    }
}

fn leer(env: &mut JNIEnv, s: &JString) -> String {
    env.get_string(s).map(|t| t.into()).unwrap_or_default()
}

/// Java encontró un aparato: `direcciones` es un JSON `["192.168.1.5", …]` y `txt` un objeto.
#[no_mangle]
pub extern "system" fn Java_pe_mibodega_app_NsdPuente_visto<'a>(
    mut env: JNIEnv<'a>,
    _puente: JObject<'a>,
    instancia: JString<'a>,
    direcciones: JString<'a>,
    txt: JString<'a>,
    puerto: jint,
) {
    let instancia = leer(&mut env, &instancia);
    let direcciones: Vec<IpAddr> = serde_json::from_str::<Vec<String>>(&leer(&mut env, &direcciones))
        .unwrap_or_default()
        .iter()
        .filter_map(|d| d.parse().ok())
        .collect();
    let txt: BTreeMap<String, String> = serde_json::from_str(&leer(&mut env, &txt)).unwrap_or_default();
    let Ok(puerto) = u16::try_from(puerto) else { return };
    if direcciones.is_empty() {
        return;
    }
    avisar(EventoVecino::Visto(Vecino { instancia, direcciones, puerto, txt }));
}

#[no_mangle]
pub extern "system" fn Java_pe_mibodega_app_NsdPuente_perdido<'a>(mut env: JNIEnv<'a>, _puente: JObject<'a>, instancia: JString<'a>) {
    avisar(EventoVecino::Perdido(leer(&mut env, &instancia)));
}
