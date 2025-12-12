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
    <div className="w-screen h-screen flex justify-center items-center">
      <div className="w-280 h-150">
        <div className="">
          <button
            onClick={() => {
              navigate("/");
            }}
            className="bg-cyan-300/10 border-cyan-300 border-1 w-19 h-9 rounded-2xl font-semibold hover:bg-cyan-300/50 hover:scale-110"
          >
            ← Voltar
          </button>
        </div>
        <div className="flex flex-col justify-center items-center h-full gap-5">
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
            <div className="grid gap-4 w-full items-center">
              {disks.map((disk, index) => {
                const isSelected = selectedDisk === disk.mount_point;
                const usedPercentage =
                  ((disk.total_space - disk.available_space) /
                    disk.total_space) *
                  100;

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
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl ${
                          isSelected ? "bg-cyan-500 text-white" : "bg-slate-100"
                        }`}
                      >
                        {disk.is_removable ? "💾" : "💿"}
                      </div>

                      <div className="flex-1 space-y-2">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-lg font-semibold text-white">
                              {disk.name || "Disco local"}
                            </p>
                            <div className="flex items-center gap-2 text-sm text-slate-400">
                              <code className="bg-slate-900/60 px-2 py-1 rounded">
                                {disk.mount_point}
                              </code>
                              <span className="">{disk.file_system}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {disks.length > 0 && (
            <div className="flex">
              <button
                onClick={handleStartScan}
                disabled={!selectedDisk || scanning}
                className={`text-white text-xl font-semibold w-80 h-10 rounded-2xl transition ${
                  selectedDisk && !scanning
                    ? "bg-gradient-to-r from-cyan-500 to-blue-500 hover:scale-105"
                    : "bg-slate-800 text-slate-500 cursor-not-allowed"
                }`}
              >
                {scanning
                  ? "Iniciando..."
                  : selectedDisk
                  ? "Iniciar varredura"
                  : "Selecione um disco"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
