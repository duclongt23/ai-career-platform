import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { getStoredUser } from "../utils/storage";

const adminPageLimit = 50;
const emptyForm = {
  name: "",
  email: "",
  role: "student",
  is_active: true,
};
const defaultFilters = { search: "", role: "", status: "" };
const roleOptions = [
  { value: "", label: "Tất cả role" },
  { value: "student", label: "Student" },
  { value: "admin", label: "Admin" },
];
const statusOptions = [
  { value: "", label: "Tất cả trạng thái" },
  { value: "active", label: "Đang hoạt động" },
  { value: "inactive", label: "Đã khóa" },
];

function normalizeUserForForm(user) {
  return {
    name: user.name || "",
    email: user.email || "",
    role: user.role || "student",
    is_active: user.is_active !== false,
  };
}

function AdminUsers() {
  const navigate = useNavigate();
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: adminPageLimit,
    total: 0,
    totalPages: 1,
  });
  const [filters, setFilters] = useState(defaultFilters);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const currentUser = useMemo(
    () => getStoredUser(),
    []
  );
  const isAdmin = currentUser?.role === "admin";

  const fetchUsers = useCallback(async (page = 1, nextFilters = { search: "", role: "", status: "" }) => {
    try {
      setLoading(true);
      const res = await api.get("/admin/users", {
        params: {
          page,
          limit: adminPageLimit,
          search: nextFilters.search || undefined,
          role: nextFilters.role || undefined,
          status: nextFilters.status || undefined,
        },
      });

      setUsers(res.data.users || []);
      setPagination(
        res.data.pagination || {
          page,
          limit: adminPageLimit,
          total: 0,
          totalPages: 1,
        }
      );
    } catch (err) {
      setError(err.response?.data?.message || "Không tải được danh sách user.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isAdmin) {
      navigate("/");
      return;
    }

    const timeoutId = window.setTimeout(() => {
      fetchUsers(1);
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fetchUsers, isAdmin, navigate]);

  const updateFormField = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const resetForm = () => {
    setForm(emptyForm);
    setEditingId(null);
  };

  const handleEdit = (user) => {
    setEditingId(user._id);
    setForm(normalizeUserForForm(user));
    setMessage("");
    setError("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!editingId) return;

    setMessage("");
    setError("");
    setSaving(true);

    try {
      const payload = {
        name: form.name.trim(),
        role: form.role,
        is_active: Boolean(form.is_active),
      };

      if (!payload.name) {
        setError("Cần nhập tên user.");
        return;
      }

      const res = await api.put(`/admin/users/${editingId}`, payload);

      setUsers((current) =>
        current.map((user) => (user._id === editingId ? res.data.user : user))
      );
      setMessage("Cập nhật user thành công.");

      if (String(currentUser.id) === String(editingId) && res.data.user) {
        localStorage.setItem(
          "user",
          JSON.stringify({
            ...currentUser,
            name: res.data.user.name,
            role: res.data.user.role,
            is_active: res.data.user.is_active,
          })
        );
      }

      resetForm();
    } catch (err) {
      setError(
        err.response?.data?.error ||
          err.response?.data?.message ||
          "Cập nhật user thất bại."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleFilterSubmit = (event) => {
    event.preventDefault();
    fetchUsers(1, filters);
  };

  const handleResetFilters = () => {
    setFilters(defaultFilters);
    fetchUsers(1, defaultFilters);
  };

  return (
    <div className="admin-users-page">
      <div className="page-header">
        <h1>Quản lý User</h1>
        <p>Quản trị tối giản tài khoản: xem danh sách, đổi role và khóa/mở tài khoản.</p>
      </div>

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}

      <section className="card admin-form">
        <h2>{editingId ? "Cập nhật user" : "Chọn user để cập nhật"}</h2>
        <form onSubmit={handleSubmit}>
          <div className="admin-career-grid">
            <label>
              Tên
              <input
                value={form.name}
                disabled={!editingId}
                onChange={(event) => updateFormField("name", event.target.value)}
              />
            </label>

            <label>
              Email
              <input value={form.email} disabled />
            </label>

            <label>
              Role
              <select
                value={form.role}
                disabled={!editingId}
                onChange={(event) => updateFormField("role", event.target.value)}
              >
                <option value="student">student</option>
                <option value="admin">admin</option>
              </select>
            </label>

            <label className="admin-toggle admin-user-active-toggle">
              <input
                type="checkbox"
                checked={form.is_active}
                disabled={!editingId}
                onChange={(event) =>
                  updateFormField("is_active", event.target.checked)
                }
              />
              Đang hoạt động
            </label>
          </div>

          <div className="form-actions">
            <button disabled={!editingId || saving}>Cập nhật user</button>
            {editingId && (
              <button type="button" className="secondary" onClick={resetForm}>
                Hủy sửa
              </button>
            )}
          </div>
        </form>
      </section>

      <section className="card admin-form">
        <form
          className="admin-career-filter admin-user-filter"
          onSubmit={handleFilterSubmit}
        >
          <input
            value={filters.search}
            onChange={(event) =>
              setFilters((current) => ({ ...current, search: event.target.value }))
            }
            placeholder="Tìm theo tên hoặc email"
          />

          <select
            value={filters.role}
            onChange={(event) =>
              setFilters((current) => ({ ...current, role: event.target.value }))
            }
          >
            {roleOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
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

          <button>Lọc</button>
          <button
            type="button"
            className="admin-filter-reset"
            onClick={handleResetFilters}
          >
            Đặt lại
          </button>
        </form>
      </section>

      <section className="admin-table-wrapper card">
        <div className="admin-table-heading">
          <h2>Danh sách user</h2>
          <span>
            {pagination.total} user, trang {pagination.page}/
            {pagination.totalPages || 1}
          </span>
        </div>

        {loading ? (
          <p className="muted">Đang tải danh sách user...</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Role</th>
                <th>Trạng thái</th>
                <th>Ngày tạo</th>
                <th>Hành động</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user._id}>
                  <td>
                    <strong>{user.name}</strong>
                    <small>{user.email}</small>
                    {String(currentUser.id) === String(user._id) && (
                      <small>Tài khoản hiện tại</small>
                    )}
                  </td>
                  <td>{user.role}</td>
                  <td>
                    <div className="admin-status-list">
                      <span>{user.is_active ? "Đang hoạt động" : "Đã khóa"}</span>
                    </div>
                  </td>
                  <td>{user.createdAt ? new Date(user.createdAt).toLocaleDateString() : "-"}</td>
                  <td>
                    <div className="table-actions">
                      <button type="button" onClick={() => handleEdit(user)}>
                        Sửa
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {users.length === 0 && (
                <tr>
                  <td colSpan="5">Chưa có user phù hợp với bộ lọc.</td>
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
              onClick={() => fetchUsers(pagination.page - 1, filters)}
            >
              Trang trước
            </button>
            <span>{pagination.page}</span>
            <button
              type="button"
              disabled={pagination.page >= (pagination.totalPages || 1)}
              onClick={() => fetchUsers(pagination.page + 1, filters)}
            >
              Trang sau
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}

export default AdminUsers;
