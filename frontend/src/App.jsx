import { useEffect, useState } from "react";
import {
  Routes,
  Route,
  Link,
  NavLink,
  Navigate,
  Outlet,
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
import CareerFavorites from "./pages/CareerFavorites";
import DiscoverySummaryDashboard from "./pages/DiscoverySummaryDashboard";
import DiscoveryWorkflowLayout from "./components/DiscoveryWorkflowLayout";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import api from "./api/axios";
import logoIcon from "./assets/logo.png";
import { AUTH_SESSION_EXPIRED_EVENT, getStoredUser } from "./utils/storage";
import useStaleOverlayCleanup from "./utils/useStaleOverlayCleanup";
import {
  BarChart3,
  BriefcaseBusiness,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  ShieldCheck,
  UsersRound,
} from "lucide-react";

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
    if (!token || user?.role === "admin") {
      return;
    }

    let isMounted = true;

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
            "Không kiểm tra được hồ sơ. Vui lòng thử lại."
        );
        setStatus("error");
      });

    return () => {
      isMounted = false;
    };
  }, [location.pathname, token, user?.role]);

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (user?.role === "admin") {
    return children;
  }

  if (status === "loading") {
    return (
      <section className="card profile-card">
        <p className="muted">Đang kiểm tra hồ sơ...</p>
      </section>
    );
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

const adminNavItems = [
  {
    to: "/admin",
    label: "Tổng quan",
    end: true,
    icon: LayoutDashboard,
  },
  {
    to: "/admin/users",
    label: "Người dùng",
    icon: UsersRound,
  },
  {
    to: "/admin/careers",
    label: "Nghề nghiệp",
    icon: BriefcaseBusiness,
  },
  {
    to: "/admin/elements",
    label: "Năng lực",
    icon: BarChart3,
  },
  {
    to: "/admin/core-quiz",
    label: "Câu hỏi khảo sát",
    icon: ClipboardList,
  },
];

function AdminOnly({ children }) {
  const location = useLocation();
  const token = localStorage.getItem("token");
  const user = getStoredUser();

  if (!token) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (user?.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return children;
}

function AdminDashboard() {
  return (
    <div className="admin-dashboard-page">
      <div className="page-header admin-dashboard-header">
        <span className="admin-eyebrow">Admin console</span>
        <h1>Bảng điều khiển quản trị</h1>
        <p>
          Khu vực quản trị tập trung vào quản lý dữ liệu, tài khoản và cấu hình
          khảo sát. Các chức năng trải nghiệm của học sinh vẫn tồn tại ở hệ
          thống chính, nhưng không đặt trong menu admin.
        </p>
      </div>

      <section className="admin-overview-grid">
        {adminNavItems.slice(1).map((item) => {
          const Icon = item.icon;

          return (
            <NavLink className="admin-overview-card" key={item.to} to={item.to}>
              <Icon size={22} aria-hidden="true" />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </section>
    </div>
  );
}

function AdminLayout() {
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar" aria-label="Điều hướng quản trị">
        <div className="admin-sidebar-brand">
          <ShieldCheck size={22} aria-hidden="true" />
          <div>
            <strong>Quản trị</strong>
            <span>Career Guidance</span>
          </div>
        </div>

        <nav className="admin-sidebar-nav">
          {adminNavItems.map((item) => {
            const Icon = item.icon;

            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `admin-sidebar-link${isActive ? " active" : ""}`
                }
              >
                <Icon size={18} aria-hidden="true" />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>
      </aside>

      <section className="admin-content">
        <Outlet />
      </section>
    </div>
  );
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
  const isAdminPage = location.pathname.startsWith("/admin");

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
            {token && !isAdmin && <Link to="/discovery">Hành trình khám phá</Link>}
            {token && !isAdmin && <Link to="/career-explore-chats">Hội thoại nghề</Link>}

            {token && !isAdmin && <Link to="/favorite-careers">Nghề yêu thích</Link>}

            {token ? (
              <>
                {isAdmin && (
                  <Link className="nav-admin-link" to="/admin">
                    <ShieldCheck size={16} aria-hidden="true" />
                    Quản trị
                  </Link>
                )}
                <Link to="/profile">Hồ sơ</Link>
                <button onClick={handleLogout}>
                  <LogOut size={16} aria-hidden="true" />
                  Đăng xuất
                </button>
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
            : `container${isDiscoveryPage ? " discovery-container" : ""}${
                isAdminPage ? " admin-container" : ""
              }`
        }
      >
        <Routes>
          <Route path="/" element={<LandingPage />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
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
          <Route path="/favorites" element={<Navigate to="/favorite-careers" replace />} />
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
          <Route
            path="/favorite-careers"
            element={
              <BasicProfileGate>
                <CareerFavorites />
              </BasicProfileGate>
            }
          />
          <Route
            path="/admin"
            element={
              <AdminOnly>
                <AdminLayout />
              </AdminOnly>
            }
          >
            <Route index element={<AdminDashboard />} />
            <Route path="careers" element={<AdminCareers />} />
            <Route path="core-quiz" element={<AdminCoreQuiz />} />
            <Route path="elements" element={<AdminElements />} />
            <Route path="users" element={<AdminUsers />} />
          </Route>
        </Routes>
      </main>
    </div>
  );
}

export default App;
