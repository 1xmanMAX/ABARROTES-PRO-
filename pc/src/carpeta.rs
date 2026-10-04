//! La carpeta de datos en la PC: un JSON por colección (la copia principal de Mi Bodega),
//! `.sincro/` con la base de cada aparato y `respaldos/<fecha>/` con una copia por día.
//! Adaptado de Canvas de Citas (receptor/sincro/src/carpeta.rs).
//!
//! Los datos se leen una vez y quedan en memoria: los aparatos los leen y escriben enteros (por
//! HTTP) y Nexo registro por registro. Lo que escribe Nexo se guarda al disco en tandas
//! (`guardar_pendientes`).
use serde_json::{json, Map, Value};
use std::collections::BTreeSet;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};

/// Las mismas tablas que `SYNC_TABLES` en app/src/sync/local.ts (y en el mismo orden).
pub const COLECCIONES: [&str; 17] = [
    "products",
    "tickets",
    "ticketLines",
    "stockMovements",
    "cashMovements",
    "auditLog",
    "parties",
    "ledgerEntries",
    "signatures",
    "consignments",
    "consignmentLines",
    "settlements",
    "settlementLines",
    "purchases",
    "purchaseLines",
    "dayCloses",
    "settings",
];

/// Cuántos días de respaldo se guardan.
const DIAS_DE_RESPALDO: usize = 30;

pub struct Carpeta {
    pub raiz: PathBuf,
    memoria: Mutex<Option<Memoria>>,
}

/// La copia principal en memoria.
struct Memoria {
    /// Colección → lista de registros (cada uno con `id`).
    datos: Map<String, Value>,
    /// Sube con cada cambio: la etiqueta que detecta ediciones concurrentes.
    generacion: u64,
    /// Colecciones con cambios de Nexo todavía sin guardar al disco.
    sucias: BTreeSet<&'static str>,
}

/// Distinto en cada arranque: una etiqueta vieja nunca coincide con una nueva.
fn arranque() -> &'static str {
    static A: OnceLock<String> = OnceLock::new();
    A.get_or_init(|| {
        let mut b = [0u8; 6];
        let _ = getrandom::getrandom(&mut b);
        b.iter().map(|x| format!("{x:02x}")).collect()
    })
}

fn coleccion_valida(col: &str) -> io::Result<&'static str> {
    COLECCIONES
        .iter()
        .copied()
        .find(|c| *c == col)
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, format!("colección desconocida: {col}")))
}

fn id_de(v: &Value) -> Option<&str> {
    v.get("id")?.as_str()
}

impl Carpeta {
    pub fn nueva(raiz: impl Into<PathBuf>) -> Self {
        Carpeta { raiz: raiz.into(), memoria: Mutex::new(None) }
    }

    /// Ejecuta `f` con los datos en memoria (los carga del disco la primera vez).
    fn con_memoria<T>(&self, f: impl FnOnce(&mut Memoria) -> T) -> io::Result<T> {
        let mut g = self.memoria.lock().unwrap_or_else(|e| e.into_inner());
        if g.is_none() {
            let mut datos = Map::new();
            for c in COLECCIONES {
                datos.insert(c.into(), self.coleccion(c)?);
            }
            *g = Some(Memoria { datos, generacion: 0, sucias: BTreeSet::new() });
        }
        Ok(f(g.as_mut().expect("cargada")))
    }

    fn archivo(&self, col: &str) -> PathBuf {
        self.raiz.join(format!("{col}.json"))
    }

    fn bytes(&self, col: &str) -> Vec<u8> {
        fs::read(self.archivo(col)).unwrap_or_default()
    }

    /// Cambia cada vez que cambian los datos (detecta ediciones concurrentes).
    pub fn etiqueta(&self) -> String {
        let generacion = self.con_memoria(|m| m.generacion).unwrap_or(u64::MAX);
        format!("{}-{generacion}", arranque())
    }

    fn coleccion(&self, col: &str) -> io::Result<Value> {
        let b = self.bytes(col);
        if b.is_empty() {
            return Ok(json!([]));
        }
        let v: Value = serde_json::from_slice(&b).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, format!("{col}.json: {e}")))?;
        Ok(if v.is_array() { v } else { json!([]) })
    }

    /// Todas las colecciones: `{products, tickets, …}`.
    pub fn leer(&self) -> io::Result<Value> {
        self.con_memoria(|m| {
            let mut out = Map::new();
            for c in COLECCIONES {
                out.insert(c.into(), m.datos.get(c).cloned().unwrap_or_else(|| json!([])));
            }
            Value::Object(out)
        })
    }

    /// Los ids de una colección (para Nexo).
    pub fn ids(&self, col: &str) -> io::Result<Vec<String>> {
        let col = coleccion_valida(col)?;
        self.con_memoria(|m| m.datos[col].as_array().map(|l| l.iter().filter_map(id_de).map(String::from).collect()).unwrap_or_default())
    }

    /// Un registro (para Nexo).
    pub fn registro(&self, col: &str, id: &str) -> io::Result<Option<Value>> {
        let col = coleccion_valida(col)?;
        self.con_memoria(|m| m.datos[col].as_array().and_then(|l| l.iter().find(|x| id_de(x) == Some(id)).cloned()))
    }

    /// Pone (o reemplaza) un registro que llegó por Nexo. Queda pendiente de guardar al disco.
    pub fn poner_registro(&self, col: &str, valor: Value) -> io::Result<()> {
        let col = coleccion_valida(col)?;
        let id = id_de(&valor).ok_or_else(|| io::Error::new(io::ErrorKind::InvalidData, "registro sin id"))?.to_string();
        self.con_memoria(|m| {
            let lista = m.datos[col].as_array_mut().expect("lista");
            match lista.iter().position(|x| id_de(x) == Some(id.as_str())) {
                Some(i) if lista[i] == valor => return,
                Some(i) => lista[i] = valor,
                None => lista.push(valor),
            }
            m.generacion += 1;
            m.sucias.insert(col);
        })
    }

    /// Quita un registro que se borró en otro aparato (Nexo).
    pub fn quitar_registro(&self, col: &str, id: &str) -> io::Result<()> {
        let col = coleccion_valida(col)?;
        self.con_memoria(|m| {
            let lista = m.datos[col].as_array_mut().expect("lista");
            let antes = lista.len();
            lista.retain(|x| id_de(x) != Some(id));
            if lista.len() != antes {
                m.generacion += 1;
                m.sucias.insert(col);
            }
        })
    }

    /// Guarda al disco lo que llegó por Nexo (una vez por tanda, no por registro).
    pub fn guardar_pendientes(&self, hoy: &str) -> io::Result<()> {
        let pendientes = self.con_memoria(|m| {
            let cols = std::mem::take(&mut m.sucias);
            cols.into_iter().map(|c| (c, m.datos[c].clone())).collect::<Vec<_>>()
        })?;
        if pendientes.is_empty() {
            return Ok(());
        }
        self.respaldar(hoy)?;
        for (c, items) in &pendientes {
            if let Err(e) = self.escribir_atomico(&self.archivo(c), &Self::json_bonito(items)?) {
                // Que se reintente en la próxima tanda.
                let _ = self.con_memoria(|m| m.sucias.extend(pendientes.iter().map(|(c, _)| *c)));
                return Err(e);
            }
        }
        Ok(())
    }

    fn escribir_atomico(&self, destino: &Path, datos: &[u8]) -> io::Result<()> {
        if let Some(p) = destino.parent() {
            fs::create_dir_all(p)?;
        }
        let tmp = destino.with_extension("tmp-sincro");
        fs::write(&tmp, datos)?;
        fs::rename(&tmp, destino)
    }

    fn json_bonito(v: &Value) -> io::Result<Vec<u8>> {
        let mut txt = serde_json::to_string_pretty(v)?;
        txt.push('\n');
        Ok(txt.into_bytes())
    }

    /// Escribe solo las colecciones presentes en `datos`. Antes del primer cambio de cada día
    /// guarda una copia de lo que había (`respaldos/AAAA-MM-DD/`).
    pub fn escribir(&self, datos: &Value, hoy: &str) -> io::Result<()> {
        // Primero lo pendiente de Nexo: así el respaldo del día y los archivos quedan al día.
        self.guardar_pendientes(hoy)?;
        self.respaldar(hoy)?;
        for c in COLECCIONES {
            if let Some(items) = datos.get(c) {
                self.escribir_atomico(&self.archivo(c), &Self::json_bonito(items)?)?;
                self.con_memoria(|m| {
                    m.datos.insert(c.into(), items.clone());
                    m.sucias.remove(c);
                })?;
            }
        }
        self.con_memoria(|m| m.generacion += 1)?;
        Ok(())
    }

    fn respaldar(&self, hoy: &str) -> io::Result<()> {
        let dir = self.raiz.join("respaldos");
        let destino = dir.join(hoy);
        if destino.exists() || COLECCIONES.iter().all(|c| !self.archivo(c).exists()) {
            return Ok(());
        }
        fs::create_dir_all(&destino)?;
        for c in COLECCIONES {
            if self.archivo(c).exists() {
                fs::copy(self.archivo(c), destino.join(format!("{c}.json")))?;
            }
        }
        let mut dias: Vec<PathBuf> = fs::read_dir(&dir)?.flatten().map(|d| d.path()).filter(|p| p.is_dir()).collect();
        dias.sort();
        if dias.len() > DIAS_DE_RESPALDO {
            for viejo in &dias[..dias.len() - DIAS_DE_RESPALDO] {
                let _ = fs::remove_dir_all(viejo);
            }
        }
        Ok(())
    }

    // --- Grupo de sincronización: en `.sincro/` ---

    fn dir_sincro(&self) -> PathBuf {
        self.raiz.join(".sincro")
    }

    /// Id de aparato válido (lo genera la app): letras, números, `_` y `-`.
    pub fn id_valido(id: &str) -> bool {
        !id.is_empty() && id.len() <= 64 && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '_' || c == '-')
    }

    /// Los datos tal como quedaron en la última sincronización de ese aparato.
    pub fn base_de(&self, id: &str) -> Option<Value> {
        if !Self::id_valido(id) {
            return None;
        }
        serde_json::from_slice(&fs::read(self.dir_sincro().join(format!("base-{id}.json"))).ok()?).ok()
    }

    pub fn guardar_base(&self, id: &str, datos: &Value) -> io::Result<()> {
        if !Self::id_valido(id) {
            return Err(io::Error::new(io::ErrorKind::InvalidInput, "id de aparato inválido"));
        }
        self.escribir_atomico(&self.dir_sincro().join(format!("base-{id}.json")), &serde_json::to_vec(datos)?)
    }

    /// `[{id, nombre, visto, sincronizado}]` de los aparatos que se han conectado.
    pub fn grupo(&self) -> Value {
        fs::read(self.dir_sincro().join("grupo.json")).ok().and_then(|b| serde_json::from_slice(&b).ok()).unwrap_or_else(|| json!([]))
    }

    /// Anota que el aparato se conectó (y, si `sincronizo`, que terminó una sincronización).
    pub fn anotar_aparato(&self, id: &str, nombre: &str, ahora_ms: u64, sincronizo: bool) -> io::Result<()> {
        if !Self::id_valido(id) {
            return Ok(());
        }
        let mut g = self.grupo();
        let Some(lista) = g.as_array_mut() else { return Ok(()) };
        let i = match lista.iter().position(|a| a["id"] == id) {
            Some(i) => i,
            None => {
                lista.push(json!({"id": id}));
                lista.len() - 1
            }
        };
        let a = &mut lista[i];
        let nombre: String = nombre.chars().take(60).collect();
        if !nombre.trim().is_empty() {
            a["nombre"] = json!(nombre.trim());
        }
        a["visto"] = json!(ahora_ms);
        if sincronizo {
            a["sincronizado"] = json!(ahora_ms);
        }
        self.escribir_atomico(&self.dir_sincro().join("grupo.json"), &Self::json_bonito(&g)?)
    }
}
