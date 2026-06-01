import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

const emptyForm = {
  name: "",
  field: "",
  description: "",
  requiredSubjects: "",
  requiredSkills: "",
  suitableInterests: "",
  roadmap: "",
};

const sampleBulkJson = `[
  {
    "name": "Công nghệ thông tin",
    "field": "Công nghệ",
    "description": "Nghiên cứu và phát triển phần mềm, hệ thống máy tính.",
    "requiredSubjects": ["Toán", "Tin học", "Tiếng Anh"],
    "requiredSkills": ["Tư duy logic", "Lập trình", "Giải quyết vấn đề"],
    "suitableInterests": ["Công nghệ", "Máy tính", "Lập trình"],
    "roadmap": ["Học lập trình cơ bản", "Học database", "Làm project thực tế"]
  }
]`;

function AdminCareers() {
  const navigate = useNavigate();

  const [careers, setCareers] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [bulkJson, setBulkJson] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const user = JSON.parse(localStorage.getItem("user"));
  const isAdmin = user?.role === "admin";

  const fetchCareers = useCallback(async () => {
    try {
      const res = await api.get("/careers");
      setCareers(res.data.careers || res.data);
    } catch {
      setError("Không tải được danh sách ngành nghề");
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      navigate("/careers");
      return;
    }

    let ignore = false;

    api
      .get("/careers")
      .then((response) => {
        if (!ignore) {
          setCareers(response.data.careers || response.data);
        }
      })
      .catch(() => {
        if (!ignore) {
          setError("Không tải được danh sách ngành nghề");
        }
      });

    return () => {
      ignore = true;
    };
  }, [isAdmin, navigate]);

  const toArray = (text) => {
    return text
      .split(",")
      .map((item) => item.trim())
      .filter((item) => item !== "");
  };

  const toPayload = () => ({
    name: form.name,
    field: form.field,
    description: form.description,
    requiredSubjects: toArray(form.requiredSubjects),
    requiredSkills: toArray(form.requiredSkills),
    suitableInterests: toArray(form.suitableInterests),
    roadmap: toArray(form.roadmap),
  });

  const normalizeCareer = (career) => ({
    name: career.name,
    field: career.field,
    description: career.description,
    requiredSubjects: Array.isArray(career.requiredSubjects)
      ? career.requiredSubjects
      : toArray(career.requiredSubjects || ""),
    requiredSkills: Array.isArray(career.requiredSkills)
      ? career.requiredSkills
      : toArray(career.requiredSkills || ""),
    suitableInterests: Array.isArray(career.suitableInterests)
      ? career.suitableInterests
      : toArray(career.suitableInterests || ""),
    roadmap: Array.isArray(career.roadmap)
      ? career.roadmap
      : toArray(career.roadmap || ""),
  });

  const validateBulkCareers = (items) => {
    if (!Array.isArray(items)) {
      return "JSON phải là một mảng các ngành nghề.";
    }

    if (items.length === 0) {
      return "Danh sách JSON đang rỗng.";
    }

    const invalidIndex = items.findIndex(
      (item) => !item.name || !item.field || !item.description
    );

    if (invalidIndex !== -1) {
      return `Ngành ở vị trí ${invalidIndex + 1} thiếu name, field hoặc description.`;
    }

    return "";
  };

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    try {
      if (editingId) {
        await api.put(`/careers/${editingId}`, toPayload());
        setMessage("Cập nhật ngành nghề thành công");
      } else {
        await api.post("/careers", toPayload());
        setMessage("Thêm ngành nghề thành công");
      }

      setForm(emptyForm);
      setEditingId(null);
      fetchCareers();
    } catch (err) {
      setError(err.response?.data?.message || "Lưu ngành nghề thất bại");
    }
  };

  const handleBulkSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setError("");

    try {
      const parsedCareers = JSON.parse(bulkJson);
      const validationError = validateBulkCareers(parsedCareers);

      if (validationError) {
        setError(validationError);
        return;
      }

      const payloads = parsedCareers.map(normalizeCareer);

      await Promise.all(payloads.map((career) => api.post("/careers", career)));

      setBulkJson("");
      setMessage(`Đã thêm ${payloads.length} ngành nghề từ JSON`);
      fetchCareers();
    } catch (err) {
      if (err instanceof SyntaxError) {
        setError("JSON không hợp lệ. Hãy kiểm tra dấu ngoặc, dấu phẩy và dấu nháy kép.");
        return;
      }

      setError(err.response?.data?.message || "Thêm danh sách ngành nghề thất bại");
    }
  };

  const handleEdit = (career) => {
    setEditingId(career._id);

    setForm({
      name: career.name,
      field: career.field,
      description: career.description,
      requiredSubjects: career.requiredSubjects.join(", "),
      requiredSkills: career.requiredSkills.join(", "),
      suitableInterests: career.suitableInterests.join(", "),
      roadmap: career.roadmap.join(", "),
    });

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm("Bạn có chắc muốn xoá ngành này?");

    if (!confirmDelete) return;

    try {
      await api.delete(`/careers/${id}`);
      setMessage("Xoá ngành nghề thành công");
      fetchCareers();
    } catch (err) {
      setError(err.response?.data?.message || "Xoá thất bại");
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
  };

  return (
    <div>
      <div className="page-header">
        <h1>Quản lý ngành nghề</h1>
        <p>Trang dành cho admin để thêm, sửa, xoá dữ liệu career.</p>
      </div>

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}

      <div className="card admin-form">
        <h2>{editingId ? "Cập nhật ngành nghề" : "Thêm ngành nghề mới"}</h2>

        <form onSubmit={handleSubmit}>
          <label>Tên ngành</label>
          <input
            name="name"
            value={form.name}
            onChange={handleChange}
            placeholder="Ví dụ: Công nghệ thông tin"
            required
          />

          <label>Lĩnh vực</label>
          <input
            name="field"
            value={form.field}
            onChange={handleChange}
            placeholder="Ví dụ: Công nghệ"
            required
          />

          <label>Mô tả</label>
          <textarea
            name="description"
            value={form.description}
            onChange={handleChange}
            placeholder="Mô tả ngắn về ngành nghề"
            rows="4"
            required
          />

          <label>Môn học liên quan</label>
          <input
            name="requiredSubjects"
            value={form.requiredSubjects}
            onChange={handleChange}
            placeholder="Toán, Tin học, Tiếng Anh"
          />

          <label>Kỹ năng cần có</label>
          <input
            name="requiredSkills"
            value={form.requiredSkills}
            onChange={handleChange}
            placeholder="Tư duy logic, Tự học, Giải quyết vấn đề"
          />

          <label>Sở thích phù hợp</label>
          <input
            name="suitableInterests"
            value={form.suitableInterests}
            onChange={handleChange}
            placeholder="Công nghệ, Máy tính, Lập trình"
          />

          <label>Roadmap</label>
          <textarea
            name="roadmap"
            value={form.roadmap}
            onChange={handleChange}
            placeholder="Học lập trình cơ bản, Học database, Làm project nhỏ"
            rows="4"
          />

          <div className="form-actions">
            <button>{editingId ? "Cập nhật" : "Thêm ngành"}</button>

            {editingId && (
              <button type="button" className="secondary" onClick={handleCancelEdit}>
                Huỷ sửa
              </button>
            )}
          </div>
        </form>
      </div>

      {!editingId && (
        <div className="card admin-form">
          <h2>Thêm nhiều ngành bằng JSON</h2>

          <form onSubmit={handleBulkSubmit}>
            <label>Danh sách JSON</label>
            <textarea
              className="json-textarea"
              value={bulkJson}
              onChange={(e) => setBulkJson(e.target.value)}
              placeholder={sampleBulkJson}
              rows="14"
              required
            />

            <div className="form-actions">
              <button>Thêm danh sách</button>
              <button
                type="button"
                className="secondary"
                onClick={() => setBulkJson(sampleBulkJson)}
              >
                Dán mẫu
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="admin-table-wrapper card">
        <h2>Danh sách ngành nghề</h2>

        <table className="admin-table">
          <thead>
            <tr>
              <th>Tên ngành</th>
              <th>Lĩnh vực</th>
              <th>Môn học</th>
              <th>Kỹ năng</th>
              <th>Hành động</th>
            </tr>
          </thead>

          <tbody>
            {careers.map((career) => (
              <tr key={career._id}>
                <td>{career.name}</td>
                <td>{career.field}</td>
                <td>{career.requiredSubjects?.join(", ")}</td>
                <td>{career.requiredSkills?.join(", ")}</td>
                <td>
                  <div className="table-actions">
                    <button onClick={() => handleEdit(career)}>Sửa</button>
                    <button
                      className="danger"
                      onClick={() => handleDelete(career._id)}
                    >
                      Xoá
                    </button>
                  </div>
                </td>
              </tr>
            ))}

            {careers.length === 0 && (
              <tr>
                <td colSpan="5">Chưa có dữ liệu ngành nghề</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AdminCareers;
