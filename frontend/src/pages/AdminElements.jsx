import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";

const elementTypes = [
  "ability",
  "workstyle",
  "essential_skill",
  "transferable_skill",
  "knowledge",
];
const riasecTypes = ["R", "I", "A", "S", "E", "C"];
const adminPageLimit = 50;
const emptyForm = {
  code: "",
  name_vi: "",
  name_en: "",
  type: "ability",
  description_vi: "",
  student_friendly_description: "",
  is_active: true,
  student_suitable: true,
  riasec_tags: "",
  riasec_weights: "",
};

const statusOptions = [
  { value: "", label: "Tat ca trang thai" },
  { value: "active", label: "Dang kich hoat" },
  { value: "inactive", label: "Da an" },
  { value: "student_suitable", label: "Phu hop hoc sinh" },
];

function parseTags(value) {
  return [
    ...new Set(
      String(value || "")
        .split(/[\s,]+/)
        .map((tag) => tag.trim().toUpperCase())
        .filter((tag) => riasecTypes.includes(tag))
    ),
  ].slice(0, 3);
}

function parseWeights(value, tags) {
  const pairs = String(value || "")
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
  const weightMap = Object.fromEntries(
    pairs.map((pair) => {
      const [tag, score] = pair.split(":");
      return [String(tag || "").trim().toUpperCase(), Number(score)];
    })
  );

  return tags.reduce((weights, tag) => {
    const score = Number(weightMap[tag]);
    weights[tag] = Number.isFinite(score) ? Math.min(Math.max(score, 0.1), 1) : 0.5;
    return weights;
  }, {});
}

function formatWeights(weights) {
  return Object.entries(weights || {})
    .map(([tag, score]) => `${tag}:${score}`)
    .join(", ");
}

function normalizeElementForForm(element) {
  return {
    code: element.code || "",
    name_vi: element.name_vi || "",
    name_en: element.name_en || "",
    type: element.type || "ability",
    description_vi: element.description_vi || "",
    student_friendly_description: element.student_friendly_description || "",
    is_active: element.is_active !== false,
    student_suitable: element.student_suitable !== false,
    riasec_tags: (element.riasec_tags || []).join(", "),
    riasec_weights: formatWeights(element.riasec_weights),
  };
}

function buildPayload(form, editingId) {
  const tags = parseTags(form.riasec_tags);
  const payload = {
    name_vi: form.name_vi.trim(),
    name_en: form.name_en.trim(),
    type: form.type,
    description_vi: form.description_vi.trim(),
    student_friendly_description: form.student_friendly_description.trim(),
    is_active: Boolean(form.is_active),
    student_suitable: Boolean(form.student_suitable),
    riasec_tags: tags,
    riasec_weights: parseWeights(form.riasec_weights, tags),
  };

  if (!editingId) {
    payload.code = form.code.trim().toLowerCase();
  }

  return payload;
}

function AdminElements() {
  const navigate = useNavigate();
  const [elements, setElements] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: adminPageLimit,
    total: 0,
    totalPages: 1,
  });
  const [filters, setFilters] = useState({ search: "", type: "", status: "" });
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const user = useMemo(
    () => JSON.parse(localStorage.getItem("user") || "{}"),
    []
  );
  const isAdmin = user?.role === "admin";

  const fetchElements = useCallback(
    async (page = 1, nextFilters = { search: "", type: "", status: "" }) => {
      try {
        setLoading(true);
        const res = await api.get("/admin/elements", {
          params: {
            page,
            limit: adminPageLimit,
            search: nextFilters.search || undefined,
            type: nextFilters.type || undefined,
            status: nextFilters.status || undefined,
          },
        });

        setElements(res.data.elements || []);
        setPagination(
          res.data.pagination || {
            page,
            limit: adminPageLimit,
            total: 0,
            totalPages: 1,
          }
        );
      } catch (err) {
        setError(err.response?.data?.message || "Khong tai duoc danh sach element.");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!isAdmin) {
      navigate("/careers");
      return;
    }

    const timeoutId = window.setTimeout(() => {
      fetchElements(1);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchElements, isAdmin, navigate]);

  const updateFormField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");
    setSaving(true);

    try {
      const payload = buildPayload(form, editingId);

      if (!editingId && !payload.code) {
        setError("Can nhap element code.");
        return;
      }

      if (!payload.name_vi || !payload.name_en) {
        setError("Can nhap ten tieng Viet va tieng Anh.");
        return;
      }

      if (editingId) {
        await api.put(`/admin/elements/${editingId}`, payload);
        setMessage("Cap nhat element thanh cong.");
      } else {
        await api.post("/admin/elements", payload);
        setMessage("Them element thanh cong.");
      }

      resetForm();
      await fetchElements(pagination.page, filters);
    } catch (err) {
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Luu element that bai."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (element) => {
    setEditingId(element._id);
    setForm(normalizeElementForForm(element));
    setMessage("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (element) => {
    const confirmed = window.confirm(`Ban co chac muon xoa element ${element.code}?`);

    if (!confirmed) return;

    setMessage("");
    setError("");

    try {
      await api.delete(`/admin/elements/${element._id}`);
      setMessage("Xoa element thanh cong.");
      await fetchElements(pagination.page, filters);
    } catch (err) {
      const references = err.response?.data?.references;
      const referenceText = references
        ? ` Career: ${references.careerCount}, Core Quiz: ${references.questionCount}.`
        : "";
      setError(
        `${err.response?.data?.message || "Xoa element that bai."}${referenceText}`
      );
    }
  };

  const handleFilterSubmit = (event) => {
    event.preventDefault();
    fetchElements(1, filters);
  };

  return (
    <div className="admin-elements-page">
      <div className="page-header">
        <h1>Quan ly Element</h1>
        <p>Quan tri bo nang luc, ky nang, kien thuc va workstyle dung cho quiz va career.</p>
      </div>

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}

      <section className="card admin-form">
        <h2>{editingId ? "Cap nhat element" : "Them element moi"}</h2>
        <form onSubmit={handleSubmit}>
          <div className="admin-career-grid">
            <label>
              Code
              <input
                value={form.code}
                disabled={Boolean(editingId)}
                onChange={(event) => updateFormField("code", event.target.value)}
                placeholder="active_learning"
                required
              />
            </label>

            <label>
              Type
              <select
                value={form.type}
                onChange={(event) => updateFormField("type", event.target.value)}
              >
                {elementTypes.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Ten tieng Viet
              <input
                value={form.name_vi}
                onChange={(event) => updateFormField("name_vi", event.target.value)}
                required
              />
            </label>

            <label>
              Ten tieng Anh
              <input
                value={form.name_en}
                onChange={(event) => updateFormField("name_en", event.target.value)}
                required
              />
            </label>
          </div>

          <label>
            Mo ta tieng Viet
            <textarea
              rows="3"
              value={form.description_vi}
              onChange={(event) =>
                updateFormField("description_vi", event.target.value)
              }
            />
          </label>

          <label>
            Mo ta than thien voi hoc sinh
            <textarea
              rows="3"
              value={form.student_friendly_description}
              onChange={(event) =>
                updateFormField(
                  "student_friendly_description",
                  event.target.value
                )
              }
            />
          </label>

          <div className="admin-career-grid">
            <label>
              RIASEC tags
              <input
                value={form.riasec_tags}
                onChange={(event) =>
                  updateFormField("riasec_tags", event.target.value)
                }
                placeholder="R, I, A"
              />
            </label>

            <label>
              RIASEC weights
              <input
                value={form.riasec_weights}
                onChange={(event) =>
                  updateFormField("riasec_weights", event.target.value)
                }
                placeholder="R:0.7, I:0.5"
              />
            </label>
          </div>

          <div className="admin-career-toggles">
            <label className="admin-toggle">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(event) =>
                  updateFormField("is_active", event.target.checked)
                }
              />
              Dang kich hoat
            </label>

            <label className="admin-toggle">
              <input
                type="checkbox"
                checked={form.student_suitable}
                onChange={(event) =>
                  updateFormField("student_suitable", event.target.checked)
                }
              />
              Phu hop hoc sinh
            </label>
          </div>

          <div className="form-actions">
            <button disabled={saving}>
              {editingId ? "Cap nhat" : "Them element"}
            </button>
            {editingId && (
              <button type="button" className="secondary" onClick={resetForm}>
                Huy sua
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="card admin-form">
        <form className="admin-career-filter" onSubmit={handleFilterSubmit}>
          <input
            value={filters.search}
            onChange={(event) =>
              setFilters((current) => ({ ...current, search: event.target.value }))
            }
            placeholder="Tim theo code, ten tieng Viet, ten tieng Anh"
          />

          <select
            value={filters.type}
            onChange={(event) =>
              setFilters((current) => ({ ...current, type: event.target.value }))
            }
          >
            <option value="">Tat ca type</option>
            {elementTypes.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>

          <select
            value={filters.status}
            onChange={(event) =>
              setFilters((current) => ({ ...current, status: event.target.value }))
            }
          >
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>

          <button>Loc</button>
        </form>
      </section>

      <section className="admin-table-wrapper card">
        <div className="admin-table-heading">
          <h2>Danh sach element</h2>
          <span>
            {pagination.total} element, trang {pagination.page}/
            {pagination.totalPages || 1}
          </span>
        </div>

        {loading ? (
          <p className="muted">Dang tai danh sach element...</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Element</th>
                <th>Type</th>
                <th>RIASEC</th>
                <th>Trang thai</th>
                <th>Hanh dong</th>
              </tr>
            </thead>
            <tbody>
              {elements.map((element) => (
                <tr key={element._id}>
                  <td>
                    <strong>{element.name_vi}</strong>
                    <small>{element.name_en}</small>
                    <small>{element.code}</small>
                  </td>
                  <td>{element.type}</td>
                  <td>{(element.riasec_tags || []).join(", ") || "-"}</td>
                  <td>
                    <div className="admin-status-list">
                      <span>{element.is_active ? "Dang kich hoat" : "Da an"}</span>
                      <span>
                        {element.student_suitable
                          ? "Phu hop hoc sinh"
                          : "Khong uu tien hoc sinh"}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button type="button" onClick={() => handleEdit(element)}>
                        Sua
                      </button>
                      <button
                        type="button"
                        className="danger"
                        onClick={() => handleDelete(element)}
                      >
                        Xoa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {elements.length === 0 && (
                <tr>
                  <td colSpan="5">Chua co element phu hop voi bo loc.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}

        <div className="admin-pagination">
          <div className="admin-pagination-actions">
            <button
              type="button"
              disabled={pagination.page <= 1}
              onClick={() => fetchElements(pagination.page - 1, filters)}
            >
              Trang truoc
            </button>
            <span>{pagination.page}</span>
            <button
              type="button"
              disabled={pagination.page >= (pagination.totalPages || 1)}
              onClick={() => fetchElements(pagination.page + 1, filters)}
            >
              Trang sau
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default AdminElements;
