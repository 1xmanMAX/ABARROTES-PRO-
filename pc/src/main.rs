//! mi-bodega.exe: Mi Bodega en la PC.
//! - Sin argumentos (el acceso directo): si el servidor local no está corriendo lo arranca en
//!   segundo plano y abre la app (app/dist, en la carpeta `web` junto al exe) en una ventana de
//!   Comet (o Edge/Chrome si no está).
//! - `--segundo-plano`: solo el servidor, sin ventana.
#![windows_subsystem = "windows"]

use mi_bodega::servidor::{preparar, servir, PUERTO};
use std::io::{Read, Write};
use std::net::TcpStream;
use std::os::windows::process::CommandExt;
use std::path::PathBuf;
use std::process::Command;
use std::time::Duration;

const CREATE_NO_WINDOW: u32 = 0x0800_0000;
const DETACHED_PROCESS: u32 = 0x0000_0008;

fn base() -> PathBuf {
    std::env::var_os("LOCALAPPDATA").map(PathBuf::from).unwrap_or_else(|| PathBuf::from(".")).join("MiBodega")
}

fn exe_dir() -> PathBuf {
    std::env::current_exe().ok().and_then(|p| p.parent().map(PathBuf::from)).unwrap_or_else(|| PathBuf::from("."))
}

/// ¿Ya hay un servidor de Mi Bodega en el puerto?
fn servidor_vivo() -> bool {
    let Ok(mut s) = TcpStream::connect_timeout(&([127, 0, 0, 1], PUERTO).into(), Duration::from_millis(500)) else { return false };
    let _ = s.set_read_timeout(Some(Duration::from_secs(2)));
    let pedido = format!("GET /pc/hola HTTP/1.0\r\nHost: 127.0.0.1:{PUERTO}\r\n\r\n");
    if s.write_all(pedido.as_bytes()).is_err() {
        return false;
    }
    let mut r = String::new();
    let _ = s.read_to_string(&mut r);
    r.contains("mibodega")
}

/// Comet primero (es el navegador que ya está abierto: la ventana de la app comparte sus procesos
/// y casi no suma RAM); si no está, Edge o Chrome. Devuelve la ruta y si es Comet.
fn navegador() -> Option<(PathBuf, bool)> {
    let mut candidatos = vec![];
    if let Some(d) = std::env::var_os("LOCALAPPDATA") {
        candidatos.push((PathBuf::from(d).join(r"Perplexity\Comet\Application\comet.exe"), true));
    }
    for var in ["ProgramFiles(x86)", "ProgramFiles", "LOCALAPPDATA"] {
        if let Some(d) = std::env::var_os(var) {
            let d = PathBuf::from(d);
            candidatos.push((d.join(r"Perplexity\Comet\Application\comet.exe"), true));
            candidatos.push((d.join(r"Microsoft\Edge\Application\msedge.exe"), false));
            candidatos.push((d.join(r"Google\Chrome\Application\chrome.exe"), false));
        }
    }
    candidatos.into_iter().find(|(p, _)| p.exists())
}

fn abrir_ventana() {
    let url = format!("http://127.0.0.1:{PUERTO}/");
    match navegador() {
        Some((nav, es_comet)) => {
            let mut cmd = Command::new(nav);
            cmd.arg(format!("--app={url}")).arg("--window-size=1280,800");
            if !es_comet {
                // Otro navegador: perfil propio, para no mezclarse con el historial de ese navegador.
                cmd.arg(format!("--user-data-dir={}", base().join("navegador").display())).arg("--no-first-run");
            }
            let _ = cmd.spawn();
        }
        None => {
            let _ = Command::new("cmd").args(["/c", "start", "", &url]).creation_flags(CREATE_NO_WINDOW).spawn();
        }
    }
}

fn main() {
    if std::env::args().any(|a| a == "--segundo-plano") {
        let b = base();
        match preparar(b.join("datos"), exe_dir().join("web"), &b.join("clave.txt"), PUERTO) {
            Ok((s, server)) => servir(s, server),
            // Puerto ocupado: normalmente porque ya hay otro servidor de Mi Bodega corriendo.
            Err(_) => std::process::exit(1),
        }
        return;
    }
    if !servidor_vivo() {
        if let Ok(exe) = std::env::current_exe() {
            let _ = Command::new(exe).arg("--segundo-plano").creation_flags(CREATE_NO_WINDOW | DETACHED_PROCESS).spawn();
        }
        for _ in 0..50 {
            if servidor_vivo() {
                break;
            }
            std::thread::sleep(Duration::from_millis(100));
        }
    }
    abrir_ventana();
}
