//! Parches: solo lo que cambió entre dos versiones de los datos. Mismo algoritmo que
//! `app/web/sincro/parche.js` (copiado de Canvas de Citas).
//! Operaciones: `{r, v}` poner · `{r, x: 1}` quitar · `{r, orden: [ids]}` reordenar. Cada paso de
//! la ruta `r` es una clave de objeto o `{"id": …}` (elemento de una lista por su id).
use serde_json::{json, Map, Value};
use sha2::{Digest, Sha256};
use std::collections::{HashMap, HashSet};

fn id_de(v: &Value) -> Option<&str> {
    v.as_object()?.get("id")?.as_str()
}

fn con_ids(v: &Value) -> bool {
    let Some(l) = v.as_array() else { return false };
    let mut vistos = HashSet::new();
    l.iter().all(|x| id_de(x).is_some_and(|id| vistos.insert(id)))
}

fn con(ruta: &[Value], paso: Value) -> Vec<Value> {
    let mut r = ruta.to_vec();
    r.push(paso);
    r
}

/// Operaciones que convierten `a` en `b`.
pub fn diferencias(a: &Value, b: &Value) -> Vec<Value> {
    let mut ops = vec![];
    dif(a, b, &[], &mut ops);
    ops
}

fn dif(a: &Value, b: &Value, ruta: &[Value], ops: &mut Vec<Value>) {
    if a == b {
        return;
    }
    if let (Value::Object(ma), Value::Object(mb)) = (a, b) {
        for (k, vb) in mb {
            match ma.get(k) {
                None => ops.push(json!({"r": con(ruta, json!(k)), "v": vb})),
                Some(va) => dif(va, vb, &con(ruta, json!(k)), ops),
            }
        }
        for k in ma.keys() {
            if !mb.contains_key(k) {
                ops.push(json!({"r": con(ruta, json!(k)), "x": 1}));
            }
        }
        return;
    }
    if con_ids(a) && con_ids(b) {
        let (la, lb) = (a.as_array().unwrap(), b.as_array().unwrap());
        let ma: HashMap<&str, &Value> = la.iter().map(|x| (id_de(x).unwrap(), x)).collect();
        let en_b: HashSet<&str> = lb.iter().map(|x| id_de(x).unwrap()).collect();
        for x in la {
            let id = id_de(x).unwrap();
            if !en_b.contains(id) {
                ops.push(json!({"r": con(ruta, json!({"id": id})), "x": 1}));
            }
        }
        for x in lb {
            let id = id_de(x).unwrap();
            match ma.get(id) {
                None => ops.push(json!({"r": con(ruta, json!({"id": id})), "v": x})),
                Some(va) => dif(va, x, &con(ruta, json!({"id": id})), ops),
            }
        }
        let queda: Vec<&str> = la.iter().map(|x| id_de(x).unwrap()).filter(|id| en_b.contains(id))
            .chain(lb.iter().map(|x| id_de(x).unwrap()).filter(|id| !ma.contains_key(id)))
            .collect();
        let orden: Vec<&str> = lb.iter().map(|x| id_de(x).unwrap()).collect();
        if queda != orden {
            ops.push(json!({"r": ruta, "orden": orden}));
        }
        return;
    }
    ops.push(json!({"r": ruta, "v": b}));
}

#[derive(Debug, PartialEq, Eq)]
pub struct ParcheAjeno;

fn hijo<'a>(c: &'a mut Value, paso: &Value) -> Option<&'a mut Value> {
    match paso {
        Value::String(k) => c.as_object_mut()?.get_mut(k),
        _ => {
            let id = paso.get("id")?.as_str()?;
            c.as_array_mut()?.iter_mut().find(|x| id_de(x) == Some(id))
        }
    }
}

/// Aplica un parche (lo modifica en su lugar). Error si no corresponde a estos datos.
pub fn aplicar(raiz: &mut Value, ops: &[Value]) -> Result<(), ParcheAjeno> {
    for op in ops {
        let ruta = op.get("r").and_then(|r| r.as_array()).ok_or(ParcheAjeno)?;
        let Some((ultimo, antes)) = ruta.split_last() else {
            if let Some(v) = op.get("v") {
                *raiz = v.clone();
            }
            continue;
        };
        let mut c = &mut *raiz;
        for paso in antes {
            c = hijo(c, paso).ok_or(ParcheAjeno)?;
        }
        if let Some(orden) = op.get("orden").and_then(|o| o.as_array()) {
            let lista = hijo(c, ultimo).and_then(|l| l.as_array_mut()).ok_or(ParcheAjeno)?;
            let pos: HashMap<&str, usize> = orden.iter().enumerate().filter_map(|(i, id)| Some((id.as_str()?, i))).collect();
            lista.sort_by_key(|x| id_de(x).and_then(|id| pos.get(id).copied()).unwrap_or(usize::MAX));
        } else if let Value::String(k) = ultimo {
            let m = c.as_object_mut().ok_or(ParcheAjeno)?;
            if op.get("x").is_some() {
                m.shift_remove(k);
            } else {
                m.insert(k.clone(), op.get("v").cloned().ok_or(ParcheAjeno)?);
            }
        } else {
            let id = ultimo.get("id").and_then(|i| i.as_str()).ok_or(ParcheAjeno)?;
            let l = c.as_array_mut().ok_or(ParcheAjeno)?;
            let i = l.iter().position(|x| id_de(x) == Some(id));
            if op.get("x").is_some() {
                if let Some(i) = i {
                    l.remove(i);
                }
            } else {
                let v = op.get("v").cloned().ok_or(ParcheAjeno)?;
                match i {
                    Some(i) => l[i] = v,
                    None => l.push(v),
                }
            }
        }
    }
    Ok(())
}

/// JSON con las claves ordenadas (el mismo texto que `canonico` en JS).
pub fn canonico(v: &Value) -> String {
    match v {
        Value::Array(l) => format!("[{}]", l.iter().map(canonico).collect::<Vec<_>>().join(",")),
        Value::Object(m) => {
            let mut ks: Vec<&String> = m.keys().collect();
            ks.sort_by(|a, b| a.encode_utf16().cmp(b.encode_utf16()));
            let partes: Vec<String> = ks.iter().map(|k| format!("{}:{}", Value::String((*k).clone()), canonico(&m[*k]))).collect();
            format!("{{{}}}", partes.join(","))
        }
        _ => v.to_string(),
    }
}

/// Huella de las colecciones (32 hex), como `huella` en JS.
pub fn huella(datos: &Value) -> String {
    let mut m = Map::new();
    for c in crate::carpeta::COLECCIONES {
        m.insert(c.into(), datos.get(c).cloned().unwrap_or_else(|| json!([])));
    }
    let h = Sha256::digest(canonico(&Value::Object(m)).as_bytes());
    h[..16].iter().map(|b| format!("{b:02x}")).collect()
}
