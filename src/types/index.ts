// Tipos correspondentes ao backend Rust/Tauri

export interface DiskInfo {
  name: string;
  mount_point: string;
  total_space: number;
  available_space: number;
  file_system: string;
  is_removable: boolean;
}

export interface FileEntry {
  name: string;
  path: string;
  is_dir: boolean;
  size: number;
}

export interface RecoveredFile {
  id: number;
  name: string;
  original_path: string;
  size: number;
  status: string;
  category: string;
}
