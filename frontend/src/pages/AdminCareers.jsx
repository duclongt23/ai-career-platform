import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import {
  formatCareerClusters,
  normalizeCareerClusters,
} from "../utils/careerCluster";

const elementTypes = [
  "ability",
  "workstyle",
  "essential_skill",
  "transferable_skill",
  "knowledge",
];

const adminPageLimit = 50;

const statusOptions = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "active", label: "Đang hiển thị" },
  { value: "inactive", label: "Đã ẩn" },
  { value: "student_suitable", label: "Phù hợp học sinh" },
];

const emptyElement = {
  code: "",
  type: "ability",
  importance: 0.5,
  name_vi: "",
  name_en: "",
};

const emptyForm = {
  onetCode: "",
  title_en: "",
  title_vi: "",
  aliases: "",
  description_vi: "",
  careerCluster: "",
  riasecCode: "",
  vietnam_relevance: 0.5,
  is_active: true,
  student_suitable: true,
  elements: [],
};

function parseAliases(value) {
  return String(value || "")
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function formatAliases(aliases) {
  return Array.isArray(aliases) ? aliases.join(", ") : "";
}

function normalizeImportance(value) {
  const number = Number(value);

  if (Number.isNaN(number)) {
    return 0;
  }

  return Math.min(Math.max(number, 0), 1);
}

function normalizeCareerForForm(career) {
  return {
    onetCode: career.onetCode || "",
    title_en: career.title_en || "",
    title_vi: career.title_vi || "",
    aliases: formatAliases(career.aliases),
    description_vi: career.description_vi || "",
    careerCluster: formatCareerClusters(career.careerCluster),
    riasecCode: career.riasecCode || "",
    vietnam_relevance: career.vietnam_relevance ?? 0.5,
    is_active: career.is_active !== false,
    student_suitable: career.student_suitable !== false,
    elements: (career.elements || []).map((element) => ({
      code: element.code || "",
      type: element.type || "ability",
      importance: element.importance ?? 0.5,
      name_vi: element.name_vi || "",
      name_en: element.name_en || "",
    })),
  };
}

function buildPayload(form) {
  return {
    onetCode: form.onetCode.trim(),
    title_en: form.title_en.trim(),
    title_vi: form.title_vi.trim(),
    aliases: parseAliases(form.aliases),
    description_vi: form.description_vi.trim(),
    careerCluster: normalizeCareerClusters(form.careerCluster),
    riasecCode: form.riasecCode.trim().toUpperCase(),
    vietnam_relevance: normalizeImportance(form.vietnam_relevance),
    is_active: Boolean(form.is_active),
    student_suitable: Boolean(form.student_suitable),
    elements: form.elements
      .map((element) => ({
        code: String(element.code || "").trim().toLowerCase(),
        type: element.type,
        importance: normalizeImportance(element.importance),
      }))
      .filter((element) => element.code && elementTypes.includes(element.type)),
  };
}

function formatElementLabel(element) {
  const name = element.name_vi || element.name_en;

  return name ? `${element.code} - ${name}` : element.code || "Chua chon";
}

function AdminCareers() {
  const navigate = useNavigate();

  const [careers, setCareers] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: adminPageLimit,
    total: 0,
    totalPages: 1,
  });
  const [filters, setFilters] = useState({ search: "", status: "" });
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [elementSearches, setElementSearches] = useState({});

  const user = useMemo(
    () => JSON.parse(localStorage.getItem("user") || "{}"),
    []
  );
  const isAdmin = user?.role === "admin";

  const fetchCareers = useCallback(
    async (page = 1, nextFilters = { search: "", status: "" }) => {
      try {
        setLoading(true);
        const res = await api.get("/careers/admin", {
          params: {
            page,
            limit: adminPageLimit,
            search: nextFilters.search || undefined,
            status: nextFilters.status || undefined,
          },
        });

        setCareers(res.data.careers || []);
        setPagination(
          res.data.pagination || {
            page,
            limit: adminPageLimit,
            total: 0,
            totalPages: 1,
          }
        );
      } catch (err) {
        setError(
          err.response?.data?.message || "Khong tai duoc danh sach career."
        );
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

    fetchCareers(1);
  }, [fetchCareers, isAdmin, navigate]);

  useEffect(() => {
    const handleOutsidePickerClick = (event) => {
      const target = event.target;

      if (
        target &&
        typeof target.closest === "function" &&
        target.closest(".admin-element-picker")
      ) {
        return;
      }

      setElementSearches({});
    };

    document.addEventListener("mousedown", handleOutsidePickerClick);
    document.addEventListener("touchstart", handleOutsidePickerClick);

    return () => {
      document.removeEventListener("mousedown", handleOutsidePickerClick);
      document.removeEventListener("touchstart", handleOutsidePickerClick);
    };
  }, []);

  const updateFormField = (field, value) => {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const updateElement = (index, field, value) => {
    setForm((current) => ({
      ...current,
      elements: current.elements.map((element, elementIndex) =>
        elementIndex === index ? { ...element, [field]: value } : element
      ),
    }));
  };

  const addElementRow = () => {
    setForm((current) => ({
      ...current,
      elements: [...current.elements, { ...emptyElement }],
    }));
  };

  const removeElementRow = (index) => {
    setForm((current) => ({
      ...current,
      elements: current.elements.filter((_, elementIndex) => elementIndex !== index),
    }));
  };

  const searchElements = async (index, query, type) => {
    setElementSearches((current) => ({
      ...current,
      [index]: {
        query,
        loading: true,
        error: "",
        results: [],
      },
    }));

    try {
      const res = await api.get("/careers/admin/elements", {
        params: {
          q: query,
          type,
        },
      });

      setElementSearches((current) => ({
        ...current,
        [index]: {
          query,
          loading: false,
          error: "",
          results: res.data.elements || [],
        },
      }));
    } catch (err) {
      setElementSearches((current) => ({
        ...current,
        [index]: {
          query,
          loading: false,
          results: [],
          error: err.response?.data?.message || "Khong tim duoc element.",
        },
      }));
    }
  };

  const selectElement = (index, element) => {
    setForm((current) => ({
      ...current,
      elements: current.elements.map((currentElement, elementIndex) =>
        elementIndex === index
          ? {
              ...currentElement,
              code: element.code || "",
              type: element.type || currentElement.type,
              name_vi: element.name_vi || "",
              name_en: element.name_en || "",
            }
          : currentElement
      ),
    }));
    setElementSearches((current) => ({
      ...current,
      [index]: {
        query: "",
        loading: false,
        error: "",
        results: [],
      },
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setMessage("");
    setError("");
    setSaving(true);

    try {
      const payload = buildPayload(form);

      if (!payload.onetCode || !payload.title_en) {
        setError("Can nhap O*NET code va ten tieng Anh.");
        return;
      }

      if (payload.riasecCode && !/^[RIASEC]{1,6}$/.test(payload.riasecCode)) {
        setError("RIASEC chi duoc gom cac ky tu R, I, A, S, E, C.");
        return;
      }

      if (editingId) {
        await api.put(`/careers/${editingId}`, payload);
        setMessage("Cap nhat career thanh cong.");
      } else {
        await api.post("/careers", payload);
        setMessage("Them career thanh cong.");
      }

      setForm(emptyForm);
      setEditingId(null);
      await fetchCareers(pagination.page, filters);
    } catch (err) {
      setError(err.response?.data?.error || err.response?.data?.message || "Luu career that bai.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (career) => {
    setEditingId(career._id);
    setForm(normalizeCareerForForm(career));
    setMessage("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleDelete = async (id) => {
    const confirmDelete = window.confirm("Ban co chac muon xoa career nay?");

    if (!confirmDelete) return;

    setMessage("");
    setError("");

    try {
      await api.delete(`/careers/${id}`);
      setMessage("Xoa career thanh cong.");
      await fetchCareers(pagination.page, filters);
    } catch (err) {
      setError(err.response?.data?.message || "Xoa career that bai.");
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setForm(emptyForm);
    setElementSearches({});
  };

  const handleFilterSubmit = (event) => {
    event.preventDefault();
    fetchCareers(1, filters);
  };

  return (
    <div className="admin-careers-page">
      <div className="page-header">
        <h1>Quản lý career</h1>
        <p>Quản trị dữ liệu career theo schema hiện tại của hệ thống gợi ý.</p>
      </div>

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}

      <section className="card admin-form">
        <h2>{editingId ? "Cập nhật career" : "Thêm career mới"}</h2>

        <form onSubmit={handleSubmit}>
          <div className="admin-career-grid">
            <label>
              O*NET code
              <input
                name="onetCode"
                value={form.onetCode}
                onChange={(event) => updateFormField("onetCode", event.target.value)}
                placeholder="15-1252.00"
                required
              />
            </label>

            <label>
              Nhóm nghề
              <input
                name="careerCluster"
                value={form.careerCluster}
                onChange={(event) =>
                  updateFormField("careerCluster", event.target.value)
                }
                placeholder="Information Technology"
              />
            </label>

            <label>
              Tên tiếng Anh
              <input
                name="title_en"
                value={form.title_en}
                onChange={(event) => updateFormField("title_en", event.target.value)}
                placeholder="Software Developers"
                required
              />
            </label>

            <label>
              Tên tiếng Việt
              <input
                name="title_vi"
                value={form.title_vi}
                onChange={(event) => updateFormField("title_vi", event.target.value)}
                placeholder="Lập trình viên phần mềm"
              />
            </label>

            <label>
              RIASEC
              <input
                name="riasecCode"
                value={form.riasecCode}
                onChange={(event) =>
                  updateFormField("riasecCode", event.target.value.toUpperCase())
                }
                placeholder="ICR"
                maxLength="6"
              />
            </label>

            <label>
              Độ phù hợp Việt Nam
              <input
                name="vietnam_relevance"
                type="number"
                min="0"
                max="1"
                step="0.01"
                value={form.vietnam_relevance}
                onChange={(event) =>
                  updateFormField("vietnam_relevance", event.target.value)
                }
              />
            </label>
          </div>

          <label>
            Tên gọi khác
            <input
              name="aliases"
              value={form.aliases}
              onChange={(event) => updateFormField("aliases", event.target.value)}
              placeholder="Nhập cách nhau bằng dấu phẩy"
            />
          </label>

          <label>
            Mô tả tiếng Việt
            <textarea
              name="description_vi"
              value={form.description_vi}
              onChange={(event) =>
                updateFormField("description_vi", event.target.value)
              }
              placeholder="Mô tả ngắn về career"
              rows="4"
            />
          </label>

          <div className="admin-career-toggles">
            <label className="admin-toggle">
              <input
                type="checkbox"
                checked={form.is_active}
                onChange={(event) =>
                  updateFormField("is_active", event.target.checked)
                }
              />
              Đang hiển thị
            </label>

            <label className="admin-toggle">
              <input
                type="checkbox"
                checked={form.student_suitable}
                onChange={(event) =>
                  updateFormField("student_suitable", event.target.checked)
                }
              />
              Phù hợp học sinh
            </label>
          </div>

          <div className="admin-nested-section">
            <div className="admin-section-title">
              <h3>Element weights</h3>
              <button type="button" onClick={addElementRow}>
                Thêm element
              </button>
            </div>

            {form.elements.length === 0 && (
              <p className="muted">Career chưa có element nào.</p>
            )}

            {form.elements.map((element, index) => {
              const searchState = elementSearches[index] || {};

              return (
                <div className="admin-career-element-row" key={`${index}-${element.code}`}>
                  <div className="admin-element-picker">
                    <label>
                      Element
                      <input
                        value={searchState.query ?? formatElementLabel(element)}
                        onChange={(event) =>
                          searchElements(index, event.target.value, element.type)
                        }
                        onFocus={(event) =>
                          searchElements(index, event.target.value, element.type)
                        }
                        placeholder="Tim theo code hoac ten"
                      />
                    </label>

                    {searchState.loading && <small className="muted">Dang tim...</small>}
                    {searchState.error && <small className="error">{searchState.error}</small>}
                    {searchState.results?.length > 0 && (
                      <div className="admin-element-results">
                        {searchState.results.map((result) => (
                          <button
                            type="button"
                            className="admin-element-result"
                            key={result.code}
                            onClick={() => selectElement(index, result)}
                          >
                            <span>{result.code}</span>
                            <strong>{result.name_vi || result.name_en}</strong>
                            <small>{result.type}</small>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <label>
                    Type
                    <select
                      value={element.type}
                      onChange={(event) => updateElement(index, "type", event.target.value)}
                    >
                      {elementTypes.map((type) => (
                        <option key={type} value={type}>
                          {type}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label>
                    Importance
                    <input
                      type="number"
                      min="0"
                      max="1"
                      step="0.01"
                      value={element.importance}
                      onChange={(event) =>
                        updateElement(index, "importance", event.target.value)
                      }
                    />
                  </label>

                  <button
                    type="button"
                    className="danger"
                    onClick={() => removeElementRow(index)}
                  >
                    Xoa
                  </button>
                </div>
              );
            })}
          </div>

          <div className="form-actions">
            <button disabled={saving}>{editingId ? "Cập nhật" : "Thêm career"}</button>

            {editingId && (
              <button type="button" className="secondary" onClick={handleCancelEdit}>
                Hủy sửa
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
            placeholder="Tim theo tên, O*NET code, alias, nhóm nghề"
          />

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

          <button>Lọc</button>
        </form>
      </section>

      <section className="admin-table-wrapper card">
        <div className="admin-table-heading">
          <h2>Danh sach career</h2>
          <span>
            {pagination.total} career, trang {pagination.page}/{pagination.totalPages || 1}
          </span>
        </div>

        {loading ? (
          <p className="muted">Dang tai danh sach career...</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Career</th>
                <th>Nhom</th>
                <th>RIASEC</th>
                <th>Element</th>
                <th>Trang thai</th>
                <th>Hanh dong</th>
              </tr>
            </thead>

            <tbody>
              {careers.map((career) => (
                <tr key={career._id}>
                  <td>
                    <strong>{career.title_vi || career.title_en}</strong>
                    {career.title_vi && <small>{career.title_en}</small>}
                    <small>{career.onetCode}</small>
                  </td>
                  <td>{formatCareerClusters(career.careerCluster, "-")}</td>
                  <td>{career.riasecCode || "-"}</td>
                  <td>{career.elements?.length || 0}</td>
                  <td>
                    <div className="admin-status-list">
                      <span>{career.is_active ? "Đang hiển thị" : "Đã ẩn"}</span>
                      <span>
                        {career.student_suitable
                          ? "Phù hợp học sinh"
                          : "Không ưu tiên học sinh"}
                      </span>
                    </div>
                  </td>
                  <td>
                    <div className="table-actions">
                      <button onClick={() => handleEdit(career)}>Sửa</button>
                      <button
                        className="danger"
                        onClick={() => handleDelete(career._id)}
                      >
                        Xóa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {careers.length === 0 && (
                <tr>
                  <td colSpan="6">Chưa có career phù hợp với bộ lọc.</td>
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
              onClick={() => fetchCareers(pagination.page - 1, filters)}
            >
              Trang trước
            </button>
            <span>{pagination.page}</span>
            <button
              type="button"
              disabled={pagination.page >= (pagination.totalPages || 1)}
              onClick={() => fetchCareers(pagination.page + 1, filters)}
            >
              Trang sau
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default AdminCareers;
