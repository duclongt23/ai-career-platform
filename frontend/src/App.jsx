import { Routes, Route, Link, Navigate, useNavigate } from "react-router-dom";
import Register from "./pages/Register";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import Careers from "./pages/Careers";
import CareerDetail from "./pages/CareerDetail";
import AdminCareers from "./pages/AdminCareers";
import AdminCoreQuiz from "./pages/AdminCoreQuiz";
import AdminElements from "./pages/AdminElements";
import AdminUsers from "./pages/AdminUsers";
import RiasecTest from "./pages/RiasecTest";
import RiasecInfo from "./pages/RiasecInfo";
import CoreQuizPage from "./pages/CoreQuizPage";
import AiDiscoveryPage from "./pages/AiDiscoveryPage";
import CareerRecommendations from "./pages/CareerRecommendations";
import CareerExploreChat from "./pages/CareerExploreChat";
import CareerExploreChats from "./pages/CareerExploreChats";
import DiscoverySummaryDashboard from "./pages/DiscoverySummaryDashboard";
import DiscoveryWorkflowLayout from "./components/DiscoveryWorkflowLayout";
import api from "./api/axios";

function App() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user"));
  const isAdmin = user?.role === "admin";

  const handleLogout = async () => {
    const refreshToken = localStorage.getItem("refreshToken");

    if (refreshToken) {
      try {
        await api.post("/auth/logout", { refreshToken });
      } catch {
        // Local logout should still complete if the refresh token is already invalid.
      }
    }

    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("user");
    navigate("/login");
  };

  return (
    <div>
      <nav className="navbar">
        <h2>AI Career Platform</h2>

        <div className="nav-links">
          <Link to="/careers">Ngành nghề</Link>
          {token && <Link to="/discovery">Hành trình khám phá</Link>}
          {token && <Link to="/career-explore-chats">Hội thoại nghề</Link>}

          {token ? (
            <>
              {isAdmin && <Link to="/admin/careers">Admin Careers</Link>}
              {isAdmin && <Link to="/admin/core-quiz">Admin Quiz</Link>}
              {isAdmin && <Link to="/admin/elements">Admin Elements</Link>}
              {isAdmin && <Link to="/admin/users">Admin Users</Link>}
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
          <Route path="/career-recommendations" element={<Navigate to="/discovery/recommendations" replace />} />
          <Route path="/riasec-info" element={<RiasecInfo />} />
          <Route path="/riasec-test" element={<Navigate to="/discovery/riasec" replace />} />
          <Route path="/core-quiz" element={<Navigate to="/discovery/core-quiz" replace />} />
          <Route path="/ai-discovery" element={<Navigate to="/discovery/ai-discovery" replace />} />
          <Route path="/discovery" element={<DiscoveryWorkflowLayout />}>
            <Route index element={<Navigate to="riasec" replace />} />
            <Route path="riasec" element={<RiasecTest />} />
            <Route path="core-quiz" element={<CoreQuizPage />} />
            <Route path="ai-discovery" element={<AiDiscoveryPage />} />
            <Route path="dashboard" element={<DiscoverySummaryDashboard />} />
            <Route path="recommendations" element={<CareerRecommendations />} />
          </Route>
          <Route path="/careers/:id" element={<CareerDetail />} />
          <Route path="/careers/:id/explore-chat" element={<CareerExploreChat />} />
          <Route path="/career-explore-chats" element={<CareerExploreChats />} />
          <Route path="/career-explore-chats/:id" element={<CareerExploreChats />} />
          <Route path="/admin/careers" element={<AdminCareers />} />
          <Route path="/admin/core-quiz" element={<AdminCoreQuiz />} />
          <Route path="/admin/elements" element={<AdminElements />} />
          <Route path="/admin/users" element={<AdminUsers />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
