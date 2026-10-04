//! Dos aparatos con Mi Bodega sincronizados por Nexo, como en la tienda: lo que la app guarda en
//! uno (por /sync/v2) aparece en el otro, y si los dos cambian el mismo producto se juntan.
use mi_bodega::cifrado::Clave;
use mi_bodega::nodo::{NodoNexo, Red};
use mi_bodega::servidor::{Sincro, ESCRITURA};
use nexo::DescubrimientoMemoria;
use serde_json::{json, Value};
use std::path::Path;
use std::sync::Arc;
use std::time::{Duration, Instant};

fn aparato(dir: &Path, nombre: &str, red: &DescubrimientoMemoria) -> Arc<Sincro> {
    let (clave, clave_b64) = Clave::nueva();
    let s = Arc::new(Sincro::nuevo(dir.join("datos"), clave, clave_b64, 47482, dir.join("web")));
    let red = Red { descubrimiento: Some(Arc::new(red.clone())), direccion: Some("127.0.0.1:0".parse().unwrap()) };
    let n = NodoNexo::abrir(dir.join("nexo"), nombre, s.carpeta.clone(), &ESCRITURA, red).unwrap();
    NodoNexo::guardar_cada_segundo(s.carpeta.clone(), &ESCRITURA);
    assert!(s.nexo.set(Arc::new(n)).is_ok());
    s
}

/// Una petición cifrada como las de la app; devuelve (estado, respuesta descifrada).
fn pedir(s: &Sincro, ruta: &str, cuerpo: Value) -> (u16, Value) {
    let prueba = s.clave.cifrar_json(&json!({ "ruta": ruta }));
    let r = s.atender("POST", ruta, Some(&prueba), s.clave.cifrar_json(&cuerpo).as_bytes(), false);
    let v = s.clave.descifrar_json(std::str::from_utf8(&r.cuerpo).unwrap()).unwrap_or(Value::Null);
    (r.estado, v)
}

/// Lo que hace la app al sincronizar: leer, cambiar con `f` y escribir todo.
fn guardar(s: &Sincro, f: impl Fn(&mut Value)) {
    let (estado, leido) = pedir(s, "/sync/v2/leer", json!({"dispositivo": "app", "nombre": "App", "base": null}));
    assert_eq!(estado, 200);
    let mut datos = leido["datos"].clone();
    f(&mut datos);
    let (estado, _) = pedir(s, "/sync/v2/escribir", json!({"dispositivo": "app", "etiqueta": leido["etiqueta"], "datos": datos}));
    assert_eq!(estado, 200);
}

fn esperar(mut f: impl FnMut() -> bool, segundos: u64) -> bool {
    let fin = Instant::now() + Duration::from_secs(segundos);
    while Instant::now() < fin {
        if f() {
            return true;
        }
        std::thread::sleep(Duration::from_millis(50));
    }
    f()
}

fn producto(s: &Sincro, id: &str) -> Option<Value> {
    s.carpeta.registro("products", id).unwrap()
}

#[test]
fn dos_aparatos_en_grupo_comparten_ventas_y_productos() {
    let t = tempfile::tempdir().unwrap();
    let red = DescubrimientoMemoria::default();
    let pc = aparato(&t.path().join("pc"), "PC", &red);
    let cel = aparato(&t.path().join("cel"), "Celular", &red);

    // La PC crea el grupo y el celular entra con el código (como lo teclearía la persona).
    let (_, creado) = pedir(&pc, "/sync/nexo/orden", json!({"orden": "crear"}));
    let codigo = creado["codigo"].as_str().expect("código").to_string();
    let (_, unido) = pedir(&cel, "/sync/nexo/orden", json!({"orden": "unirse", "codigo": codigo.to_lowercase()}));
    assert_eq!(unido["ok"], true, "{unido}");
    let (_, estado) = pedir(&cel, "/sync/nexo/estado", json!({}));
    assert_eq!(estado["enGrupo"], true);
    assert_eq!(estado["miembros"].as_array().unwrap().len(), 2);

    // Una venta y un producto guardados en la PC llegan al celular.
    let etiqueta_antes = pedir(&cel, "/sync/nexo/estado", json!({})).1["etiqueta"].clone();
    guardar(&pc, |d| {
        d["products"] = json!([{"id": "p1", "name": "Arroz", "salePrice": 18500, "stock": 10, "updatedAt": 1}]);
        d["tickets"] = json!([{"id": "t1", "total": 18500, "status": "paid"}]);
    });
    assert!(esperar(|| producto(&cel, "p1").is_some() && cel.carpeta.registro("tickets", "t1").unwrap().is_some(), 15));
    // La app del celular ve que llegó algo (cambia la etiqueta) y lo encuentra en /sync/v2/leer.
    let (_, estado) = pedir(&cel, "/sync/nexo/estado", json!({}));
    assert_ne!(estado["etiqueta"], etiqueta_antes);
    let (_, leido) = pedir(&cel, "/sync/v2/leer", json!({"dispositivo": "app", "nombre": "App", "base": null}));
    assert_eq!(leido["datos"]["products"][0]["name"], "Arroz");

    // Los dos cambian el mismo producto a la vez: el precio en la PC y el nombre en el celular.
    guardar(&pc, |d| {
        d["products"][0]["salePrice"] = json!(19000);
        d["products"][0]["updatedAt"] = json!(2);
    });
    guardar(&cel, |d| {
        d["products"][0]["name"] = json!("Arroz extra");
        d["products"][0]["updatedAt"] = json!(3);
    });
    let juntos = |s: &Sincro| producto(s, "p1").is_some_and(|p| p["salePrice"] == 19000 && p["name"] == "Arroz extra");
    assert!(esperar(|| juntos(&pc) && juntos(&cel), 20), "pc {:?} · cel {:?}", producto(&pc, "p1"), producto(&cel, "p1"));

    // Y queda guardado en el disco del celular (no solo en memoria).
    assert!(esperar(
        || std::fs::read_to_string(t.path().join("cel/datos/products.json")).is_ok_and(|s| s.contains("Arroz extra")),
        5
    ));

    // Expulsar: el celular sale del grupo de la PC.
    let yo_cel = pedir(&cel, "/sync/nexo/estado", json!({})).1["yo"].as_str().unwrap().to_string();
    let (_, r) = pedir(&pc, "/sync/nexo/orden", json!({"orden": "expulsar", "id": yo_cel}));
    assert_eq!(r["ok"], true, "{r}");
    assert!(esperar(|| pedir(&pc, "/sync/nexo/estado", json!({})).1["miembros"].as_array().unwrap().len() == 1, 10));
}

#[test]
fn codigo_equivocado_da_un_mensaje_claro() {
    let t = tempfile::tempdir().unwrap();
    let red = DescubrimientoMemoria::default();
    let pc = aparato(&t.path().join("pc"), "PC", &red);
    let cel = aparato(&t.path().join("cel"), "Celular", &red);
    pedir(&pc, "/sync/nexo/orden", json!({"orden": "crear"}));
    let (_, r) = pedir(&cel, "/sync/nexo/orden", json!({"orden": "unirse", "codigo": "AAAAA-BBBBB"}));
    assert!(r["error"].as_str().is_some_and(|e| e.contains("código")), "{r}");
}

#[test]
fn sin_nexo_el_estado_lo_dice() {
    let t = tempfile::tempdir().unwrap();
    let (clave, clave_b64) = Clave::nueva();
    let s = Sincro::nuevo(t.path().join("datos"), clave, clave_b64, 47482, t.path().join("web"));
    let (estado, v) = pedir(&s, "/sync/nexo/estado", json!({}));
    assert_eq!(estado, 200);
    assert_eq!(v["activo"], false);
    assert!(v["etiqueta"].is_string());
    let (_, r) = pedir(&s, "/sync/nexo/orden", json!({"orden": "crear"}));
    assert!(r["error"].is_string());
}
