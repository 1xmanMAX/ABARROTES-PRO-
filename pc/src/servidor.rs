//! Servidor HTTP de Mi Bodega en la PC. Adaptado de Canvas de Citas (receptor/sincro/src/servidor.rs).
//! - `/sync/*`: sincronización con los aparatos de la red local. Todo va cifrado con la clave de
//!   vinculación y cada petición la demuestra con la cabecera X-Bodega-Prueba.
//! - Lo demás: la app (carpeta `web/`), solo para esta misma PC. En `index.html` se inyecta
//!   `window.miBodegaPc` con el código de vinculación y su QR.
use crate::carpeta::Carpeta;
use crate::cifrado::{ahora_ms, Clave};
use crate::parche;
use serde_json::json;
use std::io::Read;
use std::net::UdpSocket;
use std::path::{Component, Path, PathBuf};
use std::sync::{Arc, Mutex};
use tiny_http::{Header, Request, Response, Server};

pub const PUERTO: u16 = 47482;
pub const TOPE_CUERPO: usize = 100 * 1024 * 1024;

/// Comprobar la etiqueta y escribir van juntos: dos guardados a la vez no pueden pasar ambos.
static ESCRITURA: Mutex<()> = Mutex::new(());

pub struct Sincro {
    pub carpeta: Carpeta,
    pub clave: Clave,
    pub clave_b64: String,
    pub puerto: u16,
    /// Carpeta con la app (index.html, storage.js, sincro/…).
    pub web: PathBuf,
}

pub struct Respuesta {
    pub estado: u16,
    pub tipo: &'static str,
    pub cuerpo: Vec<u8>,
    /// Las respuestas de /sync/* se pueden leer desde otro origen (la app del celular).
    pub cors: bool,
}

impl Respuesta {
    fn texto(estado: u16, s: String) -> Self {
        Respuesta { estado, tipo: "text/plain; charset=utf-8", cuerpo: s.into_bytes(), cors: true }
    }
    fn vacia(estado: u16) -> Self {
        Respuesta { estado, tipo: "text/plain; charset=utf-8", cuerpo: vec![], cors: true }
    }
}

/// IP de esta PC en la red local (sin enviar nada: solo elige la interfaz de salida).
pub fn ip_local() -> String {
    UdpSocket::bind("0.0.0.0:0")
        .and_then(|s| {
            s.connect("192.168.0.1:9")?;
            s.local_addr()
        })
        .map(|a| a.ip().to_string())
        .unwrap_or_else(|_| "127.0.0.1".into())
}

/// Fecha (UTC) `AAAA-MM-DD` de un instante en ms, para nombrar los respaldos.
pub fn fecha(ms: u64) -> String {
    let dias = (ms / 86_400_000) as i64;
    // Algoritmo "days from civil" al revés (Howard Hinnant).
    let z = dias + 719_468;
    let era = z.div_euclid(146_097);
    let doe = z.rem_euclid(146_097);
    let yoe = (doe - doe / 1460 + doe / 36_524 - doe / 146_096) / 365;
    let doy = doe - (365 * yoe + yoe / 4 - yoe / 100);
    let mp = (5 * doy + 2) / 153;
    let d = doy - (153 * mp + 2) / 5 + 1;
    let m = if mp < 10 { mp + 3 } else { mp - 9 };
    let y = yoe + era * 400 + i64::from(m <= 2);
    format!("{y:04}-{m:02}-{d:02}")
}

pub fn qr_svg(texto: &str) -> String {
    match qrcode::QrCode::new(texto.as_bytes()) {
        Ok(c) => {
            let svg = c.render::<qrcode::render::svg::Color>().min_dimensions(240, 240).quiet_zone(true).build();
            // Sin la declaración XML: va dentro del HTML.
            match svg.find("<svg") {
                Some(i) => svg[i..].to_string(),
                None => svg,
            }
        }
        Err(_) => String::new(),
    }
}

fn solo_datos(v: &serde_json::Value) -> serde_json::Value {
    let mut m = serde_json::Map::new();
    for c in crate::carpeta::COLECCIONES {
        m.insert(c.into(), v.get(c).cloned().unwrap_or_else(|| json!([])));
    }
    serde_json::Value::Object(m)
}

fn tipo_de(ruta: &Path) -> &'static str {
    match ruta.extension().and_then(|e| e.to_str()).unwrap_or("") {
        "html" => "text/html; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" => "application/json",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "ico" => "image/x-icon",
        "woff2" => "font/woff2",
        "webmanifest" => "application/manifest+json",
        _ => "application/octet-stream",
    }
}

impl Sincro {
    pub fn codigo_con(&self, ip: &str) -> String {
        format!("mibodega-sync://{}:{}/#{}", ip, self.puerto, self.clave_b64)
    }

    pub fn codigo(&self) -> String {
        self.codigo_con(&ip_local())
    }

    /// `prueba`: cabecera X-Bodega-Prueba. `local`: la petición viene de esta misma PC y su `Host`
    /// es 127.0.0.1/localhost (así otra página web no puede leer la app ni la clave).
    pub fn atender(&self, metodo: &str, url: &str, prueba: Option<&str>, cuerpo: &[u8], local: bool) -> Respuesta {
        if cuerpo.len() > TOPE_CUERPO {
            return Respuesta::vacia(413);
        }
        let ruta = url.split('?').next().unwrap_or("");
        if !ruta.starts_with("/sync/") {
            return self.estatico(metodo, ruta, local);
        }
        if metodo == "OPTIONS" {
            return Respuesta::vacia(204);
        }
        let autorizado = prueba
            .and_then(|p| self.clave.descifrar_json(p).ok())
            .map_or(false, |v| v["ruta"].as_str() == Some(url));
        if !autorizado {
            return Respuesta::vacia(401);
        }
        match (metodo, ruta) {
            // Liviano: el celular lo usa para encontrar la PC si cambió su IP.
            ("GET", "/sync/hola") => Respuesta::texto(200, self.clave.cifrar_json(&json!({"app": "mibodega-sincro", "v": 1}))),
            ("POST", "/sync/v2/leer") => self.leer_v2(cuerpo),
            ("POST", "/sync/v2/escribir") => self.escribir_v2(cuerpo),
            _ => Respuesta::vacia(404),
        }
    }

    fn estatico(&self, metodo: &str, ruta: &str, local: bool) -> Respuesta {
        if !local {
            return Respuesta { cors: false, ..Respuesta::vacia(403) };
        }
        if metodo != "GET" {
            return Respuesta { cors: false, ..Respuesta::vacia(405) };
        }
        if ruta == "/pc/hola" {
            return Respuesta { cors: false, ..Respuesta::texto(200, "mibodega".into()) };
        }
        let relativa = if ruta == "/" { "index.html" } else { ruta.trim_start_matches('/') };
        let relativa = PathBuf::from(relativa);
        if relativa.components().any(|c| !matches!(c, Component::Normal(_))) {
            return Respuesta { cors: false, ..Respuesta::vacia(400) };
        }
        let archivo = self.web.join(&relativa);
        let Ok(mut bytes) = std::fs::read(&archivo) else {
            return Respuesta { cors: false, ..Respuesta::vacia(404) };
        };
        if relativa == Path::new("index.html") {
            let datos = json!({"codigo": self.codigo(), "codigoLocal": self.codigo_con("127.0.0.1"), "qr": qr_svg(&self.codigo())});
            // `</` escapado: el JSON no puede cerrar la etiqueta <script>.
            let script = format!("<script>window.miBodegaPc = {};</script>\n", datos.to_string().replace("</", "<\\/"));
            let html = String::from_utf8_lossy(&bytes).replacen("<script", &format!("{script}<script"), 1);
            bytes = html.into_bytes();
        }
        Respuesta { estado: 200, tipo: tipo_de(&archivo), cuerpo: bytes, cors: false }
    }

    fn cuerpo_json(&self, cuerpo: &[u8]) -> Result<serde_json::Value, Respuesta> {
        let texto = std::str::from_utf8(cuerpo).map_err(|_| Respuesta::vacia(400))?;
        self.clave.descifrar_json(texto).map_err(|_| Respuesta::vacia(401))
    }

    fn cifrada(&self, v: serde_json::Value) -> Respuesta {
        Respuesta::texto(200, self.clave.cifrar_json(&v))
    }

    /// `{dispositivo, nombre, base}` → solo lo que cambió desde la base de ese aparato
    /// (`modo: "parche"`), o todo si no hay base común (`modo: "completo"`).
    fn leer_v2(&self, cuerpo: &[u8]) -> Respuesta {
        let pedido = match self.cuerpo_json(cuerpo) {
            Ok(v) => v,
            Err(r) => return r,
        };
        let id = pedido["dispositivo"].as_str().unwrap_or("");
        if !Carpeta::id_valido(id) {
            return Respuesta::vacia(400);
        }
        let (etiqueta, datos) = {
            let _candado = ESCRITURA.lock().unwrap_or_else(|e| e.into_inner());
            match self.carpeta.leer() {
                Ok(v) => (self.carpeta.etiqueta(), v),
                Err(e) => return Respuesta::texto(500, e.to_string()),
            }
        };
        let _ = self.carpeta.anotar_aparato(id, pedido["nombre"].as_str().unwrap_or(""), ahora_ms(), false);
        let mut r = json!({
            "etiqueta": etiqueta,
            "huella": parche::huella(&datos),
            "grupo": self.carpeta.grupo(),
        });
        match self.carpeta.base_de(id).filter(|b| pedido["base"].as_str() == Some(parche::huella(b).as_str())) {
            Some(base) => {
                r["modo"] = json!("parche");
                r["parche"] = json!(parche::diferencias(&base, &datos));
            }
            None => {
                r["modo"] = json!("completo");
                r["datos"] = datos;
            }
        }
        self.cifrada(r)
    }

    /// `{dispositivo, etiqueta, parche | datos, huella}`. El parche es sobre lo que el aparato leyó
    /// (misma etiqueta); si la PC cambió entre medio, 409. Si el resultado no da la huella
    /// esperada, 422 y no se escribe (el aparato reintenta enviando todo).
    fn escribir_v2(&self, cuerpo: &[u8]) -> Respuesta {
        let v = match self.cuerpo_json(cuerpo) {
            Ok(v) => v,
            Err(r) => return r,
        };
        let id = v["dispositivo"].as_str().unwrap_or("");
        if !Carpeta::id_valido(id) {
            return Respuesta::vacia(400);
        }
        let _candado = ESCRITURA.lock().unwrap_or_else(|e| e.into_inner());
        if v["etiqueta"].as_str() != Some(self.carpeta.etiqueta().as_str()) {
            return Respuesta::texto(409, self.clave.cifrar_json(&json!({"error": "cambio"})));
        }
        let actual = match self.carpeta.leer() {
            Ok(a) => a,
            Err(e) => return Respuesta::texto(500, e.to_string()),
        };
        // Solo se reescriben las colecciones que el parche toca.
        let (resultado, tocadas): (serde_json::Value, Vec<&str>) = if v.get("datos").is_some_and(|d| d.is_object()) {
            (solo_datos(&v["datos"]), crate::carpeta::COLECCIONES.to_vec())
        } else {
            let ops = v["parche"].as_array().cloned().unwrap_or_default();
            let mut r = actual.clone();
            if parche::aplicar(&mut r, &ops).is_err() {
                return Respuesta::texto(422, self.clave.cifrar_json(&json!({"error": "parche"})));
            }
            if v["huella"].as_str().is_some_and(|h| h != parche::huella(&r)) {
                return Respuesta::texto(422, self.clave.cifrar_json(&json!({"error": "huella"})));
            }
            let tocadas = crate::carpeta::COLECCIONES.iter().copied().filter(|c| ops.iter().any(|op| op["r"][0] == *c)).collect();
            (r, tocadas)
        };
        let mut escribir = serde_json::Map::new();
        for c in &tocadas {
            escribir.insert((*c).into(), resultado[*c].clone());
        }
        if !escribir.is_empty() {
            if let Err(e) = self.carpeta.escribir(&serde_json::Value::Object(escribir), &fecha(ahora_ms())) {
                return Respuesta::texto(500, e.to_string());
            }
        }
        if let Err(e) = self.carpeta.guardar_base(id, &resultado) {
            return Respuesta::texto(500, e.to_string());
        }
        let _ = self.carpeta.anotar_aparato(id, "", ahora_ms(), true);
        self.cifrada(json!({"etiqueta": self.carpeta.etiqueta(), "huella": parche::huella(&resultado), "escritas": tocadas, "grupo": self.carpeta.grupo()}))
    }
}

fn cabecera(k: &str, v: &str) -> Header {
    Header::from_bytes(k.as_bytes(), v.as_bytes()).expect("cabecera válida")
}

/// ¿El `Host` es esta misma PC? (contra páginas que apunten un dominio suyo a 127.0.0.1).
fn host_local(host: Option<&str>, puerto: u16) -> bool {
    host.is_some_and(|h| h == format!("127.0.0.1:{puerto}") || h == format!("localhost:{puerto}"))
}

fn atender_http(s: &Sincro, mut rq: Request) {
    let host = rq.headers().iter().find(|h| h.field.equiv("Host")).map(|h| h.value.as_str().to_string());
    let local = rq.remote_addr().map_or(false, |a| a.ip().is_loopback()) && host_local(host.as_deref(), s.puerto);
    let metodo = rq.method().to_string().to_uppercase();
    let url = rq.url().to_string();
    let prueba = rq.headers().iter().find(|h| h.field.equiv("X-Bodega-Prueba")).map(|h| h.value.as_str().to_string());
    let mut cuerpo = Vec::new();
    if rq.as_reader().take(TOPE_CUERPO as u64 + 1).read_to_end(&mut cuerpo).is_err() {
        return;
    }
    let r = s.atender(&metodo, &url, prueba.as_deref(), &cuerpo, local);
    let mut resp = Response::from_data(r.cuerpo)
        .with_status_code(r.estado)
        .with_header(cabecera("Content-Type", r.tipo))
        .with_header(cabecera("Cache-Control", "no-store"));
    if r.cors {
        resp = resp
            .with_header(cabecera("Access-Control-Allow-Origin", "*"))
            .with_header(cabecera("Access-Control-Allow-Methods", "GET, POST, OPTIONS"))
            .with_header(cabecera("Access-Control-Allow-Headers", "content-type, x-bodega-prueba"))
            .with_header(cabecera("Access-Control-Allow-Private-Network", "true"));
    }
    let _ = rq.respond(resp);
}

/// Abre el puerto. La clave se lee de `clave_archivo` o se crea (así el celular sigue vinculado).
pub fn preparar(datos: PathBuf, web: PathBuf, clave_archivo: &Path, puerto: u16) -> std::io::Result<(Arc<Sincro>, Server)> {
    let guardada = std::fs::read_to_string(clave_archivo).ok().and_then(|k| Clave::desde_base64(&k).ok().map(|c| (c, k.trim().to_string())));
    let (clave, clave_b64) = match guardada {
        Some(x) => x,
        None => {
            let (c, k) = Clave::nueva();
            if let Some(p) = clave_archivo.parent() {
                std::fs::create_dir_all(p)?;
            }
            std::fs::write(clave_archivo, &k)?;
            (c, k)
        }
    };
    let server = Server::http(("0.0.0.0", puerto)).map_err(|e| std::io::Error::new(std::io::ErrorKind::AddrInUse, e.to_string()))?;
    let puerto = server.server_addr().to_ip().map(|a| a.port()).unwrap_or(puerto);
    Ok((Arc::new(Sincro { carpeta: Carpeta::nueva(datos), clave, clave_b64, puerto, web }), server))
}

/// Atiende peticiones hasta que se cierre el servidor (un hilo por petición).
pub fn servir(s: Arc<Sincro>, server: Server) {
    for rq in server.incoming_requests() {
        let s = s.clone();
        std::thread::spawn(move || atender_http(&s, rq));
    }
}
