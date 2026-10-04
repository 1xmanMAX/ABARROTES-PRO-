//! AES-256-GCM con el mismo formato que `app/web/sincro/cifrado.js` (copiado de Canvas de Citas):
//! IV (12) + cifrado con etiqueta; el contenido lleva delante la hora en ms (8 bytes, big-endian).
//! Datos adicionales fijos.
use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::{Aes256Gcm, Nonce};
use base64::{engine::general_purpose::STANDARD, Engine};
use std::time::{SystemTime, UNIX_EPOCH};

pub const AAD: &[u8] = b"mibodega-sincro-v1";
pub const EDAD_MAX_MS: u64 = 5 * 60 * 1000;

#[derive(Debug, PartialEq, Eq)]
pub enum ErrorCifrado {
    /// La clave no es base64 de 32 bytes.
    Clave,
    /// Otra clave, o el mensaje fue modificado / está incompleto.
    Alterado,
    /// La hora del mensaje difiere más de EDAD_MAX_MS.
    Vencido,
}

pub fn ahora_ms() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0)
}

pub struct Clave(Aes256Gcm);

impl Clave {
    pub fn desde_base64(s: &str) -> Result<Self, ErrorCifrado> {
        let raw = STANDARD.decode(s.trim()).map_err(|_| ErrorCifrado::Clave)?;
        if raw.len() != 32 {
            return Err(ErrorCifrado::Clave);
        }
        Aes256Gcm::new_from_slice(&raw).map(Clave).map_err(|_| ErrorCifrado::Clave)
    }

    /// Clave nueva al azar y su texto base64 (para el QR de vinculación).
    pub fn nueva() -> (Self, String) {
        let mut k = [0u8; 32];
        getrandom::getrandom(&mut k).expect("sin fuente de azar");
        let s = STANDARD.encode(k);
        (Self::desde_base64(&s).expect("clave recién creada"), s)
    }

    pub fn cifrar_con(&self, bytes: &[u8], iv: [u8; 12], ahora: u64) -> Vec<u8> {
        let mut plano = ahora.to_be_bytes().to_vec();
        plano.extend_from_slice(bytes);
        let ct = self.0.encrypt(Nonce::from_slice(&iv), Payload { msg: &plano, aad: AAD }).expect("cifrar");
        let mut out = iv.to_vec();
        out.extend(ct);
        out
    }

    pub fn cifrar(&self, bytes: &[u8]) -> Vec<u8> {
        let mut iv = [0u8; 12];
        getrandom::getrandom(&mut iv).expect("sin fuente de azar");
        self.cifrar_con(bytes, iv, ahora_ms())
    }

    pub fn descifrar_en(&self, sobre: &[u8], ahora: u64) -> Result<Vec<u8>, ErrorCifrado> {
        if sobre.len() < 12 + 8 + 16 {
            return Err(ErrorCifrado::Alterado);
        }
        let plano = self
            .0
            .decrypt(Nonce::from_slice(&sobre[..12]), Payload { msg: &sobre[12..], aad: AAD })
            .map_err(|_| ErrorCifrado::Alterado)?;
        let t = u64::from_be_bytes(plano[..8].try_into().expect("8 bytes"));
        if ahora.abs_diff(t) > EDAD_MAX_MS {
            return Err(ErrorCifrado::Vencido);
        }
        Ok(plano[8..].to_vec())
    }

    pub fn descifrar(&self, sobre: &[u8]) -> Result<Vec<u8>, ErrorCifrado> {
        self.descifrar_en(sobre, ahora_ms())
    }

    pub fn cifrar_json(&self, v: &serde_json::Value) -> String {
        STANDARD.encode(self.cifrar(&serde_json::to_vec(v).expect("json")))
    }

    pub fn descifrar_json(&self, texto: &str) -> Result<serde_json::Value, ErrorCifrado> {
        let b = STANDARD.decode(texto.trim()).map_err(|_| ErrorCifrado::Alterado)?;
        serde_json::from_slice(&self.descifrar(&b)?).map_err(|_| ErrorCifrado::Alterado)
    }
}
