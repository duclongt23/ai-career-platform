import { useState } from "react";
import { useNavigate, Link, useLocation } from "react-router-dom";
import api from "../api/axios";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const notice = location.state?.message;
  const redirectTo = location.state?.from || "/profile";

  const [form, setForm] = useState({
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await api.post("/auth/login", form);

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user", JSON.stringify(res.data.user));

      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Đăng nhập thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card form-card">
      <h1>Đăng nhập</h1>

      {notice && <p className="auth-notice">{notice}</p>}
      {error && <p className="error">{error}</p>}

      <form onSubmit={handleLogin}>
        <label>Email</label>
        <input
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
          placeholder="Nhập email"
          required
        />

        <label>Mật khẩu</label>
        <input
          name="password"
          type="password"
          value={form.password}
          onChange={handleChange}
          placeholder="Nhập mật khẩu"
          required
        />

        <button disabled={loading}>
          {loading ? "Đang đăng nhập..." : "Đăng nhập"}
        </button>
      </form>

      <p>
        Chưa có tài khoản? <Link to="/register">Đăng ký</Link>
      </p>
    </div>
  );
}

export default Login;
