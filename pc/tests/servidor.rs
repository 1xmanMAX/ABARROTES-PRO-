use mi_bodega::carpeta::Carpeta;
use mi_bodega::cifrado::Clave;
use mi_bodega::servidor::{fecha, Sincro};
use serde_json::json;

fn sincro(dir: &std::path::Path) -> Sincro {
    let web = dir.join("web");
    std::fs::create_dir_all(&web).unwrap();
    std::fs::write(web.join("index.html"), "<html><head><script src=\"a.js\"></script></head></html>").unwrap();
    std::fs::write(web.join("a.js"), "1").unwrap();
    let (clave, clave_b64) = Clave::nueva();
    Sincro { carpeta: Carpeta::nueva(dir.join("datos")), clave, clave_b64, puerto: 47482, web }
}

fn prueba(s: &Sincro, url: &str) -> String {
    s.clave.cifrar_json(&json!({ "ruta": url }))
}

#[test]
fn fechas_utc() {
    assert_eq!(fecha(0), "1970-01-01");
    assert_eq!(fecha(951_782_400_000), "2000-02-29");
    assert_eq!(fecha(1_791_072_000_000), "2026-10-04");
}

#[test]
fn la_app_solo_se_sirve_a_esta_pc_y_lleva_el_codigo() {
    let t = tempfile::tempdir().unwrap();
    let s = sincro(t.path());
    assert_eq!(s.atender("GET", "/", None, &[], false).estado, 403);
    let r = s.atender("GET", "/", None, &[], true);
    assert_eq!(r.estado, 200);
    assert!(!r.cors);
    let html = String::from_utf8(r.cuerpo).unwrap();
    let i = html.find("window.miBodegaPc").unwrap();
    assert!(i < html.find("a.js").unwrap(), "se inyecta antes del primer script");
    assert!(html.contains("mibodega-sync://127.0.0.1:47482/#"));
    assert!(html.contains("<svg"));
    assert_eq!(s.atender("GET", "/a.js", None, &[], true).cuerpo, b"1");
    assert_eq!(s.atender("GET", "/../secreto.txt", None, &[], true).estado, 400);
    assert_eq!(s.atender("GET", "/no-existe.js", None, &[], true).estado, 404);
}

#[test]
fn sincronizar_exige_la_clave() {
    let t = tempfile::tempdir().unwrap();
    let s = sincro(t.path());
    assert_eq!(s.atender("GET", "/sync/hola", None, &[], true).estado, 401);
    let (otra, _) = Clave::nueva();
    let ajena = otra.cifrar_json(&json!({ "ruta": "/sync/hola" }));
    assert_eq!(s.atender("GET", "/sync/hola", Some(&ajena), &[], false).estado, 401);
    let r = s.atender("GET", "/sync/hola", Some(&prueba(&s, "/sync/hola")), &[], false);
    assert_eq!(r.estado, 200);
    assert!(r.cors);
    let v = s.clave.descifrar_json(std::str::from_utf8(&r.cuerpo).unwrap()).unwrap();
    assert_eq!(v["app"], "mibodega-sincro");
}

#[test]
fn leer_escribir_y_respaldo_diario() {
    let t = tempfile::tempdir().unwrap();
    let s = sincro(t.path());
    let leer = |base: Option<&str>| {
        let cuerpo = s.clave.cifrar_json(&json!({ "dispositivo": "ap_1", "nombre": "Celular", "base": base }));
        let r = s.atender("POST", "/sync/v2/leer", Some(&prueba(&s, "/sync/v2/leer")), cuerpo.as_bytes(), false);
        assert_eq!(r.estado, 200);
        s.clave.descifrar_json(std::str::from_utf8(&r.cuerpo).unwrap()).unwrap()
    };
    let r = leer(None);
    assert_eq!(r["modo"], "completo");
    assert_eq!(r["datos"]["products"], json!([]));

    let escribir = |etiqueta: &serde_json::Value, datos: serde_json::Value| {
        let cuerpo = s.clave.cifrar_json(&json!({ "dispositivo": "ap_1", "etiqueta": etiqueta, "datos": datos }));
        s.atender("POST", "/sync/v2/escribir", Some(&prueba(&s, "/sync/v2/escribir")), cuerpo.as_bytes(), false).estado
    };
    let datos = json!({ "products": [{ "id": "p1", "name": "Arroz", "stock": 5 }], "sales": [], "movements": [], "settings": [] });
    assert_eq!(escribir(&r["etiqueta"], datos.clone()), 200);
    // Con la etiqueta vieja: la PC cambió entre medio.
    assert_eq!(escribir(&r["etiqueta"], datos.clone()), 409);

    let huella = mi_bodega::parche::huella(&datos);
    let r2 = leer(Some(&huella));
    assert_eq!(r2["modo"], "parche");
    assert_eq!(r2["parche"], json!([]));

    // Segundo cambio: antes se respalda lo que había.
    let mas = json!({ "products": [{ "id": "p1", "name": "Arroz", "stock": 4 }] });
    assert_eq!(escribir(&r2["etiqueta"], mas), 200);
    let respaldos: Vec<_> = std::fs::read_dir(t.path().join("datos/respaldos")).unwrap().collect();
    assert_eq!(respaldos.len(), 1);
    let guardado: serde_json::Value = serde_json::from_slice(&std::fs::read(t.path().join("datos/products.json")).unwrap()).unwrap();
    assert_eq!(guardado[0]["stock"], 4);
}
