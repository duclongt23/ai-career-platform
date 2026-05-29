import { Routes, Route, Link, Navigate, useNavigate } from "react-router-dom";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import Careers from "./pages/Careers";
import CareerDetail from "./pages/CareerDetail";
import AdminCareers from "./pages/AdminCareers";
import RiasecTest from "./pages/RiasecTest";
import RiasecInfo from "./pages/RiasecInfo";
import CoreQuizPage from "./pages/CoreQuizPage";

function App() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user"));
  const isAdmin = user?.role === "admin";

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <div>
      <nav className="navbar">
        <h2>AI Career Platform</h2>

        <div className="nav-links">
          <Link to="/careers">Ngành nghề</Link>
          <Link to="/riasec-test">RIASEC</Link>
          <Link to="/core-quiz">Khám phá bản thân</Link>

          {token ? (
            <>
              {isAdmin && <Link to="/admin/careers">Admin</Link>}
              <Link to="/profile">Hồ sơ</Link>
              <button onClick={handleLogout}>Đăng xuất</button>
            </>
          ) : (
            <>
              <Link to="/login">Đăng nhập</Link>
              <Link to="/register">Đăng ký</Link>
            </>
          )}
        </div>
      </nav>

      <main className="container">
        <Routes>
          <Route path="/" element={<Navigate to="/careers" />} />
          <Route path="/register" element={<Register />} />
          <Route path="/login" element={<Login />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/careers" element={<Careers />} />
          <Route path="/riasec-info" element={<RiasecInfo />} />
          <Route path="/riasec-test" element={<RiasecTest />} />
          <Route path="/core-quiz" element={<CoreQuizPage />} />
          <Route path="/careers/:id" element={<CareerDetail />} />
          <Route path="/admin/careers" element={<AdminCareers />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
