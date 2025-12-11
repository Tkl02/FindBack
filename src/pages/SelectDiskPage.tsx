import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { DiskInfo } from "../types";

export function SelectDiskPage() {
  const navigate = useNavigate();
  const [disks, setDisks] = useState<DiskInfo[]>([]);
  const [selectedDisk, setSelectedDisk] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);

  useEffect(() => {
    loadDisks();
  }, []);

  const loadDisks = async () => {
    try {
      const diskList = await invoke<DiskInfo[]>("list_drives");
      setDisks(diskList);
      setLoading(false);
    } catch (error) {
      console.error("Erro ao carregar discos:", error);
      setLoading(false);
    }
  };

  const handleStartScan = async () => {
    if (!selectedDisk) return;

    setScanning(true);
    
    // Navega para a página de resultados passando o caminho do disco
    navigate("/results", { state: { diskPath: selectedDisk } });
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 px-6 py-10">
      <div className="w-full max-w-5xl space-y-8 bg-white/5 border border-white/10 rounded-3xl shadow-2xl backdrop-blur-xl p-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate("/")}
            className="px-4 py-2 rounded-xl border border-white/10 text-slate-200 hover:border-cyan-400 hover:text-white transition"
          >
            ← Voltar
          </button>
          <div className="text-right">
            <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Passo 1</p>
            <h1 className="text-3xl font-bold text-white">Selecione o disco</h1>
            <p className="text-sm text-slate-400">Escolha a unidade para varredura</p>
          </div>
        </div>

        {/* Disks List */}
        <div className="space-y-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
              <div className="relative w-20 h-20">
                <div className="absolute inset-0 rounded-full border-4 border-violet-500/20"></div>
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-violet-500 animate-spin"></div>
              </div>
              <p className="text-gray-400">Carregando discos...</p>
            </div>
          ) : disks.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl mb-4">💿</div>
              <p className="text-gray-400 text-xl">Nenhum disco encontrado</p>
            </div>
          ) : (
            <div className="grid gap-4">
              {disks.map((disk, index) => {
                const isSelected = selectedDisk === disk.mount_point;
                const usedPercentage = ((disk.total_space - disk.available_space) / disk.total_space) * 100;
                
                return (
                  <div
                    key={index}
                    onClick={() => setSelectedDisk(disk.mount_point)}
                    className={`p-5 rounded-2xl border cursor-pointer transition ${
                      isSelected
                        ? "border-cyan-400 bg-cyan-400/10"
                        : "border-white/10 bg-white/5 hover:border-cyan-300/60"
                    }`}
                  >
                    <div className="flex items-center gap-5">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                        isSelected ? "bg-cyan-500 text-white" : "bg-slate-800 text-slate-100"
                      }`}>
                        {disk.is_removable ? "💾" : "💿"}
                      </div>

                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-lg font-semibold text-white">{disk.name || "Disco Local"}</p>
                            <div className="flex items-center gap-2 text-sm text-slate-400">
                              <code className="bg-slate-900/60 px-2 py-1 rounded">{disk.mount_point}</code>
                              {disk.is_removable && <span className="px-2 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs">Removível</span>}
                              <span className="px-2 py-1 rounded-full bg-blue-500/15 text-blue-200 text-xs">{disk.file_system}</span>
                            </div>
                          </div>
                          {isSelected && <span className="text-cyan-300 font-semibold text-sm">Selecionado</span>}
                        </div>

                        <div className="space-y-1">
                          <div className="flex justify-between text-xs text-slate-400">
                            <span>{formatBytes(disk.total_space - disk.available_space)} usado</span>
                            <span>{formatBytes(disk.total_space)} total</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-900 overflow-hidden">
                            <div
                              className="h-full bg-linear-to-r from-cyan-500 to-blue-500"
                              style={{ width: `${usedPercentage}%` }}
                            ></div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Action Button */}
        {disks.length > 0 && (
          <div className="flex justify-end pt-6">
            <button
              onClick={handleStartScan}
              disabled={!selectedDisk || scanning}
              className={`px-8 py-3 rounded-xl text-white font-semibold transition ${
                selectedDisk && !scanning
                  ? "bg-linear-to-r from-cyan-500 to-blue-500 hover:scale-105"
                  : "bg-slate-800 text-slate-500 cursor-not-allowed"
              }`}
            >
              {scanning ? "Iniciando..." : selectedDisk ? "Iniciar varredura" : "Selecione um disco"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
