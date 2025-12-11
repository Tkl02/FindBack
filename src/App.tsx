import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./App.css";
import { HomePage } from "./pages/HomePage.tsx";
import { SelectDiskPage } from "./pages/SelectDiskPage.tsx";
import { ResultsPage } from "./pages/ResultsPage.tsx";

function App() {
  return (
    <div className="min-h-screen w-screen bg-linear-to-br from-[#0f0c29] via-[#302b63] to-[#24243e]">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/select-disk" element={<SelectDiskPage />} />
          <Route path="/results" element={<ResultsPage />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
