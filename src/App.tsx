import { BrowserRouter, Route, Routes } from "react-router-dom";
import "./App.css";
//route
import { HomePage } from "./pages/home-page";
import { ScanPage } from "./pages/scanPage";

function App() {
  return (
    <div className="flex justify-center items-center h-screen w-screen  bg-[#181D25]">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="scanpage" element={<ScanPage />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;
