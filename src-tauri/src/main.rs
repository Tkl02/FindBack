// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::Serialize;
use std::collections::HashSet;
use std::fs;
use std::path::Path;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use sysinfo::Disks;
use tauri::Emitter;

// estrutura para enviar dados do disco para o react
#[derive(Serialize)]
struct DiskInfo {
    name: String,
    mount_point: String,
    total_space: u64,
    available_space: u64,
    file_system: String,
    is_removable: bool,
}

// estrutura para pastas e arquivos
#[derive(Serialize)]
struct FileEntry {
    name: String,
    path: String,
    is_dir: bool,
    size: u64,
}

// Estrutura para arquivos recuperados (Scan)
#[derive(Serialize, Clone, Debug)]
struct RecoveredFile {
    id: u32,
    name: String,
    original_path: String,
    size: u64,
    status: String,
    category: String,
}

// 1 comando: listar discos e partições
#[tauri::command]
fn list_drives() -> Vec<DiskInfo> {
    let disks = Disks::new_with_refreshed_list();
    let mut disks_vec = Vec::new();

    for disk in &disks {
        disks_vec.push(DiskInfo {
            name: disk.name().to_string_lossy().to_string(),
            mount_point: disk.mount_point().to_string_lossy().to_string(),
            total_space: disk.total_space(),
            available_space: disk.available_space(),
            file_system: format!("{:?}", disk.kind()),
            is_removable: disk.is_removable(),
        });
    }
    disks_vec
}

// 2 leitura de diretorio
#[tauri::command]
fn read_directory(path: String) -> Result<Vec<FileEntry>, String> {
    let read_path = Path::new(&path);
    if !read_path.exists() {
        return Err("Caminho não encontrado".into());
    }
    let mut entries = Vec::new();

    match fs::read_dir(read_path) {
        Ok(dir) => {
            for entry in dir {
                if let Ok(entry) = entry {
                    if let Ok(metadata) = entry.metadata() {
                        entries.push(FileEntry {
                            name: entry.file_name().to_string_lossy().to_string(),
                            path: entry.path().to_string_lossy().to_string(),
                            is_dir: metadata.is_dir(),
                            size: metadata.len(),
                        });
                    }
                }
            }
            Ok(entries)
        }
        Err(e) => Err(format!("Erro de acesso {}", e)),
    }
}

// Determina a categoria do arquivo com base na extensão e permite apenas tipos comuns
fn categorize_extension(ext: &str) -> Option<String> {
    let ext = ext.to_ascii_lowercase();

    // Imagens
    let image_exts = [
        "jpg", "jpeg", "png", "webp", "gif", "bmp", "tiff", "tif", "heic", "heif", "svg",
    ];

    // Documentos
    let doc_exts = [
        "pdf", "doc", "docx", "odt", "rtf", "txt", "xls", "xlsx", "ppt", "pptx",
    ];

    // Áudio
    let audio_exts = ["mp3", "wav", "flac", "ogg", "m4a", "aac", "opus", "wma"];

    // Vídeo
    let video_exts = [
        "mp4", "mov", "avi", "mkv", "webm", "wmv", "mpeg", "mpg", "m4v",
    ];

    if image_exts.contains(&ext.as_str()) {
        return Some("images".to_string());
    }
    if doc_exts.contains(&ext.as_str()) {
        return Some("documents".to_string());
    }
    if audio_exts.contains(&ext.as_str()) {
        return Some("audios".to_string());
    }
    if video_exts.contains(&ext.as_str()) {
        return Some("videos".to_string());
    }

    None
}

// Função auxiliar para varrer recursivamente
fn scan_directory(
    path: &Path,
    found_files: &Arc<Mutex<HashSet<String>>>,
    file_id: &Arc<Mutex<u32>>,
    handle: &tauri::AppHandle,
) {
    if let Ok(entries) = fs::read_dir(path) {
        for entry in entries.flatten() {
            if let Ok(metadata) = entry.metadata() {
                let path = entry.path();

                if metadata.is_file() {
                    let path_str = path.to_string_lossy().to_string();

                    // Filtrar por extensões permitidas
                    let category = path
                        .extension()
                        .and_then(|e| e.to_str())
                        .and_then(categorize_extension);

                    // Ignorar arquivos que não sejam das categorias desejadas
                    let category = match category {
                        Some(cat) => cat,
                        None => continue,
                    };

                    // Verificar se já foi encontrado (evitar duplicação)
                    let mut found = found_files.lock().unwrap();
                    if found.contains(&path_str) {
                        continue;
                    }
                    found.insert(path_str.clone());
                    drop(found);

                    let file_name = entry.file_name().to_string_lossy().to_string();

                    // Simular diferentes status baseado no tamanho
                    let status = if metadata.len() > 1024 * 1024 {
                        "Good"
                    } else if metadata.len() > 512 * 1024 {
                        "Damaged"
                    } else {
                        "Good"
                    };

                    let mut id = file_id.lock().unwrap();
                    *id += 1;
                    let current_id = *id;
                    drop(id);

                    let recovered_file = RecoveredFile {
                        id: current_id,
                        name: file_name,
                        original_path: path_str,
                        size: metadata.len(),
                        status: status.to_string(),
                        category,
                    };

                    if let Err(e) = handle.emit("file_found", &recovered_file) {
                        eprintln!("Erro ao emitir file_found: {}", e);
                    }

                    // Pequeno delay para não sobrecarregar a UI
                    thread::sleep(Duration::from_millis(50));
                } else if metadata.is_dir() {
                    // Varredura recursiva
                    scan_directory(&path, found_files, file_id, handle);
                }
            }
        }
    }
}

// varredura persistente (scan progressivo)
#[tauri::command]
async fn start_scan(app_handle: tauri::AppHandle, disk_path: String) -> Result<String, String> {
    let handle = app_handle.clone();
    let path_clone = disk_path.clone();

    thread::spawn(move || {
        println!("Iniciando varredura profunda em {}", path_clone);

        let path = Path::new(&path_clone);
        let found_files = Arc::new(Mutex::new(HashSet::new()));
        let file_id = Arc::new(Mutex::new(0));

        scan_directory(path, &found_files, &file_id, &handle);

        thread::sleep(Duration::from_millis(500));
        if let Err(e) = handle.emit("scan_complete", "varredura finalizada com sucesso") {
            eprintln!("Erro ao emitir evento scan_complete: {}", e);
        }

        println!(
            "Varredura concluída. Total de arquivos: {}",
            file_id.lock().unwrap()
        );
    });

    Ok(format!("Varredura iniciada em bg para {}", disk_path))
}

// Comando para abrir dialog de seleção de pasta
#[tauri::command]
async fn select_folder() -> Result<String, String> {
    let folder = rfd::FileDialog::new()
        .set_title("Selecione o local para salvar os arquivos")
        .pick_folder();

    match folder {
        Some(path) => Ok(path.to_string_lossy().to_string()),
        None => Err("Nenhuma pasta selecionada".to_string()),
    }
}

// salva arquivos recuperados
#[tauri::command]
async fn save_file(
    file_name: String,
    original_path: String,
    destination: String,
) -> Result<String, String> {
    let source = Path::new(&original_path);

    if !source.exists() {
        return Err(format!(
            "Arquivo de origem não encontrado: {}",
            original_path
        ));
    }

    let dest = Path::new(&destination).join(&file_name);

    // Criar diretório de destino se não existir
    if let Some(parent) = dest.parent() {
        if let Err(e) = fs::create_dir_all(parent) {
            return Err(format!("Erro ao criar diretório: {}", e));
        }
    }

    match fs::copy(source, &dest) {
        Ok(_) => Ok(format!("Arquivo salvo em: {:?}", dest)),
        Err(e) => Err(format!("Erro ao salvar arquivo: {}", e)),
    }
}

// função main
fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            list_drives,
            read_directory,
            start_scan,
            save_file,
            select_folder
        ])
        .run(tauri::generate_context!("tauri.conf.json"))
        .expect("erro ao rodar aplicação tauri");
}
