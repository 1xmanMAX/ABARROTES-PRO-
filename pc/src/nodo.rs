//! Nexo (THE-WORLD-NEX) dentro de Mi Bodega: sincroniza la copia principal de este aparato con
//! los demás aparatos del grupo, por la red local y sin servidor. Cada registro (una venta, un
//! producto…) viaja por separado; si dos aparatos cambian el mismo, se fusiona campo a campo.
//!
//! La app (la web) sigue hablando con la copia principal por /sync/v2 como siempre; Nexo la
//! lee y escribe registro por registro con [`AlmacenBodega`]. Lo derivado (stock, saldos) lo
//! recalcula la app en cada aparato al sincronizar, así que siempre converge.
use crate::carpeta::{Carpeta, COLECCIONES};
use crate::cifrado::ahora_ms;
use nexo::{AlmacenApp, Coleccion, Config, Descubrimiento, Disparo, ErrorNexo, Evento, Nexo, Politica, Reglas};
use serde_json::{json, Value};
use std::net::SocketAddr;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;

/// Nombre de la app en Nexo: solo se sincronizan aparatos de Mi Bodega.
pub const APP: &str = "mi-bodega";

/// Más cambios que esto de una vez: se revisa todo en vez de avisar uno por uno.
const AVISOS_SUELTOS: usize = 2000;

/// Bloqueo compartido con /sync/v2/escribir: Nexo no escribe en medio de un guardado.
pub type Candado = &'static Mutex<()>;

/// Cómo encuentra Nexo a los demás. Por defecto, mDNS en la red local; las pruebas usan una red
/// en memoria y 127.0.0.1.
#[derive(Default, Clone)]
pub struct Red {
    pub descubrimiento: Option<Arc<dyn Descubrimiento>>,
    pub direccion: Option<SocketAddr>,
}

/// La copia principal vista por Nexo: colección = tabla, registro = fila con `id`.
pub struct AlmacenBodega {
    pub carpeta: Arc<Carpeta>,
    pub candado: Candado,
}

impl AlmacenApp for AlmacenBodega {
    fn listar(&self, coleccion: &str) -> Result<Vec<String>, String> {
        self.carpeta.ids(coleccion).map_err(|e| e.to_string())
    }

    fn leer(&self, coleccion: &str, id: &str) -> Result<Option<Vec<u8>>, String> {
        let r = self.carpeta.registro(coleccion, id).map_err(|e| e.to_string())?;
        Ok(r.map(|v| serde_json::to_vec(&v).expect("JSON")))
    }

    fn escribir(&self, coleccion: &str, id: &str, json: &[u8]) -> Result<(), String> {
        let v: Value = serde_json::from_slice(json).map_err(|e| e.to_string())?;
        if v.get("id").and_then(Value::as_str) != Some(id) {
            return Err(format!("{coleccion}/{id}: el registro no trae su id"));
        }
        let _c = self.candado.lock().unwrap_or_else(|e| e.into_inner());
        self.carpeta.poner_registro(coleccion, v).map_err(|e| e.to_string())
    }

    fn borrar(&self, coleccion: &str, id: &str) -> Result<(), String> {
        let _c = self.candado.lock().unwrap_or_else(|e| e.into_inner());
        self.carpeta.quitar_registro(coleccion, id).map_err(|e| e.to_string())
    }
}

/// Reglas de fusión: si dos aparatos cambian el mismo campo, gana el registro modificado más
/// tarde (`updatedAt`). Los cachés (stock, saldos) se recalculan después en la app.
fn colecciones() -> Vec<Coleccion> {
    let reglas = Reglas { desempate: vec!["updatedAt".into(), "createdAt".into()], ..Reglas::default() };
    COLECCIONES.iter().map(|c| Coleccion { nombre: (*c).into(), politica: Politica::Fusion3(reglas.clone()) }).collect()
}

/// Texto para la persona (los de Nexo van sin tildes y en términos técnicos).
pub fn mensaje(e: &ErrorNexo) -> String {
    match e {
        ErrorNexo::NoEnGrupo => "Este aparato todavía no está en un grupo.".into(),
        ErrorNexo::NadieALaVista => {
            "No se encontró ningún aparato del grupo. ¿Están en el mismo Wi-Fi y con Mi Bodega abierta?".into()
        }
        ErrorNexo::CodigoIncorrecto => "El código no es correcto. Revísalo en el otro aparato.".into(),
        ErrorNexo::Limite => "Demasiados intentos. Espera un minuto y vuelve a probar.".into(),
        ErrorNexo::Expulsado => "Este aparato fue sacado del grupo.".into(),
        ErrorNexo::VersionIncompatible => "Los aparatos tienen versiones distintas: actualiza Mi Bodega en todos.".into(),
        ErrorNexo::Ocupado => "Ya se está sincronizando con ese aparato.".into(),
        ErrorNexo::Detenido => "La sincronización está detenida.".into(),
        ErrorNexo::Red(m) => format!("Problema de red: {m}"),
        otro => otro.to_string(),
    }
}

/// Lo último que pasó, para la pantalla.
#[derive(Default)]
struct Ultimo {
    sincro_ms: Option<u64>,
    par: Option<String>,
    aplicados: usize,
    error: Option<String>,
}

pub struct NodoNexo {
    pub nexo: Nexo,
    /// Sube cuando Nexo trae cambios de otro aparato (la app lo mira para sincronizarse).
    pub cambios: Arc<AtomicU64>,
    ultimo: Arc<Mutex<Ultimo>>,
    vistos: Arc<Mutex<Vec<String>>>,
}

impl NodoNexo {
    /// Abre Nexo en `dir`. En Windows la identidad del aparato queda cifrada con DPAPI; en
    /// Android, en un archivo privado de la app.
    pub fn abrir(dir: PathBuf, nombre: &str, carpeta: Arc<Carpeta>, candado: Candado, red: Red) -> Result<NodoNexo, ErrorNexo> {
        let mut config = Config::nueva(dir, APP, nombre);
        config.colecciones = colecciones();
        config.disparo = Disparo::Automatico { pausa_ms: 1500 };
        config.direccion = red.direccion;
        let nexo = Nexo::abrir(config, Arc::new(AlmacenBodega { carpeta, candado }), red.descubrimiento, None)?;
        let cambios = Arc::new(AtomicU64::new(0));
        let ultimo = Arc::new(Mutex::new(Ultimo::default()));
        let vistos = Arc::new(Mutex::new(Vec::new()));
        {
            let (cambios, ultimo, vistos) = (cambios.clone(), ultimo.clone(), vistos.clone());
            nexo.suscribir(move |e| match e {
                Evento::SincroFin(inf) => {
                    if inf.aplicados > 0 {
                        cambios.fetch_add(1, Ordering::SeqCst);
                    }
                    let mut u = ultimo.lock().unwrap_or_else(|e| e.into_inner());
                    u.sincro_ms = Some(ahora_ms());
                    u.par = Some(inf.par.clone());
                    u.aplicados = inf.aplicados;
                    u.error = None;
                }
                Evento::Error { mensaje, .. } => {
                    ultimo.lock().unwrap_or_else(|e| e.into_inner()).error = Some(mensaje);
                }
                Evento::ParVisto(id) => {
                    let mut v = vistos.lock().unwrap_or_else(|e| e.into_inner());
                    if !v.contains(&id) {
                        v.push(id);
                    }
                }
                Evento::ParPerdido(id) => vistos.lock().unwrap_or_else(|e| e.into_inner()).retain(|x| *x != id),
                Evento::GrupoCambiado => {
                    cambios.fetch_add(1, Ordering::SeqCst);
                }
            });
        }
        // Lo que cambió con Nexo cerrado (o todo, la primera vez).
        let _ = nexo.revisar();
        Ok(NodoNexo { nexo, cambios, ultimo, vistos })
    }

    /// Avisa a Nexo de los registros que cambió la app (fuera de cualquier candado).
    pub fn avisar(&self, cambios: &[(String, String)]) {
        if cambios.len() > AVISOS_SUELTOS {
            let _ = self.nexo.revisar();
            return;
        }
        for (col, id) in cambios {
            let _ = self.nexo.notificar_cambio(col, id);
        }
    }

    /// Estado para la pantalla de la app.
    pub fn estado(&self) -> Value {
        let g = match self.nexo.estado_grupo() {
            Ok(g) => g,
            Err(e) => return json!({"activo": true, "error": mensaje(&e)}),
        };
        let pares: Vec<String> = self.nexo.pares().into_iter().map(|(id, _)| id).collect();
        let vistos = self.vistos.lock().unwrap_or_else(|e| e.into_inner()).clone();
        let u = self.ultimo.lock().unwrap_or_else(|e| e.into_inner());
        let miembros: Vec<Value> = g
            .miembros
            .iter()
            .map(|m| json!({"id": m.id, "nombre": m.nombre, "yo": m.yo, "aLaVista": m.yo || pares.contains(&m.id) || vistos.contains(&m.id)}))
            .collect();
        let direccion = self.nexo.direccion().ok().map(|a| format!("{}:{}", crate::servidor::ip_local(), a.port()));
        json!({
            "activo": true,
            "enGrupo": g.en_grupo,
            "codigo": g.codigo,
            "yo": g.yo,
            "miembros": miembros,
            "direccion": direccion,
            "cambios": self.cambios.load(Ordering::SeqCst),
            "ultimaSincro": u.sincro_ms,
            "ultimoPar": u.par,
            "ultimosAplicados": u.aplicados,
            "ultimoError": u.error,
        })
    }

    /// Una orden de la pantalla (`crear`, `unirse`, `expulsar`…). Devuelve JSON o un mensaje.
    pub fn orden(&self, orden: &str, datos: &Value) -> Result<Value, String> {
        let texto = |k: &str| datos[k].as_str().unwrap_or("").trim().to_string();
        let r = match orden {
            "crear" => self.nexo.crear_grupo().map(|c| json!({"codigo": c})),
            "unirse" => {
                let codigo = texto("codigo");
                let ip = texto("ip");
                if ip.is_empty() {
                    self.nexo.unirse(&codigo).map(|_| json!({}))
                } else {
                    let addr = if ip.contains(':') { ip.clone() } else { format!("{ip}:47500") };
                    let addr = addr.parse().map_err(|_| "La dirección no es válida (ejemplo: 192.168.1.5:47500).".to_string())?;
                    self.nexo.unirse_en(addr, &codigo).map(|_| json!({}))
                }
            }
            "expulsar" => self.nexo.expulsar(&texto("id")).map(|_| json!({})),
            "renovar" => self.nexo.renovar_codigo().map(|c| json!({"codigo": c})),
            "salir" => self.nexo.salir_del_grupo().map(|_| json!({})),
            "renombrar" => self.nexo.renombrar(&texto("nombre")).map(|_| json!({})),
            "sincronizar" => {
                let informes = self.nexo.sincronizar_ahora();
                let errores: Vec<String> = informes.iter().filter_map(|r| r.as_ref().err().map(mensaje)).collect();
                let aplicados: usize = informes.iter().filter_map(|r| r.as_ref().ok()).map(|i| i.aplicados).sum();
                if informes.is_empty() {
                    return Err("No hay otro aparato del grupo a la vista.".into());
                }
                if aplicados > 0 {
                    self.cambios.fetch_add(1, Ordering::SeqCst);
                }
                return Ok(json!({"aparatos": informes.len(), "aplicados": aplicados, "errores": errores}));
            }
            _ => return Err("Orden desconocida".into()),
        };
        r.map_err(|e| mensaje(&e))
    }

    /// Guarda al disco cada segundo lo que llegó por Nexo.
    pub fn guardar_cada_segundo(carpeta: Arc<Carpeta>, candado: Candado) {
        std::thread::spawn(move || loop {
            std::thread::sleep(Duration::from_secs(1));
            let _c = candado.lock().unwrap_or_else(|e| e.into_inner());
            let _ = carpeta.guardar_pendientes(&crate::servidor::fecha(ahora_ms()));
        });
    }
}

/// Registros que cambiaron entre `antes` y `despues` en las colecciones `cols` (para avisar a
/// Nexo): nuevos, distintos o quitados.
pub fn diferencias(antes: &Value, despues: &Value, cols: &[&str]) -> Vec<(String, String)> {
    use std::collections::HashMap;
    let mut out = vec![];
    for c in cols {
        let indice = |v: &Value| -> HashMap<String, Value> {
            v[*c].as_array()
                .map(|l| l.iter().filter_map(|x| Some((x.get("id")?.as_str()?.to_string(), x.clone()))).collect())
                .unwrap_or_default()
        };
        let (a, d) = (indice(antes), indice(despues));
        for (id, v) in &d {
            if a.get(id) != Some(v) {
                out.push(((*c).to_string(), id.clone()));
            }
        }
        for id in a.keys() {
            if !d.contains_key(id) {
                out.push(((*c).to_string(), id.clone()));
            }
        }
    }
    out
}
