import { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../api/axios";

function ResetPassword() {
  const location = useLocation();
  const navigate = useNavigate();
  const token = useMemo(
    () => new URLSearchParams(location.search).get("token") || "",
    [location.search]
  );
  const [form, setForm] = useState({
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Link đặt lại mật khẩu không hợp lệ hoặc thiếu token.");
      return;
    }

    if (form.password.length < 6) {
      setError("Mật khẩu mới phải có ít nhất 6 ký tự.");
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setLoading(true);

    try {
      const res = await api.post(
        "/auth/reset-password",
        {
          token,
          password: form.password,
        },
        { skipAuth: true }
      );

      navigate("/login", {
        replace: true,
        state: {
          message: res.data.message || "Đổi mật khẩu thành công. Vui lòng đăng nhập lại.",
        },
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Không đổi được mật khẩu. Vui lòng thử lại."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card form-card">
      <h1>Đặt lại mật khẩu</h1>
      <p className="muted">Tạo mật khẩu mới cho tài khoản của bạn.</p>

      {!token && (
        <p className="error">Link đặt lại mật khẩu không hợp lệ hoặc thiếu token.</p>
      )}
      {error && <p className="error">{error}</p>}

      <form onSubmit={handleSubmit}>
        <label>Mật khẩu mới</label>
        <input
          name="password"
          type="password"
          value={form.password}
          onChange={handleChange}
          placeholder="Tối thiểu 6 ký tự"
          required
        />

        <label>Xác nhận mật khẩu</label>
        <input
          name="confirmPassword"
          type="password"
          value={form.confirmPassword}
          onChange={handleChange}
          placeholder="Nhập lại mật khẩu mới"
          required
        />

        <button type="submit" disabled={loading || !token}>
          {loading ? "Đang đổi mật khẩu..." : "Đổi mật khẩu"}
        </button>
      </form>

      <p className="auth-form-footer">
        <Link to="/login">Quay lại đăng nhập</Link>
      </p>
    </div>
  );
}

export default ResetPassword;
