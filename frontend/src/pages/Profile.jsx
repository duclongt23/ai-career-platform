import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

function Profile() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    grade: 10,
    favoriteSubjects: "",
    strongSubjects: "",
    interests: "",
    skills: "",
    goal: "",
    riasecCode: "",
    riasecCompletedAt: "",
  });

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isEditing, setIsEditing] = useState(false);

  const token = localStorage.getItem("token");
  const user = JSON.parse(localStorage.getItem("user") || "{}");

  const fetchProfile = async () => {
    try {
      const res = await api.get("/profile");

      setForm({
        grade: res.data.grade,
        favoriteSubjects: res.data.favoriteSubjects.join(", "),
        strongSubjects: res.data.strongSubjects.join(", "),
        interests: res.data.interests.join(", "),
        skills: res.data.skills.join(", "),
        goal: res.data.goal,
        riasecCode: res.data.riasecCode || "",
        riasecCompletedAt: res.data.riasecCompletedAt || "",
      });
    } catch {
      console.log("Chưa có profile, người dùng cần tạo mới");
      setIsEditing(true);
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

        setForm({
          grade: res.data.grade,
          favoriteSubjects: res.data.favoriteSubjects.join(", "),
          strongSubjects: res.data.strongSubjects.join(", "),
          interests: res.data.interests.join(", "),
          skills: res.data.skills.join(", "),
          goal: res.data.goal,
          riasecCode: res.data.riasecCode || "",
          riasecCompletedAt: res.data.riasecCompletedAt || "",
        });
      })
      .catch(() => {
        if (!isMounted) return;

        console.log("Chưa có profile, người dùng cần tạo mới");
        setIsEditing(true);
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
        interests: toArray(form.interests),
        skills: toArray(form.skills),
        goal: form.goal,
      };

      await api.put("/profile", payload);
      await fetchProfile();

      setMessage("Lưu hồ sơ thành công");
      setIsEditing(false);
    } catch (err) {
      setError(err.response?.data?.message || "Lưu hồ sơ thất bại");
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

          <button type="button" onClick={() => setIsEditing(!isEditing)}>
            {isEditing ? "Đóng chỉnh sửa" : "Sửa thông tin"}
          </button>
        </div>
      </section>

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}

      {!isEditing ? (
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
                onClick={() => navigate("/riasec-test")}
              >
                {form.riasecCode ? "Làm lại RIASEC" : "Làm test RIASEC"}
              </button>
            </div>
          </section>

          <section className="card profile-card">
            <h2>Môn học yêu thích</h2>
            {renderTags(form.favoriteSubjects, "Chưa có môn học yêu thích.")}
          </section>

          <section className="card profile-card">
            <h2>Môn học học tốt</h2>
            {renderTags(form.strongSubjects, "Chưa có môn học nổi bật.")}
          </section>

          <section className="card profile-card">
            <h2>Sở thích</h2>
            {renderTags(form.interests, "Chưa cập nhật sở thích.")}
          </section>

          <section className="card profile-card">
            <h2>Kỹ năng hiện có</h2>
            {renderTags(form.skills, "Chưa cập nhật kỹ năng.")}
          </section>
        </div>
      ) : (
        <section className="card profile-edit-card">
          <h2>Chỉnh sửa thông tin</h2>
          <p className="muted">
            Các mục nhiều giá trị hãy cách nhau bằng dấu phẩy.
          </p>

          <form onSubmit={handleSaveProfile}>
            <label>Lớp hiện tại</label>
            <select name="grade" value={form.grade} onChange={handleChange}>
              <option value={10}>Lớp 10</option>
              <option value={11}>Lớp 11</option>
              <option value={12}>Lớp 12</option>
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

            <label>Sở thích</label>
            <input
              name="interests"
              value={form.interests}
              onChange={handleChange}
              placeholder="Ví dụ: Công nghệ, kinh doanh, thiết kế"
            />

            <label>Kỹ năng hiện có</label>
            <input
              name="skills"
              value={form.skills}
              onChange={handleChange}
              placeholder="Ví dụ: Tư duy logic, giao tiếp, tự học"
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
