import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { getStoredUser } from "../utils/storage";

const emptyProfileForm = {
  grade: 10,
  favoriteSubjects: "",
  strongSubjects: "",
  goal: "",
  riasecCode: "",
  riasecCompletedAt: "",
};

const emptyPasswordForm = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

function profileToForm(profile = {}) {
  return {
    grade: profile.grade || 10,
    favoriteSubjects: (profile.favoriteSubjects || []).join(", "),
    strongSubjects: (profile.strongSubjects || []).join(", "),
    goal: profile.goal || "",
    riasecCode: profile.riasecCode || "",
    riasecCompletedAt: profile.riasecCompletedAt || "",
  };
}

function Profile() {
  const navigate = useNavigate();
  const token = localStorage.getItem("token");
  const user = getStoredUser();
  const isAdmin = user?.role === "admin";
  const [form, setForm] = useState(emptyProfileForm);
  const [passwordForm, setPasswordForm] = useState(emptyPasswordForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isPasswordEditing, setIsPasswordEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(token && !isAdmin));

  const handleProfileLoadError = (err) => {
    if (err.response?.status === 404) {
      console.log("Chưa có profile, người dùng cần tạo mới");
      setForm(emptyProfileForm);
      setIsEditing(true);
      setError("");
      return;
    }

    if (err.response?.status !== 401) {
      setError(
        err.response?.data?.message ||
          "Không tải được hồ sơ. Vui lòng thử lại."
      );
    }
  };

  useEffect(() => {
    if (!token) {
      navigate("/login");
      return;
    }

    if (isAdmin) {
      return;
    }

    let isMounted = true;

    api
      .get("/profile")
      .then((res) => {
        if (!isMounted) return;

        setForm(profileToForm(res.data));
        setError("");
      })
      .catch((err) => {
        if (!isMounted) return;

        handleProfileLoadError(err);
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [isAdmin, navigate, token]);

  const toArray = (text) => {
    return text
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item !== "");
  };

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handlePasswordChange = (e) => {
    setPasswordForm({
      ...passwordForm,
      [e.target.name]: e.target.value,
    });
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    try {
      const payload = {
        grade: Number(form.grade),
        favoriteSubjects: toArray(form.favoriteSubjects),
        strongSubjects: toArray(form.strongSubjects),
        goal: form.goal,
      };

      await api.put("/profile", payload);
      const res = await api.get("/profile");
      setForm(profileToForm(res.data));

      setMessage("Lưu hồ sơ thành công");
      setIsEditing(false);
    } catch (err) {
      setError(err.response?.data?.message || "Lưu hồ sơ thất bại");
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError("");

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError("Mật khẩu mới và xác nhận mật khẩu không khớp.");
      return;
    }

    setPasswordSaving(true);

    try {
      await api.put("/auth/password", {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
      });

      localStorage.removeItem("token");
      localStorage.removeItem("refreshToken");
      localStorage.removeItem("user");
      navigate("/login", {
        replace: true,
        state: {
          message: "Đổi mật khẩu thành công. Vui lòng đăng nhập lại.",
        },
      });
    } catch (err) {
      setPasswordError(
        err.response?.data?.message || "Đổi mật khẩu thất bại."
      );
    } finally {
      setPasswordSaving(false);
    }
  };

  const closePasswordForm = () => {
    setIsPasswordEditing(false);
    setPasswordError("");
    setPasswordForm(emptyPasswordForm);
  };

  const renderTags = (text, emptyText) => {
    const items = toArray(text);

    if (items.length === 0) {
      return <p className="profile-empty">{emptyText}</p>;
    }

    return (
      <div className="profile-tags">
        {items.map((item) => (
          <span key={item}>{item}</span>
        ))}
      </div>
    );
  };

  const riasecDate = form.riasecCompletedAt
    ? new Date(form.riasecCompletedAt).toLocaleDateString("vi-VN")
    : "";

  const renderPasswordModal = () => (
    <div
      className="profile-password-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-password-modal-title"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          closePasswordForm();
        }
      }}
    >
      <section className="card profile-password-modal">
      <h2 id="profile-password-modal-title">Đổi mật khẩu</h2>
      <p className="muted">
        Đổi mật khẩu định kỳ giúp bảo vệ tài khoản tốt hơn. Sau khi đổi mật
        khẩu, bạn cần đăng nhập lại.
      </p>

      {passwordError && <p className="error">{passwordError}</p>}

      <form onSubmit={handleChangePassword}>
        <label>Mật khẩu hiện tại</label>
        <input
          autoComplete="current-password"
          name="currentPassword"
          type="password"
          value={passwordForm.currentPassword}
          onChange={handlePasswordChange}
          placeholder="Nhập mật khẩu hiện tại"
          required
        />

        <label>Mật khẩu mới</label>
        <input
          autoComplete="new-password"
          name="newPassword"
          type="password"
          value={passwordForm.newPassword}
          onChange={handlePasswordChange}
          placeholder="Tối thiểu 6 ký tự"
          required
        />

        <label>Xác nhận mật khẩu mới</label>
        <input
          autoComplete="new-password"
          name="confirmPassword"
          type="password"
          value={passwordForm.confirmPassword}
          onChange={handlePasswordChange}
          placeholder="Nhập lại mật khẩu mới"
          required
        />

        <div className="profile-actions">
          <button type="submit" disabled={passwordSaving}>
            {passwordSaving ? "Đang đổi mật khẩu..." : "Đổi mật khẩu"}
          </button>
          <button
            className="secondary-button"
            type="button"
            onClick={closePasswordForm}
          >
            Hủy
          </button>
        </div>
      </form>
      </section>
    </div>
  );

  if (isLoading) {
    return (
      <section className="card profile-card">
        <p className="muted">Đang tải hồ sơ...</p>
      </section>
    );
  }

  return (
    <div className="profile-page">
      <section className="profile-hero">
        <div className="profile-cover"></div>

        <div className="profile-header">
          <div className="profile-avatar">
            {(user.name || "H").charAt(0).toUpperCase()}
          </div>

          <div className="profile-title">
            <h1>{user.name || "Hồ sơ học sinh"}</h1>
            <p>{user.email || "Cập nhật thông tin cá nhân của bạn"}</p>
          </div>

          {!isEditing && (
            <div className="profile-actions">
              {!isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    setIsPasswordEditing(false);
                    setIsEditing(true);
                  }}
                >
                  Chỉnh sửa thông tin
                </button>
              )}
              <button
                className="secondary-button"
                disabled={isPasswordEditing}
                type="button"
                onClick={() => setIsPasswordEditing(true)}
              >
                Đổi mật khẩu
              </button>
            </div>
          )}
        </div>
      </section>

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}

      {isAdmin ? (
        <div className="profile-grid">
          <section className="card profile-card profile-summary">
            <h2>Tài khoản quản trị</h2>
            <div className="profile-stat">
              <span>Họ tên</span>
              <strong>{user.name || "Admin"}</strong>
            </div>
            <div className="profile-stat">
              <span>Email</span>
              <p>{user.email}</p>
            </div>
            <div className="profile-stat">
              <span>Vai trò</span>
              <strong>Admin</strong>
            </div>
          </section>

          {isPasswordEditing && renderPasswordModal()}
        </div>
      ) : !isEditing ? (
        <div className="profile-grid">
          <section className="card profile-card profile-summary">
            <h2>Thông tin học tập</h2>
            <div className="profile-stat">
              <span>Lớp hiện tại</span>
              <strong>Lớp {form.grade}</strong>
            </div>
            <div className="profile-stat">
              <span>Mục tiêu</span>
              <p>{form.goal || "Chưa cập nhật mục tiêu học tập."}</p>
            </div>
            <div className="profile-stat">
              <span>Mã RIASEC</span>
              <strong>{form.riasecCode || "Chưa làm test"}</strong>
              {riasecDate ? (
                <p>Cập nhật ngày {riasecDate}</p>
              ) : (
                <p>Làm bài test RIASEC để nhận gợi ý nghề nghiệp phù hợp.</p>
              )}
              <button
                type="button"
                className="profile-riasec-button"
                onClick={() => navigate("/discovery/riasec")}
              >
                {form.riasecCode ? "Làm lại RIASEC" : "Làm test RIASEC"}
              </button>
            </div>
          </section>

          <section className="card profile-card">
            <h2>Môn học yêu thích</h2>
            {renderTags(
              form.favoriteSubjects,
              "Chưa có môn học yêu thích."
            )}
          </section>

          <section className="card profile-card">
            <h2>Môn học học tốt</h2>
            {renderTags(form.strongSubjects, "Chưa có môn học nổi bật.")}
          </section>

          {isPasswordEditing && renderPasswordModal()}
        </div>
      ) : (
        <section className="card profile-edit-card">
          <h2>Chỉnh sửa thông tin</h2>
          <p className="muted">
            Các mục có nhiều giá trị hãy cách nhau bằng dấu phẩy.
          </p>

          <form onSubmit={handleSaveProfile}>
            <label>Lớp hiện tại</label>
            <select name="grade" value={form.grade} onChange={handleChange}>
              <option value={10}>Lop 10</option>
              <option value={11}>Lop 11</option>
              <option value={12}>Lop 12</option>
            </select>

            <label>Môn học yêu thích</label>
            <input
              name="favoriteSubjects"
              value={form.favoriteSubjects}
              onChange={handleChange}
              placeholder="Ví dụ: Toán, Tin học, Tiếng Anh"
            />

            <label>Môn học học tốt</label>
            <input
              name="strongSubjects"
              value={form.strongSubjects}
              onChange={handleChange}
              placeholder="Ví dụ: Toán, Vật lý"
            />

            <label>Mục tiêu</label>
            <textarea
              name="goal"
              value={form.goal}
              onChange={handleChange}
              placeholder="Ví dụ: học đại học, học nghề, du học, đi làm sớm"
              rows="4"
            />

            <div className="profile-actions">
              <button type="submit">Lưu hồ sơ</button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => setIsEditing(false)}
              >
                Hủy
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}

export default Profile;
