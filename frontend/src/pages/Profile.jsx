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

          <button type="button" onClick={() => setIsEditing(!isEditing)}>
            {isEditing ? "Dong chinh sua" : "Sua thong tin"}
          </button>
        </div>
      </section>

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}

      {!isEditing ? (
        <div className="profile-grid">
          <section className="card profile-card profile-summary">
            <h2>Thong tin hoc tap</h2>
            <div className="profile-stat">
              <span>Lop hien tai</span>
              <strong>Lop {form.grade}</strong>
            </div>
            <div className="profile-stat">
              <span>Muc tieu</span>
              <p>{form.goal || "Chua cap nhat muc tieu hoc tap."}</p>
            </div>
            <div className="profile-stat">
              <span>Ma RIASEC</span>
              <strong>{form.riasecCode || "Chua lam test"}</strong>
              {riasecDate ? (
                <p>Cap nhat ngay {riasecDate}</p>
              ) : (
                <p>Lam bai test RIASEC de nhan goi y nghe nghiep phu hop.</p>
              )}
              <button
                type="button"
                className="profile-riasec-button"
                onClick={() => navigate("/discovery/riasec")}
              >
                {form.riasecCode ? "Lam lai RIASEC" : "Lam test RIASEC"}
              </button>
            </div>
          </section>

          <section className="card profile-card">
            <h2>Mon hoc yeu thich</h2>
            {renderTags(
              form.favoriteSubjects,
              "Chua co mon hoc yeu thich."
            )}
          </section>

          <section className="card profile-card">
            <h2>Mon hoc hoc tot</h2>
            {renderTags(form.strongSubjects, "Chua co mon hoc noi bat.")}
          </section>
        </div>
      ) : (
        <section className="card profile-edit-card">
          <h2>Chinh sua thong tin</h2>
          <p className="muted">
            Cac muc nhieu gia tri hay cach nhau bang dau phay.
          </p>

          <form onSubmit={handleSaveProfile}>
            <label>Lop hien tai</label>
            <select name="grade" value={form.grade} onChange={handleChange}>
              <option value={10}>Lop 10</option>
              <option value={11}>Lop 11</option>
              <option value={12}>Lop 12</option>
            </select>

            <label>Mon hoc yeu thich</label>
            <input
              name="favoriteSubjects"
              value={form.favoriteSubjects}
              onChange={handleChange}
              placeholder="Vi du: Toan, Tin hoc, Tieng Anh"
            />

            <label>Mon hoc hoc tot</label>
            <input
              name="strongSubjects"
              value={form.strongSubjects}
              onChange={handleChange}
              placeholder="Vi du: Toan, Vat ly"
            />

            <label>Muc tieu</label>
            <textarea
              name="goal"
              value={form.goal}
              onChange={handleChange}
              placeholder="Vi du: hoc dai hoc, hoc nghe, du hoc, di lam som"
              rows="4"
            />

            <div className="profile-actions">
              <button type="submit">Luu ho so</button>
              <button
                className="secondary-button"
                type="button"
                onClick={() => setIsEditing(false)}
              >
                Huy
              </button>
            </div>
          </form>
        </section>
      )}
    </div>
  );
}

export default Profile;
