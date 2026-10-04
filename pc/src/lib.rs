//! Mi Bodega en la PC: sirve la app (app/dist) a esta PC para abrirla sin internet, guarda la copia
//! principal de los datos y sincroniza por Wi-Fi con el celular (app/src/sync). Adaptado de
//! Canvas de Citas (receptor/sincro).
pub mod carpeta;
pub mod cifrado;
pub mod nodo;
pub mod parche;
pub mod servidor;
