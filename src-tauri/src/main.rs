#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::collections::HashSet;
use std::fs::OpenOptions;
use std::io::Read;
use std::io::Seek;
use std::io::SeekFrom;
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
    let mut seen_positions: HashSet<u64> = HashSet::new();

    let max_header_len = SIGNATURES.iter().map(|s| s.header.len()).max().unwrap_or(0);

    loop {
        let bytes_read = device.read(&mut buffer).map_err(|e| e.to_string())?;
        if bytes_read == 0 {
            break;
        }

        let chunk_end = device
            .seek(SeekFrom::Current(0))
            .map_err(|e| format!("Erro ao obter posição: {}", e))?;
        let chunk_start = chunk_end.saturating_sub(bytes_read as u64);

        let mut scan_buf = overlap.clone();
        scan_buf.extend_from_slice(&buffer[..bytes_read]);
        let overlap_len = overlap.len() as u64;

        for sig in SIGNATURES {
            let header_len = sig.header.len();
            if scan_buf.len() < header_len {
                continue;
            }

            for i in 0..=scan_buf.len() - header_len {
                if &scan_buf[i..i + header_len] != sig.header {
                    continue;
                }

                let abs_pos = chunk_start
                    .saturating_sub(overlap_len)
                    .saturating_add(i as u64);

                if !seen_positions.insert(abs_pos) {
                    continue;
                }

                let resume_pos = chunk_end;

                device
                    .seek(SeekFrom::Start(abs_pos))
                    .map_err(|e| format!("Erro ao posicionar no header: {}", e))?;

                device
                    .seek(SeekFrom::Current(header_len as i64))
                    .map_err(|e| format!("Erro ao avançar após header: {}", e))?;

                let after_header_pos = device
                    .seek(SeekFrom::Current(0))
                    .map_err(|e| format!("Erro ao obter posição pós-header: {}", e))?;

                if !validate_candidate(&mut device, sig) {
                    device
                        .seek(SeekFrom::Start(resume_pos))
                        .map_err(|e| format!("Erro ao restaurar após validação falha: {}", e))?;
                    continue;
                }

                device
                    .seek(SeekFrom::Start(after_header_pos))
                    .map_err(|e| format!("Erro ao restaurar antes da reconstrução: {}", e))?;

                file_id += 1;

                let (size, status) = reconstruct_file(&mut device, sig);

                let recovered = RecoveredFile {
                    id: file_id,
                    file_type: sig.file_type.to_string(),
                    size,
                    status,
                };

                let _ = app_handle.emit("file_found", recovered);

                device
                    .seek(SeekFrom::Start(resume_pos))
                    .map_err(|e| format!("Erro ao restaurar posição final: {}", e))?;
            }
        }

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

fn validate_candidate(device: &mut std::fs::File, sig: &Signature) -> bool {
    let mut probe = [0u8; 32];

    if device.read(&mut probe).is_err() {
        return false;
    }

    match sig.file_type {
        "jpg" => validate_jpg(&probe),
        "png" => validate_png(&probe),
        _ => true,
    }
}

fn validate_jpg(buf: &[u8]) -> bool {
    if buf.len() < 4 {
        return false;
    }
    buf[0] == 0xFF && buf[1] == 0xD8 && buf[2] == 0xFF && (buf[3] == 0xE0 || buf[3] == 0xE1)
}

fn validate_png(buf: &[u8]) -> bool {
    if buf.len() < 16 {
        return false;
    }
    &buf[12..16] == b"IHDR"
}

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![start_scan])
        .run(tauri::generate_context!())
        .expect("erro ao iniciar aplicação Tauri");
}
