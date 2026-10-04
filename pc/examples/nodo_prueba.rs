//! Un "aparato" de prueba: la copia principal + Nexo en 127.0.0.1, sirviendo la app. Varios a la
//! vez (cada uno con su puerto y carpeta) se encuentran por una carpeta compartida, sin mDNS ni
//! red: así se prueba en una sola PC el recorrido completo app → copia → Nexo → copia → app.
//! Lo usa app/e2e/nexo.spec.ts.
//!
//!   cargo run --example nodo_prueba -- <carpeta> <web> <puerto> <nombre> <carpeta-de-anuncios>
use mi_bodega::nodo::Red;
use mi_bodega::servidor::{iniciar_nexo, preparar_en, servir};
use nexo::{Descubrimiento, EventoVecino, Vecino};
use nexo_red::error::Resultado;
use std::collections::BTreeMap;
use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc;

/// Cada anuncio es un archivo `<instancia>.json` en `dir`; buscar es mirar la carpeta.
struct DescubrimientoCarpeta {
    dir: PathBuf,
}

impl Descubrimiento for DescubrimientoCarpeta {
    fn anunciar(&self, instancia: &str, puerto: u16, txt: BTreeMap<String, String>) -> Resultado<()> {
        let v = serde_json::json!({"instancia": instancia, "puerto": puerto, "txt": txt});
        let _ = std::fs::write(self.dir.join(format!("{instancia}.json")), v.to_string());
        Ok(())
    }

    fn retirar(&self, instancia: &str) -> Resultado<()> {
        let _ = std::fs::remove_file(self.dir.join(format!("{instancia}.json")));
        Ok(())
    }

    fn buscar(&self) -> Resultado<mpsc::Receiver<EventoVecino>> {
        let (tx, rx) = mpsc::channel(256);
        let dir = self.dir.clone();
        std::thread::spawn(move || {
            let mut vistos: BTreeMap<String, String> = BTreeMap::new();
            loop {
                let mut ahora = BTreeMap::new();
                for e in std::fs::read_dir(&dir).into_iter().flatten().flatten() {
                    if let Ok(t) = std::fs::read_to_string(e.path()) {
                        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&t) {
                            ahora.insert(v["instancia"].as_str().unwrap_or("").to_string(), t);
                        }
                    }
                }
                for (inst, t) in &ahora {
                    if vistos.get(inst) != Some(t) {
                        let v: serde_json::Value = serde_json::from_str(t).unwrap();
                        let txt = serde_json::from_value(v["txt"].clone()).unwrap_or_default();
                        let vecino = Vecino {
                            instancia: inst.clone(),
                            direcciones: vec![[127, 0, 0, 1].into()],
                            puerto: v["puerto"].as_u64().unwrap_or(0) as u16,
                            txt,
                        };
                        if tx.blocking_send(EventoVecino::Visto(vecino)).is_err() {
                            return;
                        }
                    }
                }
                for inst in vistos.keys() {
                    if !ahora.contains_key(inst) && tx.blocking_send(EventoVecino::Perdido(inst.clone())).is_err() {
                        return;
                    }
                }
                vistos = ahora;
                std::thread::sleep(Duration::from_millis(300));
            }
        });
        Ok(rx)
    }
}

fn main() {
    let a: Vec<String> = std::env::args().collect();
    let [_, dir, web, puerto, nombre, anuncios] = &a[..] else {
        eprintln!("uso: nodo_prueba <carpeta> <web> <puerto> <nombre> <carpeta-de-anuncios>");
        std::process::exit(2);
    };
    let base = PathBuf::from(dir);
    std::fs::create_dir_all(anuncios).unwrap();
    let (s, server) =
        preparar_en("127.0.0.1", base.join("datos"), PathBuf::from(web), &base.join("clave.txt"), puerto.parse().unwrap()).unwrap();
    let red = Red {
        descubrimiento: Some(Arc::new(DescubrimientoCarpeta { dir: PathBuf::from(anuncios) })),
        direccion: Some("127.0.0.1:0".parse().unwrap()),
    };
    iniciar_nexo(&s, base.join("nexo"), nombre.clone(), red);
    println!("listo {}", s.puerto);
    servir(s, server);
}
