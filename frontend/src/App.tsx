import { BrowserRouter, Routes, Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import MeasurePage from "./pages/MeasurePage";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/measure" element={<MeasurePage />} />
      </Routes>
    </BrowserRouter>
  );
}
