//! La carpeta de datos en la PC: un JSON por colección (la copia principal de Mi Bodega),
//! `.sincro/` con la base de cada aparato y `respaldos/<fecha>/` con una copia por día.
//! Adaptado de Canvas de Citas (receptor/sincro/src/carpeta.rs).
use serde_json::{json, Map, Value};
use sha2::{Digest, Sha256};
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

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
}

impl Carpeta {
    pub fn nueva(raiz: impl Into<PathBuf>) -> Self {
        Carpeta { raiz: raiz.into() }
    }

    fn archivo(&self, col: &str) -> PathBuf {
        self.raiz.join(format!("{col}.json"))
    }

    fn bytes(&self, col: &str) -> Vec<u8> {
        fs::read(self.archivo(col)).unwrap_or_default()
    }

    /// Cambia cada vez que cambia cualquiera de los JSON (detecta ediciones concurrentes).
    pub fn etiqueta(&self) -> String {
        let mut h = Sha256::new();
        for c in COLECCIONES {
            h.update(c.as_bytes());
            h.update(self.bytes(c));
        }
        h.finalize().iter().map(|b| format!("{b:02x}")).collect()
    }

    fn coleccion(&self, col: &str) -> io::Result<Value> {
        let b = self.bytes(col);
        if b.is_empty() {
            return Ok(json!([]));
        }
        let v: Value = serde_json::from_slice(&b).map_err(|e| io::Error::new(io::ErrorKind::InvalidData, format!("{col}.json: {e}")))?;
        Ok(if v.is_array() { v } else { json!([]) })
    }

    /// `{products, sales, movements, settings}`.
    pub fn leer(&self) -> io::Result<Value> {
        let mut m = Map::new();
        for c in COLECCIONES {
            m.insert(c.into(), self.coleccion(c)?);
        }
        Ok(Value::Object(m))
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
        self.respaldar(hoy)?;
        for c in COLECCIONES {
            if let Some(items) = datos.get(c) {
                self.escribir_atomico(&self.archivo(c), &Self::json_bonito(items)?)?;
            }
        }
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
