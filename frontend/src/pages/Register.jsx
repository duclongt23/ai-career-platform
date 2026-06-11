import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../api/axios";

function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
  });

  const [error, setError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [loading, setLoading] = useState(false);

  const isValidEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    setForm({
      ...form,
      [name]: value,
    });

    if (name === "email") {
      setEmailError(
        value && !isValidEmail(value) ? "Email không đúng định dạng" : ""
      );
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");

    if (!isValidEmail(form.email)) {
      setEmailError("Email không đúng định dạng");
      return;
    }

    setLoading(true);

    try {
      const res = await api.post("/auth/register", form);

      localStorage.setItem("token", res.data.token);
      localStorage.setItem("refreshToken", res.data.refreshToken);
      localStorage.setItem("user", JSON.stringify(res.data.user));

      navigate("/profile/setup", { state: { from: "/discovery" } });
    } catch (err) {
      setError(err.response?.data?.message || "Đăng ký thất bại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card form-card">
      <h1>Đăng ký</h1>

      {error && <p className="error">{error}</p>}

      <form onSubmit={handleRegister} noValidate>
        <label>Họ tên</label>
        <input
          name="name"
          value={form.name}
          onChange={handleChange}
          placeholder="Nhập họ tên"
          required
        />

        <label>Email</label>
        <input
          name="email"
          type="email"
          value={form.email}
          onChange={handleChange}
          placeholder="Nhập email"
          required
        />
        {emailError && <p className="field-error">{emailError}</p>}

        <label>Mật khẩu</label>
        <input
          name="password"
          type="password"
          value={form.password}
          onChange={handleChange}
          placeholder="Tối thiểu 6 ký tự"
          required
        />

        <button disabled={loading}>
          {loading ? "Đang đăng ký..." : "Đăng ký"}
        </button>
      </form>

      <p>
        Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
      </p>
    </div>
  );
}

export default Register;
