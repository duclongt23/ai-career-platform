import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../api/axios";
import logoIcon from "../assets/logo.png";
import landingVisual from "../assets/landing-visual.jpg";

const storyCards = [
  {
    step: "01",
    title: "Lắng nghe cách bạn nghĩ",
    text: "AI bắt đầu từ sở thích, nhịp học tập và những điều bạn thấy có ý nghĩa.",
  },
  {
    step: "02",
    title: "Ghép tín hiệu thành bản đồ",
    text: "RIASEC, giá trị cá nhân và câu trả lời mở được nối lại thành hồ sơ định hướng.",
  },
  {
    step: "03",
    title: "Gợi ý con đường kế tiếp",
    text: "Bạn nhận được nhóm ngành phù hợp và lý do rõ ràng để tiếp tục khám phá.",
  },
];

function LandingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const initialAuthMode = location.state?.authMode || "login";
  const [authOpen, setAuthOpen] = useState(Boolean(location.state?.authMode));
  const [authMode, setAuthMode] = useState(initialAuthMode);
  const [authRedirect, setAuthRedirect] = useState(
    location.state?.from || "/discovery"
  );
  const [notice, setNotice] = useState(location.state?.message || "");
  const [loginForm, setLoginForm] = useState({ email: "", password: "" });
  const [registerForm, setRegisterForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [loading, setLoading] = useState(false);

  const isValidEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const openAuth = (mode = "login", redirectTo = "/discovery") => {
    const token = localStorage.getItem("token");

    if (token) {
      navigate(redirectTo);
      return;
    }

    setAuthMode(mode);
    setAuthRedirect(redirectTo);
    setNotice("");
    setAuthOpen(true);
    setError("");
    setEmailError("");
  };

  const storeAuth = (data) => {
    localStorage.setItem("token", data.token);
    localStorage.setItem("refreshToken", data.refreshToken);
    localStorage.setItem("user", JSON.stringify(data.user));
  };

  const handleLoginChange = (e) => {
    setLoginForm({ ...loginForm, [e.target.name]: e.target.value });
  };

  const handleRegisterChange = (e) => {
    const { name, value } = e.target;

    setRegisterForm({ ...registerForm, [name]: value });

    if (name === "email") {
      setEmailError(
        value && !isValidEmail(value) ? "Email không đúng định dạng" : ""
      );
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.post("/auth/login", loginForm);
      storeAuth(res.data);
      navigate(authRedirect, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    if (!isValidEmail(registerForm.email)) {
      setEmailError("Email không đúng định dạng");
      return;
    }

    setLoading(true);

    try {
      const res = await api.post("/auth/register", registerForm);
      storeAuth(res.data);
      navigate("/profile/setup", {
        replace: true,
        state: { from: authRedirect },
      });
    } catch (err) {
      setError(err.response?.data?.message || "Đăng ký thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="landing-page">
      <header className="landing-nav">
        <Link to="/" className="landing-logo" aria-label="Career Guidance">
          <img src={logoIcon} alt="" aria-hidden="true" />
          <span>career</span>
          <strong>guidance</strong>
        </Link>

        <div className="landing-nav-actions">
          <button type="button" onClick={() => openAuth("login")}>
            Đăng nhập
          </button>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero-copy">
          <p className="landing-eyebrow">AI career discovery</p>
          <h1>
            career <span>guidance</span>
          </h1>
          <p className="landing-subtitle">
            Một cách nhẹ nhàng để khám phá bản thân, nhìn thấy khả năng tương
            lai và chọn bước học tập kế tiếp với AI.
          </p>
          <div className="landing-cta-row">
            <button type="button" onClick={() => openAuth("register")}>
              Bắt đầu
            </button>
            <a href="#story">Xem cách hoạt động</a>
          </div>
        </div>

        <div className="future-visual" aria-hidden="true">
          <img src={landingVisual} alt="" />
        </div>

        <a className="scroll-cue" href="#story" aria-label="Cuộn xuống">
          <span />
        </a>
      </section>

      <section className="landing-story" id="story">
        <div className="story-heading">
          <p className="landing-eyebrow">How it works</p>
          <h2>AI giúp bạn nối các mảnh ghép về chính mình.</h2>
        </div>

        <div className="story-grid">
          {storyCards.map((card) => (
            <article className="story-card" key={card.step}>
              <span>{card.step}</span>
              <h3>{card.title}</h3>
              <p>{card.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-final">
        <div>
          <p className="landing-eyebrow">Ready</p>
          <h2>Bắt đầu bằng một tài khoản, tiếp tục bằng hành trình của bạn.</h2>
        </div>
        <button type="button" onClick={() => openAuth("register")}>
          Bắt đầu khám phá
        </button>
      </section>

      {authOpen && (
        <div className="auth-overlay" role="dialog" aria-modal="true">
          <div className="auth-modal">
            <button
              type="button"
              className="auth-close"
              onClick={() => setAuthOpen(false)}
              aria-label="Đóng"
            >
              ×
            </button>

            <div className="auth-tabs" aria-label="Chọn hình thức xác thực">
              <button
                type="button"
                className={authMode === "login" ? "active" : ""}
                onClick={() => {
                  setAuthMode("login");
                  setError("");
                }}
              >
                Đăng nhập
              </button>
              <button
                type="button"
                className={authMode === "register" ? "active" : ""}
                onClick={() => {
                  setAuthMode("register");
                  setError("");
                }}
              >
                Đăng ký
              </button>
            </div>

            <div className="auth-copy">
              <h2>
                {authMode === "login"
                  ? "Đăng nhập với email"
                  : "Tạo tài khoản mới"}
              </h2>
              <p>
                {authMode === "login"
                  ? "Tiếp tục hành trình khám phá nghề nghiệp của bạn."
                  : "Lưu hồ sơ khám phá và nhận gợi ý phù hợp hơn theo thời gian."}
              </p>
            </div>

            {error && <p className="error">{error}</p>}
            {notice && <p className="auth-notice">{notice}</p>}

            {authMode === "login" ? (
              <form className="landing-auth-form" onSubmit={handleLogin}>
                <label>Email</label>
                <input
                  name="email"
                  type="email"
                  value={loginForm.email}
                  onChange={handleLoginChange}
                  placeholder="email@example.com"
                  required
                />

                <label>Mật khẩu</label>
                <input
                  name="password"
                  type="password"
                  value={loginForm.password}
                  onChange={handleLoginChange}
                  placeholder="Nhập mật khẩu"
                  required
                />

                <div className="auth-form-meta">
                  <Link to="/forgot-password">Quên mật khẩu?</Link>
                </div>

                <button type="submit" disabled={loading}>
                  {loading ? "Đang đăng nhập..." : "Đăng nhập"}
                </button>
              </form>
            ) : (
              <form
                className="landing-auth-form"
                onSubmit={handleRegister}
                noValidate
              >
                <label>Họ tên</label>
                <input
                  name="name"
                  value={registerForm.name}
                  onChange={handleRegisterChange}
                  placeholder="Tên của bạn"
                  required
                />

                <label>Email</label>
                <input
                  name="email"
                  type="email"
                  value={registerForm.email}
                  onChange={handleRegisterChange}
                  placeholder="email@example.com"
                  required
                />
                {emailError && <p className="field-error">{emailError}</p>}

                <label>Mật khẩu</label>
                <input
                  name="password"
                  type="password"
                  value={registerForm.password}
                  onChange={handleRegisterChange}
                  placeholder="Tối thiểu 6 ký tự"
                  required
                />

                <button type="submit" disabled={loading}>
                  {loading ? "Đang đăng ký..." : "Đăng ký"}
                </button>
              </form>
            )}

            <button
              type="button"
              className="auth-switch"
              onClick={() => {
                setAuthMode(authMode === "login" ? "register" : "login");
                setError("");
              }}
            >
              {authMode === "login"
                ? "Chưa có tài khoản? Đăng ký"
                : "Đã có tài khoản? Đăng nhập"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default LandingPage;
