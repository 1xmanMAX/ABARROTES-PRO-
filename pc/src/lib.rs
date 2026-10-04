//! Mi Bodega en la PC: sirve la app (app/dist) a esta PC para abrirla sin internet.
//! Trae también el servidor de sincronización por Wi-Fi adaptado de Canvas de Citas
//! (receptor/sincro), todavía sin conectar a la app: `carpeta::COLECCIONES` son las del
//! prototipo v1 y hay que cambiarlas por las tablas de Dexie al integrarlo.
pub mod carpeta;
pub mod cifrado;
pub mod parche;
pub mod servidor;
