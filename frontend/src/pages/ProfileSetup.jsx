import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../api/axios";

const emptyProfileForm = {
  grade: 10,
  favoriteSubjects: "",
  strongSubjects: "",
  goal: "",
};

function profileToForm(profile = {}) {
  return {
    grade: profile.grade || 10,
    favoriteSubjects: (profile.favoriteSubjects || []).join(", "),
    strongSubjects: (profile.strongSubjects || []).join(", "),
    goal: profile.goal || "",
  };
}

function toArray(text) {
  return text
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "");
}

function ProfileSetup() {
  const navigate = useNavigate();
  const location = useLocation();
  const token = localStorage.getItem("token");
  const nextPath = location.state?.from || "/discovery";
  const [form, setForm] = useState(emptyProfileForm);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(Boolean(token));
  const [isSaving, setIsSaving] = useState(false);

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
      })
      .catch((err) => {
        if (!isMounted) return;

        if (err.response?.status !== 404 && err.response?.status !== 401) {
          setError(
            err.response?.data?.message ||
              "Không tải được hồ sơ. Vui lòng thử lại."
          );
        }
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

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const validateForm = () => {
    if (!form.grade) {
      return "Vui lòng chọn lớp hiện tại.";
    }

    if (toArray(form.favoriteSubjects).length === 0) {
      return "Vui lòng nhập ít nhất một môn học yêu thích.";
    }

    if (toArray(form.strongSubjects).length === 0) {
      return "Vui lòng nhập ít nhất một môn học học tốt.";
    }

    if (!form.goal.trim()) {
      return "Vui lòng nhập mục tiêu của bạn.";
    }

    return "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }

    setIsSaving(true);

    try {
      await api.put("/profile", {
        grade: Number(form.grade),
        favoriteSubjects: toArray(form.favoriteSubjects),
        strongSubjects: toArray(form.strongSubjects),
        goal: form.goal.trim(),
      });

      navigate(nextPath, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Lưu hồ sơ thất bại");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <section className="card profile-edit-card">
        <p className="muted">Đang tải bước tạo hồ sơ...</p>
      </section>
    );
  }

  return (
    <div className="profile-page">
      <section className="card profile-edit-card">
        <p className="muted">Bước 2/2</p>
        <h2>Tạo hồ sơ cơ bản</h2>
        <p className="muted">
          Hoàn tất các thông tin ngắn này để hệ thống có đủ dữ liệu ban đầu
          trước khi bắt đầu hành trình khám phá nghề nghiệp.
        </p>

        {error && <p className="error">{error}</p>}

        <form onSubmit={handleSubmit}>
          <label>Lớp hiện tại</label>
          <select name="grade" value={form.grade} onChange={handleChange} required>
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
            required
          />

          <label>Môn học học tốt</label>
          <input
            name="strongSubjects"
            value={form.strongSubjects}
            onChange={handleChange}
            placeholder="Ví dụ: Toán, Vật lý"
            required
          />

          <label>Mục tiêu</label>
          <textarea
            name="goal"
            value={form.goal}
            onChange={handleChange}
            placeholder="Ví dụ: học đại học, học nghề, du học, đi làm sớm"
            rows="4"
            required
          />

          <div className="profile-actions">
            <button type="submit" disabled={isSaving}>
              {isSaving ? "Đang lưu..." : "Hoàn tất hồ sơ"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

export default ProfileSetup;
