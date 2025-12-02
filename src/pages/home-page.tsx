import { useNavigate } from "react-router-dom";

export function HomePage() {
  const nextPage = useNavigate();

  const handleNextPage = () => {
    nextPage("scanpage");
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-20">
      <h1 className="text-5xl font-semibold">Welcome to FindBack</h1>
      <button
        onClick={handleNextPage}
        className="h-20 w-40 rounded-2xl bg-[#1E6E8C] hover:bg-[#25C0F4]"
      >
        Start Scan
      </button>
    </div>
  );
}
