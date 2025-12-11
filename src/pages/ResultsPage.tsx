import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { RecoveredFile } from "../types";

export function ResultsPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const diskPath = location.state?.diskPath || "";

  const [scanning, setScanning] = useState(false);
  const [recoveredFiles, setRecoveredFiles] = useState<RecoveredFile[]>([]);
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(new Set());
  const [scanComplete, setScanComplete] = useState(false);
  const [saveLocation, setSaveLocation] = useState("");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  useEffect(() => {
    if (!diskPath) {
      navigate("/select-disk");
      return;
    }

    // Iniciar scan automaticamente
    startScan();

    // Configurar listeners de eventos
    const setupListeners = async () => {
      const unlistenFileFound = await listen<RecoveredFile>(
        "file_found",
        (event) => {
          setRecoveredFiles((prev) => [...prev, event.payload]);
        }
      );

      const unlistenScanComplete = await listen<string>(
        "scan_complete",
        () => {
          setScanning(false);
          setScanComplete(true);
        }
      );

      return () => {
        unlistenFileFound();
        unlistenScanComplete();
      };
    };

    setupListeners();
  }, [diskPath, navigate]);

  const startScan = async () => {
    setScanning(true);
    setRecoveredFiles([]);
    setScanComplete(false);

    try {
      await invoke("start_scan", { diskPath });
    } catch (error) {
      console.error("Erro ao iniciar varredura:", error);
      setScanning(false);
    }
  };

  const toggleFileSelection = (id: number) => {
    setSelectedFiles((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    if (selectedFiles.size === filteredFiles.length) {
      setSelectedFiles(new Set());
    } else {
      setSelectedFiles(new Set(filteredFiles.map((f) => f.id)));
    }
  };

  const saveSelectedFiles = async () => {
    try {
      // Abrir dialog de seleção de pasta
      const folder = await invoke<string>("select_folder");
      
      if (!folder) {
        return;
      }

      setSaveLocation(folder);
      
      let savedCount = 0;
      let errors = 0;
      
      for (const id of selectedFiles) {
        const file = recoveredFiles.find((f) => f.id === id);
        if (file) {
          try {
            await invoke("save_file", {
              fileName: file.name,
              originalPath: file.original_path,
              destination: folder,
            });
            savedCount++;
          } catch (error) {
            console.error(`Erro ao salvar ${file.name}:`, error);
            errors++;
          }
        }
      }

      if (errors > 0) {
        alert(`${savedCount} arquivo(s) salvos com sucesso!\n${errors} arquivo(s) com erro.`);
      } else {
        alert(`${savedCount} arquivo(s) salvos com sucesso em:\n${folder}`);
      }
      
      setSelectedFiles(new Set());
    } catch (error) {
      console.error("Erro ao selecionar pasta:", error);
    }
  };

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case "images":
        return "from-cyan-500 to-blue-500";
      case "documents":
        return "from-emerald-500 to-green-600";
      case "videos":
        return "from-violet-500 to-fuchsia-500";
      case "audios":
        return "from-amber-400 to-orange-500";
      default:
        return "from-gray-500 to-gray-600";
    }
  };

  const getCategoryLabel = (category: string) => {
    switch (category) {
      case "images":
        return "Imagens";
      case "documents":
        return "Documentos";
      case "videos":
        return "Vídeos";
      case "audios":
        return "Áudios";
      default:
        return "Outro";
    }
  };

  const filteredFiles = recoveredFiles.filter((file) => {
    if (filterCategory === "all") return true;
    return file.category === filterCategory;
  });

 return (
  <div className="min-h-screen w-full flex flex-col">
    <div className="w-[95%] ml-2 flex flex-col gap-6 p-3">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-2">

          <button
            onClick={() => navigate("/select-disk")}
            className="inline-flex items-center gap-2 px-4 py-2 bg-linear-to-r from-cyan-500 via-violet-500 to-fuchsia-500 rounded-xl text-white font-semibold transition-transform hover:scale-105 w-fit"
          >
            <svg className="w-5 h-5 transition-transform hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Voltar
          </button>

          <h1 className="text-4xl font-black bg-linear-to-r from-green-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
            Arquivos Recuperados
          </h1>

          <div className="flex items-center gap-2 text-gray-400">
            <span>Disco:</span>
            <code className="px-3 py-1 bg-gray-800/70 rounded-lg text-cyan-400 font-mono text-sm">
              {diskPath}
            </code>
          </div>

        </div>

        {/* Stats */}
        <div className="flex gap-4">
          <div className="px-10 py-5 rounded-2xl bg-linear-to-br from-violet-500/20 to-fuchsia-500/20 border-2 border-violet-500/40 backdrop-blur-sm">
            <div className="p-2">
              <div className="text-4xl font-bold text-white text-center">{recoveredFiles.length}</div>
              <div className="text-sm text-gray-400 text-center mt-1">Encontrados</div>
            </div>
          </div>

          <div className="px-10 py-5 rounded-2xl bg-linear-to-br from-green-500/20 to-emerald-500/20 border-2 border-green-500/40 backdrop-blur-sm">
            <div className="p-2">
              <div className="text-4xl font-bold text-white text-center">{selectedFiles.size}</div>
              <div className="text-sm text-gray-400 text-center mt-1">Selecionados</div>
            </div>
          </div>
        </div>
      </div>

      {/* Scan banner */}
      {scanning && (
        <div className="p-8 rounded-2xl bg-linear-to-r from-violet-500/10 via-fuchsia-500/10 to-pink-500/10 border-2 border-violet-500/30">
          <div className="flex items-center gap-6 p-2">
            <div className="w-16 h-16 rounded-full bg-linear-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center">
              <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
            </div>

            <div>
              <h3 className="text-2xl font-bold text-white mb-2">Varredura em Andamento...</h3>
              <p className="text-gray-400 text-base">Analisando setores do disco em busca de arquivos deletados</p>
            </div>
          </div>
        </div>
      )}

      {/* Completed banner */}
      {scanComplete && (
        <div className="p-8 rounded-2xl bg-linear-to-r from-green-500/10 via-emerald-500/10 to-teal-500/10 border-2 border-green-500/40">
          <div className="flex items-center gap-8 p-2">
            <div className="w-16 h-16 rounded-full bg-linear-to-br from-green-500 to-emerald-500 flex items-center justify-center text-3xl">
              ✓
            </div>
            <div>
              <h3 className="text-2xl font-bold text-green-400 mb-2">Varredura Concluída!</h3>
              <p className="text-gray-400 text-base">
                {recoveredFiles.length} arquivo(s) recuperado(s) e pronto(s) para download
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center justify-between gap-6 p-6 rounded-2xl bg-gray-900/60 border-2 border-gray-700/50 backdrop-blur-sm">
        <div className="flex items-center gap-4 p-1">
          <span className="text-base font-semibold text-gray-300">Categorias:</span>

          {["all", "images", "documents", "videos", "audios"].map((category) => (
            <button
              key={category}
              onClick={() => setFilterCategory(category)}
              className={`px-6 py-3 rounded-xl font-bold text-sm transition-transform ${
                filterCategory === category
                  ? "bg-linear-to-r from-violet-500 to-fuchsia-500 text-white shadow-lg scale-105"
                  : "bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700 hover:scale-105"
              }`}
            >
              {category === "all" ? "Todos" : getCategoryLabel(category)}
            </button>
          ))}
        </div>

        <button
          onClick={selectAll}
          className="px-6 py-3 rounded-xl bg-gray-800 text-gray-300 hover:bg-gray-700 hover:scale-105 transition-transform font-bold text-sm border-2 border-gray-700"
        >
          {selectedFiles.size === filteredFiles.length && filteredFiles.length > 0
            ? "Desselecionar Todos"
            : "Selecionar Todos"}
        </button>
      </div>

      {/* File list */}
      <div className="flex flex-col gap-3">
        {filteredFiles.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-6">
            <div className="text-8xl opacity-50">{scanning ? "🔍" : "📁"}</div>
            <p className="text-3xl font-bold text-gray-400">
              {scanning ? "Procurando arquivos..." : "Nenhum arquivo encontrado"}
            </p>
            {!scanning && (
              <p className="text-gray-500 text-lg">Tente ajustar os filtros ou iniciar uma nova varredura</p>
            )}
          </div>
        ) : (
          filteredFiles.map((file) => {
            const isSelected = selectedFiles.has(file.id);

            return (
              <div
                key={file.id}
                onClick={() => toggleFileSelection(file.id)}
                className={`group relative p-6 rounded-2xl border-2 cursor-pointer transition-transform ${
                  isSelected
                    ? "border-violet-500 bg-violet-500/10 shadow-xl shadow-violet-500/20 scale-[1.01]"
                    : "border-gray-700/50 bg-gray-900/40 hover:border-violet-500/30 hover:bg-violet-500/5 hover:scale-[1.01]"
                }`}
              >
                <div className="flex items-center gap-6 p-1">

                  {/* Checkbox */}
                  <div className="shrink-0">
                    <div
                      className={`w-7 h-7 rounded-lg border-2 flex items-center justify-center transition-all ${
                        isSelected
                          ? "bg-linear-to-br from-violet-500 to-fuchsia-500 border-transparent"
                          : "border-gray-600 group-hover:border-violet-500"
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFileSelection(file.id);
                      }}
                    >
                      {isSelected && (
                        <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                            clipRule="evenodd"
                          />
                        </svg>
                      )}
                    </div>
                  </div>

                  {/* File Icon */}
                  <div className="shrink-0 w-14 h-14 rounded-xl bg-linear-to-br from-cyan-500/20 to-blue-500/20 border-2 border-cyan-500/30 flex items-center justify-center text-3xl">
                    📄
                  </div>

                  {/* File Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-white mb-2 truncate">{file.name}</h3>
                    <p className="text-sm text-gray-500 truncate font-mono">{file.original_path}</p>
                  </div>

                  {/* Size */}
                  <div className="shrink-0 px-8 py-4 rounded-xl bg-gray-800/70 border-2 border-gray-700/50 min-w-[120px]">
                    <div className="text-lg font-bold text-white text-center">{formatBytes(file.size)}</div>
                    <div className="text-xs text-gray-500 text-center mt-1">Tamanho</div>
                  </div>

                  {/* Category Badge */}
                  <div className="shrink-0">
                    <div className={`px-8 py-4 rounded-xl bg-linear-to-r ${getCategoryColor(file.category)} text-white font-bold shadow-lg flex items-center justify-center gap-3 min-w-40`}>
                      <span className="text-base uppercase tracking-wide">{getCategoryLabel(file.category)}</span>
                      <span className="text-xs bg-white/15 px-3 py-1 rounded-full font-semibold">Recuperado</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Download */}
      {selectedFiles.size > 0 && (
        <div className="sticky bottom-6 p-8 rounded-2xl bg-gray-900/95 backdrop-blur-xl border-2 border-violet-500/50 shadow-2xl shadow-violet-500/30">
          <div className="flex items-center gap-6">

            <div className="flex-1">
              <label className="block text-base font-bold text-gray-300 mb-3">Local de Destino:</label>

              <div className="px-5 py-4 bg-gray-800 border-2 border-gray-700 rounded-xl text-gray-400 text-base font-mono">
                {saveLocation || "Nenhuma pasta selecionada"}
              </div>
            </div>

            <button
              onClick={saveSelectedFiles}
              disabled={selectedFiles.size === 0}
              className={`relative px-10 py-4 rounded-xl font-bold text-xl transition-transform ${
                selectedFiles.size > 0
                  ? "text-white hover:scale-105"
                  : "text-gray-500 cursor-not-allowed opacity-50"
              }`}
            >
              <div
                className={`absolute inset-0 rounded-xl ${
                  selectedFiles.size > 0 ? "bg-linear-to-r from-green-500 via-emerald-500 to-teal-500" : "bg-gray-800"
                }`}
              ></div>

              <span className="relative flex items-center gap-3 whitespace-nowrap">
                💾 Baixar {selectedFiles.size} Arquivo(s)
              </span>
            </button>

          </div>
        </div>
      )}
    </div>
  </div>
);

}
