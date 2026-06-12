import { useEffect, useState } from "react";
import {
  Routes,
  Route,
  Link,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import Profile from "./pages/Profile";
import ProfileSetup from "./pages/ProfileSetup";
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
import logoIcon from "./assets/logo.png";
import { AUTH_SESSION_EXPIRED_EVENT, getStoredUser } from "./utils/storage";
import useStaleOverlayCleanup from "./utils/useStaleOverlayCleanup";

function AuthRedirect({ mode }) {
  const location = useLocation();

  return (
    <Navigate
      to="/"
      replace
      state={{
        ...location.state,
        authMode: mode,
      }}
    />
  );
}

function hasBasicProfile(profile) {
  return Boolean(
    profile?.grade &&
      profile?.favoriteSubjects?.length &&
      profile?.strongSubjects?.length &&
      profile?.goal?.trim()
  );
}

function BasicProfileGate({ children }) {
  const location = useLocation();
  const token = localStorage.getItem("token");
  const user = getStoredUser();
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("unauthenticated");
      return;
    }

    if (user?.role === "admin") {
      setStatus("ready");
      return;
    }

    let isMounted = true;
    setStatus("loading");
    setError("");

    api
      .get("/profile")
      .then((res) => {
        if (!isMounted) return;
        setStatus(hasBasicProfile(res.data) ? "ready" : "needsSetup");
      })
      .catch((err) => {
        if (!isMounted) return;

        if (err.response?.status === 404) {
          setStatus("needsSetup");
          return;
        }

        if (err.response?.status === 401) {
          setStatus("unauthenticated");
          return;
        }

        setError(
          err.response?.data?.message ||
            "Khong kiem tra duoc ho so. Vui long thu lai."
        );
        setStatus("error");
      });

    return () => {
      isMounted = false;
    };
  }, [location.pathname, token, user?.role]);

  if (status === "loading") {
    return (
      <section className="card profile-card">
        <p className="muted">Dang kiem tra ho so...</p>
      </section>
    );
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (status === "needsSetup") {
    return (
      <Navigate
        to="/profile/setup"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  if (status === "error") {
    return <p className="error">{error}</p>;
  }

  return children;
}

function App() {
  useStaleOverlayCleanup();

  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem("token");
  const user = getStoredUser();
  const isAdmin = user?.role === "admin";
  const isLandingPage = location.pathname === "/";
  const isDiscoveryPage = location.pathname.startsWith("/discovery");

  useEffect(() => {
    const handleSessionExpired = () => {
      navigate("/login", {
        replace: true,
        state: {
          message: "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.",
        },
      });
    };

    window.addEventListener(AUTH_SESSION_EXPIRED_EVENT, handleSessionExpired);

    return () => {
      window.removeEventListener(
        AUTH_SESSION_EXPIRED_EVENT,
        handleSessionExpired
      );
    };
  }, [navigate]);

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
      {!isLandingPage && (
        <nav className="navbar">
          <Link to="/" className="landing-logo app-logo" aria-label="Career Guidance">
            <img src={logoIcon} alt="" aria-hidden="true" />
            <span>career</span>
            <strong>guidance</strong>
          </Link>

          <div className="nav-links">
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
              <Link className="nav-auth-link" to="/login">
                Đăng nhập
              </Link>
            )}
          </div>
        </nav>
      )}

      <main
        className={
          isLandingPage
            ? "landing-container"
            : `container${isDiscoveryPage ? " discovery-container" : ""}`
        }
      >
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/register" element={<AuthRedirect mode="register" />} />
          <Route path="/login" element={<AuthRedirect mode="login" />} />
          <Route path="/profile/setup" element={<ProfileSetup />} />
          <Route
            path="/profile"
            element={
              <BasicProfileGate>
                <Profile />
              </BasicProfileGate>
            }
          />
          <Route path="/careers" element={<Navigate to="/" replace />} />
          <Route path="/career-recommendations" element={<Navigate to="/discovery/recommendations" replace />} />
          <Route path="/riasec-info" element={<RiasecInfo />} />
          <Route path="/riasec-test" element={<Navigate to="/discovery/riasec" replace />} />
          <Route path="/core-quiz" element={<Navigate to="/discovery/core-quiz" replace />} />
          <Route path="/ai-discovery" element={<Navigate to="/discovery/ai-discovery" replace />} />
          <Route
            path="/discovery"
            element={
              <BasicProfileGate>
                <DiscoveryWorkflowLayout />
              </BasicProfileGate>
            }
          >
            <Route index element={<Navigate to="riasec" replace />} />
            <Route path="riasec" element={<RiasecTest />} />
            <Route path="core-quiz" element={<CoreQuizPage />} />
            <Route path="ai-discovery" element={<AiDiscoveryPage />} />
            <Route path="dashboard" element={<DiscoverySummaryDashboard />} />
            <Route path="recommendations" element={<CareerRecommendations />} />
          </Route>
          <Route
            path="/careers/:id"
            element={
              <BasicProfileGate>
                <CareerDetail />
              </BasicProfileGate>
            }
          />
          <Route
            path="/careers/:id/explore-chat"
            element={
              <BasicProfileGate>
                <CareerExploreChat />
              </BasicProfileGate>
            }
          />
          <Route
            path="/career-explore-chats"
            element={
              <BasicProfileGate>
                <CareerExploreChats />
              </BasicProfileGate>
            }
          />
          <Route
            path="/career-explore-chats/:id"
            element={
              <BasicProfileGate>
                <CareerExploreChats />
              </BasicProfileGate>
            }
          />
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
