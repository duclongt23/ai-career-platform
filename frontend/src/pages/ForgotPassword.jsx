import { useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");
    setLoading(true);

    try {
      const res = await api.post(
        "/auth/forgot-password",
        { email },
        { skipAuth: true }
      );
      setMessage(res.data.message);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Không gửi được email đặt lại mật khẩu. Vui lòng thử lại."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card form-card">
      <h1>Quên mật khẩu</h1>
      <p className="muted">
        Nhập email tài khoản của bạn. Nếu email tồn tại, hệ thống sẽ gửi link
        đặt lại mật khẩu.
      </p>

      {message && <p className="auth-notice">{message}</p>}
      {error && <p className="error">{error}</p>}

      <form onSubmit={handleSubmit}>
        <label>Email</label>
        <input
          name="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="email@example.com"
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? "Đang gửi..." : "Gửi link đặt lại mật khẩu"}
        </button>
      </form>

      <p className="auth-form-footer">
        <Link to="/login">Quay lại đăng nhập</Link>
      </p>
    </div>
  );
}

export default ForgotPassword;
