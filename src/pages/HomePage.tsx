import { useNavigate } from "react-router-dom";

export function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 px-6 py-10">
      <div className="max-w-4xl w-full rounded-3xl border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl p-10 space-y-10">
        <div className="space-y-4 text-center">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Recuperação Inteligente</p>
          <h1 className="text-6xl font-black text-white">FindBack</h1>
          <p className="text-lg text-slate-300 max-w-2xl mx-auto">
            Varredura rápida, filtros por tipo de arquivo e restauração direta com poucos cliques.
          </p>
        </div>

        <div className="flex justify-center">
          <button
            onClick={() => navigate("/select-disk")}
            className="px-10 py-4 rounded-2xl bg-linear-to-r from-cyan-500 to-blue-500 text-white text-lg font-semibold shadow-lg shadow-cyan-500/30 transition-transform hover:scale-105"
          >
            Começar recuperação
          </button>
        </div>
      </div>
    </div>
  );
}
