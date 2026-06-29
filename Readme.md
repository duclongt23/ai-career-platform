# Hướng dẫn cài đặt 

Tài liệu này hướng dẫn cài đặt và chạy dự án trên môi trường local. Dự án gồm 2 phần:

- `backend`: API Express, MongoDB, JWT, email reset mật khẩu, tích hợp AI.
- `frontend`: ứng dụng React + Vite.

## 1. Yêu cầu hệ thống

Cần cài đặt trước:

- Node.js và npm
- MongoDB local hoặc MongoDB Atlas
- Git


Nếu dùng MongoDB local, đảm bảo MongoDB đang chạy ở cổng mặc định `27017`.

## 2. Lấy mã nguồn

```powershell
git clone <repository-url>
cd ai-career-platform
```

Nếu đã có source code sẵn, mở terminal tại thư mục gốc của dự án:

```powershell
cd D:\datn\ai-career-platform
```

## 3. Cài đặt Backend

Di chuyển vào thư mục backend và cài dependency:

```powershell
cd backend
npm install
```

Tạo file cấu hình môi trường từ file mẫu:


Ghi chú:

- `MONGO_URI`: đường dẫn kết nối MongoDB. Có thể thay bằng URI MongoDB Atlas.
- `JWT_SECRET`: chuỗi bí mật dùng để ký token. Nên đặt chuỗi dài, khó đoán.
- `FRONTEND_URL`: địa chỉ frontend local, mặc định là `http://localhost:5173`.
- `ADMIN_SETUP_SECRET`: mã bí mật để tạo tài khoản admin đầu tiên.
- `SMTP_*`: tùy chọn. Nếu không cấu hình SMTP, link reset mật khẩu sẽ được in ra console backend.
- `DEEPSEEK_API_KEY`: cần có nếu sử dụng tính năng AI chat/tư vấn.
- `TAVILY_API_KEY`: tùy chọn, dùng cho tìm kiếm web trong tính năng Career Explore Chat.

## 4. Seed dữ liệu ban đầu

Sau khi cấu hình MongoDB xong, chạy các lệnh seed trong thư mục `backend`:

```powershell
npm run seed:elements
npm run seed:profiling
npm run seed:careers
```

Nếu muốn kiểm tra trước khi ghi dữ liệu nghề nghiệp:

```powershell
npm run seed:careers:dry-run
```

Nếu cần cập nhật nhóm nghề:

```powershell
npm run update:career-clusters
```

## 5. Chạy Backend

Trong thư mục `backend`, chạy:

```powershell
npm run dev
```

Mặc định backend chạy tại:

```text
http://localhost:5000
```

API gốc:

```text
http://localhost:5000/api
```

Kiểm tra backend:

```powershell
Invoke-WebRequest http://localhost:5000/ -UseBasicParsing
```

Nếu thành công, API trả về thông báo `AI Career Guidance API is running`.

## 6. Cài đặt Frontend

Mở terminal mới, từ thư mục gốc dự án chạy:

```powershell
cd frontend
npm install
```

Tạo file `frontend/.env.local` nếu muốn cấu hình rõ API backend:

```env
VITE_API_BASE_URL=http://localhost:5000/api
```

Nếu không tạo file này, frontend vẫn dùng mặc định `http://localhost:5000/api`.

## 7. Chạy Frontend

Trong thư mục `frontend`, chạy:

```powershell
npm run dev
```

Mặc định frontend chạy tại:

```text
http://localhost:5173
```

Mở trình duyệt và truy cập địa chỉ trên để sử dụng ứng dụng.

## 8. Tạo tài khoản Admin đầu tiên

Backend có endpoint tạo admin:

```text
POST http://localhost:5000/api/auth/admin/create
```

Ví dụ tạo admin bằng PowerShell:

```powershell
$body = @{
  name = "Admin"
  email = "admin@example.com"
  password = "AdminPassword123"
  setupSecret = "replace-with-a-long-random-admin-setup-secret"
} | ConvertTo-Json

Invoke-RestMethod `
  -Method Post `
  -Uri "http://localhost:5000/api/auth/admin/create" `
  -ContentType "application/json" `
  -Body $body
```

Giá trị `setupSecret` phải trùng với `ADMIN_SETUP_SECRET` trong file `backend/.env`.

Sau khi tạo xong, đăng nhập bằng tài khoản admin trên frontend để truy cập các trang quản trị.

## 9. Lệnh kiểm thử và build

Backend:

```powershell
cd backend
npm test
```

Frontend:

```powershell
cd frontend
npm run lint
npm run test
npm run build
```

Chạy bản preview sau khi build frontend:

```powershell
npm run preview
```

## 10. Cấu trúc thư mục chính

```text
ai-career-platform/
  backend/
    src/
      controllers/
      middleware/
      models/
      routes/
      scripts/
      services/
    tests/
    .env.example
    package.json
  frontend/
    src/
      api/
      components/
      pages/
      utils/
    package.json
  data/
```



## 11. Quy trình chạy nhanh

Terminal 1:

```powershell
cd backend
npm install
copy .env.example .env
npm run seed:elements
npm run seed:profiling
npm run seed:careers
npm run dev
```

Terminal 2:

```powershell
cd frontend
npm install
npm run dev
```

Sau đó truy cập:

```text
http://localhost:5173
```
