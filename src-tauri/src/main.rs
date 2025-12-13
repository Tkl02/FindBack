#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::fs::OpenOptions;
use std::io::Read;
use tauri::Emitter;

#[derive(Serialize, Clone, Debug)]
enum RecoveryStatus {
    RecoveredOk,
    RecoveredPartial,
    RecoveredCorrupted,
}

#[derive(Serialize, Clone, Debug)]
struct RecoveredFile {
    id: u32,
    file_type: String,
    size: u64,
    status: RecoveryStatus,
}

struct Signature {
    file_type: &'static str,
    header: &'static [u8],
    footer: Option<&'static [u8]>,
}

const SIGNATURES: &[Signature] = &[
    Signature {
        file_type: "jpg",
        header: &[0xFF, 0xD8, 0xFF],
        footer: Some(&[0xFF, 0xD9]),
    },
    Signature {
        file_type: "png",
        header: &[0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A],
        footer: Some(&[0x49, 0x45, 0x4E, 0x44]),
    },
];

fn scan_disk(device_path: &str, app_handle: tauri::AppHandle) -> Result<(), String> {
    let mut device = OpenOptions::new()
        .read(true)
        .open(device_path)
        .map_err(|e| format!("Erro ao abrir dispositivo: {}", e))?;

    let mut buffer = vec![0u8; 4096];
    let mut overlap: Vec<u8> = Vec::new();
    let mut file_id: u32 = 0;

    let max_header_len = SIGNATURES.iter().map(|s| s.header.len()).max().unwrap_or(0);

    loop {
        let bytes_read = device.read(&mut buffer).map_err(|e| e.to_string())?;
        if bytes_read == 0 {
            break;
        }

        let mut scan_buf = overlap.clone();
        scan_buf.extend_from_slice(&buffer[..bytes_read]);

        for sig in SIGNATURES {
            let header_len = sig.header.len();

            if scan_buf.len() < header_len {
                continue;
            }

            for i in 0..=scan_buf.len() - header_len {
                if &scan_buf[i..i + header_len] == sig.header {
                    file_id += 1;

                    let (size, status) = reconstruct_file(&mut device, sig);

                    let recovered = RecoveredFile {
                        id: file_id,
                        file_type: sig.file_type.to_string(),
                        size,
                        status,
                    };

                    let _ = app_handle.emit("file_found", recovered);
                }
            }
        }

        // mantém apenas o final do buffer para a próxima iteração
        overlap = scan_buf
            .iter()
            .rev()
            .take(max_header_len.saturating_sub(1))
            .cloned()
            .collect::<Vec<u8>>();
        overlap.reverse();
    }

    Ok(())
}

fn reconstruct_file(device: &mut std::fs::File, sig: &Signature) -> (u64, RecoveryStatus) {
    let mut size = sig.header.len() as u64;
    let mut buffer = [0u8; 4096];

    loop {
        match device.read(&mut buffer) {
            Ok(0) => return (size, RecoveryStatus::RecoveredPartial),
            Ok(n) => {
                size += n as u64;

                if let Some(footer) = sig.footer {
                    if buffer[..n].windows(footer.len()).any(|w| w == footer) {
                        return (size, RecoveryStatus::RecoveredOk);
                    }
                }

                if size > 100 * 1024 * 1024 {
                    return (size, RecoveryStatus::RecoveredCorrupted);
                }
            }
            Err(_) => return (size, RecoveryStatus::RecoveredCorrupted),
        }
    }
}

#[tauri::command]
fn start_scan(app_handle: tauri::AppHandle, device_path: String) -> Result<(), String> {
    let handle = app_handle.clone();

    std::thread::spawn(move || {
        if let Err(e) = scan_disk(&device_path, handle.clone()) {
            eprintln!("Erro no scan: {}", e);
        }

        let _ = handle.emit("scan_complete", "Scan finalizado");
    });

    Ok(())
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![start_scan])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar aplicação Tauri");
}
