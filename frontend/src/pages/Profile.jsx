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
  const [form, setForm] = useState(emptyProfileForm);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(Boolean(token));

  const handleProfileLoadError = (err) => {
    if (err.response?.status === 404) {
      console.log("Chua co profile, nguoi dung can tao moi");
      setForm(emptyProfileForm);
      setIsEditing(true);
      setError("");
      return;
    }

    if (err.response?.status !== 401) {
      setError(
        err.response?.data?.message ||
          "Khong tai duoc ho so. Vui long thu lai."
      );
    }
  };

  useEffect(() => {
    if (!token) {
      navigate("/login");
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
  }, [navigate, token]);

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

      setMessage("Luu ho so thanh cong");
      setIsEditing(false);
    } catch (err) {
      setError(err.response?.data?.message || "Luu ho so that bai");
    }
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

  if (isLoading) {
    return (
      <section className="card profile-card">
        <p className="muted">Dang tai ho so...</p>
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
            <h1>{user.name || "Ho so hoc sinh"}</h1>
            <p>{user.email || "Cap nhat thong tin ca nhan cua ban"}</p>
          </div>

          {!isEditing && (
            <button type="button" onClick={() => setIsEditing(true)}>
              Chỉnh sửa thông tin
            </button>
          )}
        </div>
      </section>

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}

      {!isEditing ? (
        <div className="profile-grid">
          <section className="card profile-card profile-summary">
            <h2>Thong tin hoc tap</h2>
            <div className="profile-stat">
              <span>Lớp hiện tại</span>
              <strong>Lớp {form.grade}</strong>
            </div>
            <div className="profile-stat">
              <span>Mục tiêu</span>
              <p>{form.goal || "Chưa cập nhật mục tiêu học tập."}</p>
            </div>
            <div className="profile-stat">
              <span>Ma RIASEC</span>
              <strong>{form.riasecCode || "Chua lam test"}</strong>
              {riasecDate ? (
                <p>Cap nhat ngay {riasecDate}</p>
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
              "Chua co mon hoc yeu thich."
            )}
          </section>

          <section className="card profile-card">
            <h2>Môn học học tốt</h2>
            {renderTags(form.strongSubjects, "Chua co mon hoc noi bat.")}
          </section>
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
