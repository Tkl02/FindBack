import { useNavigate } from "react-router-dom";

export function HomePage() {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col justify-center items-center w-screen h-screen gap-5">
      <div className="">
        <h1 className="text-7xl font-black text-white">Find Back</h1>
      </div>
      <div className="">
        <p className="text-lg text-slate-300 max-w-2xl mx-auto">Recupere seus dados de maneira facil e rapido</p>
      </div>
      <div>
        <button onClick={() => navigate("/select-disk")} className="w-60 h-14 rounded-xl
         bg-cyan-300/20 border border-cyan-300/30
         text-xl font-medium text-cyan-100
         transition-all duration-300 ease-out
         hover:scale-105 hover:bg-cyan-300/30
         active:scale-95
         backdrop-blur-sm shadow-lg shadow-cyan-300/10">
          Iniciar Recuperação
        </button>
      </div>

    </div>
  );
}
