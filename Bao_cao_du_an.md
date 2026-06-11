# Báo cáo tổng quan dự án AI Career Platform

## 1. Thông tin chung

### 1.1. Tên dự án

**AI Career Platform / Career Dreamer** là hệ thống web hỗ trợ học sinh trung học phổ thông khám phá bản thân và nhận gợi ý nghề nghiệp phù hợp dựa trên:

- Hồ sơ học sinh: lớp, môn học yêu thích, môn học thế mạnh, mục tiêu học tập.
- Bài đánh giá sở thích nghề nghiệp RIASEC.
- Bài Core Quiz đo các yếu tố năng lực, phong cách làm việc, kỹ năng và kiến thức.
- Hội thoại AI Discovery để khai thác thêm trải nghiệm cá nhân.
- Dữ liệu nghề nghiệp O*NET đã Việt hóa và ánh xạ với các yếu tố nghề nghiệp.

### 1.2. Mục tiêu hệ thống

Hệ thống hướng tới việc tạo một quy trình định hướng nghề nghiệp có tính cá nhân hóa cho học sinh. Thay vì chỉ đưa ra danh sách nghề chung chung, hệ thống xây dựng hồ sơ năng lực/sở thích, tổng hợp điểm từ nhiều nguồn, sau đó so khớp với dữ liệu nghề để đề xuất các nghề phù hợp nhất.

Các mục tiêu chính:

- Giúp học sinh hiểu nhóm sở thích nghề nghiệp theo mô hình Holland/RIASEC.
- Ghi nhận các yếu tố cá nhân quan trọng thông qua Core Quiz và hội thoại AI.
- Tổng hợp các yếu tố đó thành điểm hồ sơ có thể giải thích được.
- Xếp hạng nghề nghiệp dựa trên mức độ phù hợp giữa hồ sơ học sinh và yêu cầu nghề.
- Cung cấp phần giải thích bằng AI cho từng nghề: vì sao phù hợp, một ngày làm việc điển hình, hỏi đáp sâu về nghề.
- Cung cấp màn hình quản trị dữ liệu nghề, element, câu hỏi quiz và người dùng.

### 1.3. Kiến trúc tổng thể

Dự án được tổ chức theo mô hình tách riêng frontend và backend:

```text
ai-career-platform/
├── backend/       # REST API, nghiệp vụ, MongoDB models, AI integration
├── frontend/      # React/Vite single-page application
├── data/          # Dữ liệu gốc O*NET, dữ liệu Việt hóa, notebook/script xử lý
├── QAprofiling.json
└── Bao_cao_du_an.md
```

Frontend gọi backend qua REST API. Backend kết nối MongoDB để lưu người dùng, hồ sơ, dữ liệu nghề, câu hỏi, element và lịch sử hội thoại. Các tác vụ AI sử dụng client OpenAI SDK trỏ tới DeepSeek API; một số câu hỏi về thị trường việc làm Việt Nam có thể gọi Tavily Search nếu cấu hình khóa API.

## 2. Công nghệ sử dụng

### 2.1. Backend

Backend nằm trong thư mục `backend/`.

Các công nghệ và thư viện chính:

| Thành phần | Công nghệ |
|---|---|
| Runtime | Node.js |
| Framework API | Express 5 |
| Database | MongoDB |
| ODM | Mongoose |
| Xác thực | JWT, bcryptjs |
| AI client | openai SDK, cấu hình baseURL DeepSeek |
| Import Excel | exceljs |
| Environment | dotenv |
| Kiểm thử | node:test, node:assert |
| Dev server | nodemon |

Scripts trong `backend/package.json`:

```bash
npm run dev
npm test
npm run migrate:optimized-schemas
npm run seed:careers
npm run seed:careers:dry-run
npm run update:career-clusters
npm run update:career-clusters:dry-run
npm run seed:elements
npm run seed:profiling
```

### 2.2. Frontend

Frontend nằm trong thư mục `frontend/`.

Các công nghệ và thư viện chính:

| Thành phần | Công nghệ |
|---|---|
| Framework UI | React 19 |
| Build tool | Vite |
| Routing | react-router-dom 7 |
| HTTP client | axios |
| Biểu đồ/flow | @xyflow/react |
| Styling | CSS tùy chỉnh, Tailwind/Vite plugin có trong dependency |
| Lint | ESLint |

Scripts trong `frontend/package.json`:

```bash
npm run dev
npm run build
npm run lint
npm run preview
```

## 3. Cấu trúc thư mục

### 3.1. Backend

```text
backend/src/
├── constants/      # Hằng số nghiệp vụ: element type, AI discovery, recommendation
├── controllers/    # Controller xử lý request/response
├── data/           # Dữ liệu seed nhỏ: elements.csv, onetInterest.json, classification
├── middleware/     # Auth, phân quyền, validate, rate limit
├── models/         # Mongoose schemas
├── prompts/        # Prompt template cho DeepSeek
├── routes/         # Định nghĩa REST routes
├── scripts/        # Seed/migrate/update dữ liệu
├── services/       # Business logic, scoring, recommendation, AI parsing
├── utils/          # Helper chung
├── db.js
└── server.js
```

### 3.2. Frontend

```text
frontend/src/
├── api/            # Axios instance và interceptor token refresh
├── assets/         # Logo, ảnh hero, career image
├── components/     # Layout, chart, component phụ trợ admin
├── constants/      # Hằng số frontend
├── pages/          # Các màn hình chính
├── utils/          # LocalStorage, career cluster, cleanup hook
├── App.jsx
├── main.jsx
└── style2.css
```

### 3.3. Dữ liệu

Thư mục `data/` chứa dữ liệu nghề nghiệp và dữ liệu element gốc hoặc đã Việt hóa:

- `Occupation Data.xlsx`, `Occupation_Data_ready.csv`: dữ liệu nghề nghiệp.
- `Abilities.xlsx`, `Knowledge.xlsx`, `Work Styles.xlsx`, `Essential Skills.xlsx`, `Transferable Skills.xlsx`: dữ liệu yêu cầu nghề theo O*NET.
- `onet_riasec_mapped.xlsx`: mã RIASEC theo nghề.
- `data/Viet/`: các bản dữ liệu Việt hóa.
- `data/Viet/elements/`: dữ liệu element đã rút gọn.

Các dữ liệu nhỏ dùng trực tiếp ở backend:

- `backend/src/data/elements.csv`: 141 element.
- `backend/src/data/elementRiasecClassifications.json`: 141 phân loại RIASEC cho element.
- `backend/src/data/onetInterest.json`: 30 câu RIASEC.
- `QAprofiling.json`: 81 câu Core Quiz nguồn.

## 4. Luồng nghiệp vụ chính

### 4.1. Luồng người dùng học sinh

1. Người dùng đăng ký hoặc đăng nhập.
2. Hệ thống yêu cầu hoàn thiện hồ sơ cơ bản: lớp, môn yêu thích, môn học tốt, mục tiêu.
3. Người dùng vào hành trình khám phá gồm 5 bước:
   - RIASEC.
   - Core Quiz.
   - AI Discovery.
   - Dashboard tổng kết.
   - Gợi ý nghề nghiệp.
4. Sau khi có đủ dữ liệu, hệ thống tạo danh sách nghề gợi ý.
5. Người dùng mở chi tiết từng nghề để xem:
   - Tổng quan nghề.
   - RIASEC của nghề.
   - Các element quan trọng.
   - So sánh hồ sơ cá nhân với nghề.
   - Giải thích vì sao nghề phù hợp.
   - Một ngày làm việc điển hình.
   - Chat hỏi sâu về nghề.

### 4.2. Luồng quản trị

Tài khoản admin có thể:

- Quản lý nghề nghiệp.
- Quản lý element.
- Quản lý câu hỏi Core Quiz.
- Quản lý người dùng.

Các API admin đều yêu cầu đăng nhập và quyền `admin`.

## 5. Backend chi tiết

### 5.1. Server và middleware

File khởi tạo backend là `backend/src/server.js`.

Backend cấu hình:

- `cors` cho:
  - `http://localhost:5173`
  - `https://ai-career-platform-pearl.vercel.app`
- `express.json()`.
- Global rate limit.
- Kết nối MongoDB qua `MONGO_URI`.
- Mount các route:

```text
/api/auth
/api/profile
/api/careers
/api/riasec
/api/admin/core-quiz
/api/admin/elements
/api/admin/users
```

### 5.2. Xác thực và phân quyền

Model `User` lưu:

- `name`
- `email`
- `password`
- `role`: `student` hoặc `admin`
- `is_active`
- `refreshTokenHash`
- `refreshTokenExpiresAt`

Xác thực sử dụng:

- Access token JWT, mặc định hết hạn sau `15m`.
- Refresh token random 64 bytes, hash SHA-256 trước khi lưu DB.
- Refresh token mặc định hết hạn sau 30 ngày.

Middleware:

- `protect`: kiểm tra `Authorization: Bearer <token>`, verify JWT, load user, kiểm tra tài khoản active.
- `adminOnly`: chỉ cho phép user có `role === "admin"`.

Rate limit:

- Global: 300 request / 15 phút / IP.
- Auth: 20 request / 15 phút / IP + email.
- Career Explore Chat: 20 request / 10 phút / user.

### 5.3. Validation

Backend tự xây dựng validation middleware đơn giản trong `validate.middleware.js`, thay vì dùng thư viện schema ngoài.

Các schema auth:

- `registerSchema`: name, email, password tối thiểu 6 ký tự.
- `loginSchema`: email, password.
- `refreshSchema`: refreshToken.
- `createAdminSchema`: name, email, password tối thiểu 10 ký tự, setupSecret.

### 5.4. Models chính

#### User

Lưu thông tin tài khoản và trạng thái phiên đăng nhập.

Điểm đáng chú ý:

- Email unique, lowercase.
- Password được hash bằng bcrypt.
- Refresh token chỉ lưu dạng hash và `select: false`.

#### StudentProfile

Đây là model trung tâm của hệ thống. Mỗi user có một profile duy nhất.

Các nhóm dữ liệu chính:

- Hồ sơ cơ bản:
  - `grade`
  - `favoriteSubjects`
  - `strongSubjects`
  - `goal`
- RIASEC:
  - `riasecCode`
  - `riasecScores`
  - `riasecCompletedAt`
- Core Quiz:
  - `coreQuizAnswers`
  - `coreQuizCompletedAt`
- Điểm tổng hợp:
  - `elementScores`
  - `elementScoreVersion`
- AI Discovery:
  - `aiDiscoveries`
- Gợi ý nghề:
  - `careerRecommendationSnapshot`
- AI insight/cache:
  - `careerFitExplanations`
  - `careerDayInLifeEntries`
  - `careerExploreChatSessions`

Điểm thiết kế tốt: `elementScores` và recommendation là dữ liệu dẫn xuất/cache. Dữ liệu nguồn vẫn là Core Quiz answers và AI Discovery confirmations. Khi version thuật toán đổi, hệ thống có thể rebuild điểm từ dữ liệu nguồn.

#### Career

Lưu nghề nghiệp.

Các field chính:

- `onetCode`: mã O*NET, unique.
- `title_en`, `title_vi`.
- `aliases`.
- `description_vi`.
- `careerCluster`: mảng nhóm nghề tiếng Việt.
- `riasecCode`.
- `vietnam_relevance`.
- `is_active`.
- `student_suitable`.
- `elements`: danh sách element nghề yêu cầu, gồm:
  - `code`
  - `type`
  - `importance` từ 0 đến 1.

#### Element

Lưu các yếu tố năng lực/kỹ năng/kiến thức/phong cách.

Các loại element:

- `ability`
- `workstyle`
- `essential_skill`
- `transferable_skill`
- `knowledge`

Các field chính:

- `code`
- `name_vi`
- `name_en`
- `type`
- `description_vi`
- `student_friendly_description`
- `is_active`
- `student_suitable`
- `riasec_tags`: tối đa 3 mã RIASEC.
- `riasec_weights`: trọng số tương ứng với tag.

#### ProfilingQuestion

Lưu câu hỏi Core Quiz.

Các field chính:

- `question_id`
- `target_type`
- `target_elements`: 1 đến 4 element mục tiêu.
- `question_style`: behavioral, preference, scenario, reflection, activity_based.
- `difficulty_level`: easy, medium, hard.
- `selection_mode`: single hoặc multiple.
- `question_purpose`
- `question`
- `answers`: 4 đến 6 đáp án.

Mỗi đáp án có `mapping` từ element code sang:

- `score`: 0.1 đến 1.
- `evidence_strength`: weak, medium, strong.

#### AiDiscoverySession

Lưu phiên hội thoại AI Discovery.

Các trạng thái:

- `in_progress`
- `ready_to_confirm`
- `confirmed`
- `cancelled`

Các field chính:

- `userId`
- `topic`
- `openingQuestionId`
- `openingTopic`
- `messages`
- `followUpCount`
- `extractedCandidates`
- `confirmedElements`

Backend giới hạn số message lưu trong session là 50.

## 6. API chính

### 6.1. Auth API

Base path: `/api/auth`

| Method | Endpoint | Chức năng |
|---|---|---|
| POST | `/register` | Đăng ký học sinh |
| POST | `/login` | Đăng nhập |
| POST | `/refresh` | Làm mới access token bằng refresh token |
| POST | `/logout` | Xóa refresh token |
| POST | `/admin/create` | Tạo admin bằng setup secret |
| GET | `/me` | Lấy user hiện tại |

### 6.2. Profile, Core Quiz, AI Discovery

Base path: `/api/profile`

| Method | Endpoint | Chức năng |
|---|---|---|
| GET | `/` | Lấy profile |
| POST | `/` | Tạo profile |
| PUT | `/` | Cập nhật profile cơ bản |
| PUT | `/riasec` | Lưu kết quả RIASEC |
| GET | `/core-quiz/questions` | Lấy câu hỏi Core Quiz |
| GET | `/core-quiz/result` | Lấy kết quả Core Quiz đã lưu |
| POST | `/core-quiz/submit` | Nộp Core Quiz và tính element scores |
| DELETE | `/core-quiz/result` | Reset Core Quiz |
| POST | `/ai-discovery/start` | Bắt đầu hoặc load session AI Discovery |
| POST | `/ai-discovery/message` | Gửi tin nhắn AI Discovery |
| POST | `/ai-discovery/reset` | Đóng session đang mở và tạo session mới |
| POST | `/ai-discovery/more-candidates` | Yêu cầu AI đề xuất thêm element |
| POST | `/ai-discovery/confirm` | Xác nhận candidate element |

### 6.3. RIASEC

Base path: `/api/riasec`

| Method | Endpoint | Chức năng |
|---|---|---|
| GET | `/questions` | Lấy bộ 30 câu hỏi RIASEC |

### 6.4. Career API

Base path: `/api/careers`

| Method | Endpoint | Chức năng |
|---|---|---|
| GET | `/` | Danh sách nghề public |
| GET | `/:id` | Chi tiết nghề |
| GET | `/recommendations/me` | Gợi ý nghề cho user hiện tại |
| POST | `/:id/fit-explanation` | Tạo/lấy giải thích điểm mạnh phù hợp |
| POST | `/:id/day-in-life` | Tạo/lấy một ngày làm việc điển hình |
| POST | `/:id/explore-chat` | Chat hỏi sâu về nghề |
| GET | `/explore-chats/me` | Danh sách hội thoại nghề đã lưu |
| PATCH | `/:id/explore-chat/session` | Đổi tên hội thoại |
| DELETE | `/:id/explore-chat/session` | Xóa hội thoại |
| POST | `/:id/explore-chat/feedback` | Gửi feedback cho câu trả lời AI |
| GET | `/admin` | Danh sách nghề cho admin |
| GET | `/admin/elements` | Tìm element khi admin tạo/sửa nghề |
| POST | `/` | Tạo nghề |
| PUT | `/:id` | Cập nhật nghề |
| DELETE | `/:id` | Xóa nghề |

### 6.5. Admin API

Core Quiz:

```text
/api/admin/core-quiz/elements
/api/admin/core-quiz/questions
/api/admin/core-quiz/questions/:id
```

Elements:

```text
/api/admin/elements
/api/admin/elements/:id
```

Users:

```text
/api/admin/users
/api/admin/users/:id
```

## 7. Thuật toán và xử lý nghiệp vụ

### 7.1. Tính điểm RIASEC

Frontend tải 30 câu hỏi từ `/api/riasec/questions`. Mỗi câu thuộc một trong 6 nhóm:

- Realistic
- Investigative
- Artistic
- Social
- Enterprising
- Conventional

Người dùng chọn mức độ từ 0 đến 4:

- Hoàn toàn không thích: 0
- Không thích: 1
- Trung lập: 2
- Thích: 3
- Rất thích: 4

Frontend cộng điểm theo từng nhóm, tính phần trăm dựa trên điểm tối đa của nhóm, sắp xếp giảm dần và lấy 3 chữ cái nổi bật nhất làm `riasecCode`. Kết quả được lưu vào profile qua `PUT /profile/riasec`.

### 7.2. Chọn câu hỏi Core Quiz

Core Quiz lấy dữ liệu từ MongoDB collection `ProfilingQuestion`. Trong code vẫn có fallback đọc `QAprofiling.json`, nhưng biến `use_data_from_mongo` đang đặt là `true`.

Số câu hỏi được chọn theo từng loại:

| Loại element | Số câu |
|---|---:|
| ability | 9 |
| workstyle | 9 |
| transferable_skill | 4 |
| knowledge | 5 |
| essential_skill | 3 |

Tổng số câu Core Quiz mỗi lượt là 30.

Service sẽ:

1. Load toàn bộ câu hỏi active.
2. Shuffle câu hỏi theo từng loại.
3. Lấy đúng quota mỗi loại.
4. Nếu thiếu câu, bổ sung từ các câu còn lại.
5. Shuffle lại danh sách cuối.
6. Ẩn mapping điểm với học sinh; admin có thể thấy chi tiết điểm đáp án.

### 7.3. Tính điểm element từ Core Quiz

Khi học sinh nộp Core Quiz, backend:

1. Validate `questionId` và index đáp án.
2. Duyệt các đáp án đã chọn.
3. Cộng điểm mapping theo từng element.
4. Tính:
   - `averageScore = rawSum / evidenceCount`
   - `confidence = min(evidenceCount / 10 + 0.5, 1)`
   - `finalScore = averageScore * confidence`
5. Sắp xếp giảm dần theo `finalScore`.

Core Quiz chỉ là một nguồn bằng chứng. Sau đó hệ thống tiếp tục tổng hợp với AI Discovery bằng thuật toán profile-wide scoring.

### 7.4. AI Discovery

AI Discovery là luồng hội thoại có kiểm soát, gồm:

1. Người dùng đã có RIASEC.
2. Backend chọn câu hỏi mở đầu phù hợp với RIASEC hoặc câu trung tính.
3. Học sinh trả lời theo trải nghiệm thật.
4. Backend chọn danh sách element liên quan để gửi vào prompt.
5. DeepSeek trả về JSON:

```json
{
  "action": "ask_followup",
  "assistant_message": "string",
  "candidates": []
}
```

hoặc:

```json
{
  "action": "ready_to_confirm",
  "assistant_message": "string",
  "candidates": [
    {
      "code": "string",
      "type": "ability",
      "name_vi": "string",
      "reason": "string",
      "confidence": 0.8
    }
  ]
}
```

Backend không tin trực tiếp toàn bộ output AI. Candidate chỉ được nhận nếu:

- Code tồn tại trong danh sách element backend đã chọn.
- Không trùng lặp.
- Có reason hợp lệ.
- Confidence là số hợp lệ từ 0.1 đến 1.
- Số lượng candidate từ 3 đến 6.

Người dùng phải xác nhận candidate và chọn mức độ:

- 1: có một chút.
- 2: khá đúng.
- 3: rất đúng.

Sau khi xác nhận, hệ thống lưu snapshot vào `StudentProfile.aiDiscoveries` và rebuild `elementScores`.

### 7.5. Chọn element cho AI Discovery

Service `elementSelectionService` chọn element active và phù hợp học sinh theo:

- Top RIASEC của học sinh.
- Trọng số RIASEC của element.
- Chủ đề câu hỏi mở đầu.
- Quota theo loại element.
- Random có seed ổn định theo session để tránh danh sách thay đổi giữa các request.

Quota mặc định:

| Loại element | Số lượng |
|---|---:|
| ability | 22 |
| workstyle | 18 |
| transferable_skill | 8 |
| essential_skill | 6 |
| knowledge | 6 |

Tổng giới hạn mặc định là 60 element.

### 7.6. Tổng hợp điểm hồ sơ

File chính: `profileElementScore.service.js`.

Phiên bản thuật toán hiện tại:

```text
ELEMENT_SCORE_ALGORITHM_VERSION = 2
```

Nguồn điểm:

- Core Quiz.
- AI Discovery.

Trọng số nền:

```text
AI_DISCOVERY_BASE_WEIGHT = 0.75
CORE_QUIZ_BASE_WEIGHT = 0.25
```

Nguyên tắc:

- AI Discovery là bằng chứng có trọng số cao vì học sinh đã xác nhận trực tiếp.
- Core Quiz là bằng chứng nền, không được lấn át AI Discovery chỉ vì có nhiều câu hỏi.
- Nếu chỉ có AI Discovery, finalScore bằng `level / 3`.
- Nếu chỉ có Core Quiz, điểm bị discount theo độ tin cậy.
- Nếu có cả hai, finalScore là trung bình có trọng số theo reliability.

Công thức chính:

- `quizReliability = min(quizEvidenceCount / 5, 1)`
- `aiDiscoveryReliability = 0.8 + 0.2 * aiDiscoveryConfidence`
- Nếu có cả hai nguồn:

```text
quizWeight = 0.25 * quizReliability
aiDiscoveryWeight = 0.75 * aiDiscoveryReliability
finalScore = (quizScore * quizWeight + aiDiscoveryScore * aiDiscoveryWeight)
             / (quizWeight + aiDiscoveryWeight)
```

### 7.7. Gợi ý nghề nghiệp

File chính: `careerRecommendation.service.js`.

Phiên bản thuật toán hiện tại:

```text
RECOMMENDATION_ALGORITHM_VERSION = 3
```

Giới hạn số nghề trả về:

```text
DEFAULT_RECOMMENDATION_LIMIT = 25
MAX_RECOMMENDATION_LIMIT = 25
```

Nguồn dữ liệu đầu vào:

- `elementScores` của học sinh.
- `riasecCode` của học sinh.
- Danh sách nghề active, suitable và có element.

Hệ thống lọc nghề bằng:

```js
{
  is_active: true,
  student_suitable: true,
  "elements.0": { $exists: true }
}
```

#### 7.7.1. Chọn core elements của nghề

Mỗi nghề có thể có nhiều element. Hệ thống lấy top-K theo loại:

| Loại element | Giới hạn |
|---|---:|
| ability | 20 |
| workstyle | 15 |
| transferable_skill | 10 |
| essential_skill | 5 |
| knowledge | 10 |

#### 7.7.2. Các thành phần điểm

Điểm nghề gồm 3 thành phần:

```text
rawScoreV3 =
  elementFit * 0.45
  + riasecFit * 0.25
  + studentToCareerFit * 0.30
```

Trong đó:

- `elementFit`: mức độ khớp giữa vector element học sinh và vector element nghề.
- `riasecFit`: độ khớp giữa mã RIASEC học sinh và mã RIASEC nghề.
- `studentToCareerFit`: mức độ các điểm mạnh của học sinh được nghề sử dụng.

`elementFit` được tính theo từng loại element, rồi cộng trọng số:

| Loại element | Trọng số |
|---|---:|
| ability | 0.30 |
| workstyle | 0.30 |
| transferable_skill | 0.15 |
| essential_skill | 0.15 |
| knowledge | 0.10 |

Trong từng loại, service kết hợp:

```text
typeFit = cosine * 0.65 + weightedJaccard * 0.35
```

#### 7.7.3. Calibration điểm hiển thị

Sau khi sort theo `rawScoreV3`, hệ thống chuyển điểm thô sang điểm hiển thị dễ đọc:

```text
displayMatchScore = 55 + 40 * percentile ^ 0.75
```

Vì vậy điểm match hiển thị nằm trong khoảng khoảng 55-95 cho danh sách đề xuất. Đây là điểm dùng cho UI để học sinh dễ so sánh, không phải xác suất tuyệt đối.

#### 7.7.4. Cache recommendation

Kết quả gợi ý được cache trong `careerRecommendationSnapshot`. Cache chỉ được tái sử dụng khi tất cả điều kiện còn khớp:

- Cùng version thuật toán.
- Cùng limit.
- Fingerprint điểm element không đổi.
- Fingerprint profile recommendation không đổi.
- Fingerprint dữ liệu nghề không đổi.

Nếu dữ liệu đổi, backend tự tính lại và cập nhật snapshot.

### 7.8. Career Insight bằng AI

Trang chi tiết nghề có 3 chức năng AI:

#### Giải thích điểm mạnh phù hợp

Endpoint:

```text
POST /api/careers/:id/fit-explanation
```

Backend:

1. Lấy profile và career.
2. Tính similarity.
3. Lấy top matched elements.
4. Gọi DeepSeek tạo giải thích cho từng strength.
5. Parse JSON bắt buộc.
6. Cache theo:
   - `careerId`
   - `strengthCode`
   - `elementScoresFingerprint`
   - `careerUpdatedAt`

Giới hạn cache: 100 explanation/profile.

#### Một ngày làm việc điển hình

Endpoint:

```text
POST /api/careers/:id/day-in-life
```

Backend yêu cầu AI trả về JSON với `activities` từ 5 đến 7 mục, mỗi mục tối đa 300 ký tự. Kết quả được cache theo career version.

Giới hạn cache: 30 entry/profile.

#### Career Explore Chat

Endpoint:

```text
POST /api/careers/:id/explore-chat
```

Chức năng:

- Trả lời câu hỏi cụ thể về nghề.
- Sử dụng hồ sơ học sinh và top element làm context.
- Gợi ý 3-4 câu hỏi tiếp theo.
- Lưu lịch sử hội thoại theo nghề.
- Cho phép regenerate, reset, xóa hội thoại, đổi tên hội thoại.
- Cho phép feedback `helpful` hoặc `not_helpful`.

Nếu câu hỏi chứa từ khóa về lương, tuyển dụng, thị trường, nhu cầu, job, salary..., backend có thể gọi Tavily Search để lấy context web Việt Nam. Nếu chưa cấu hình `TAVILY_API_KEY`, backend trả trạng thái `not_configured` và AI không có dữ liệu web cập nhật.

## 8. Frontend chi tiết

### 8.1. Cấu hình routing

File chính: `frontend/src/App.jsx`.

Các route chính:

| Route | Màn hình |
|---|---|
| `/` | Landing page + modal đăng nhập/đăng ký |
| `/profile/setup` | Tạo hồ sơ cơ bản |
| `/profile` | Xem/sửa hồ sơ |
| `/discovery/riasec` | Bài test RIASEC |
| `/discovery/core-quiz` | Core Quiz |
| `/discovery/ai-discovery` | AI Discovery |
| `/discovery/dashboard` | Dashboard tổng kết |
| `/discovery/recommendations` | Gợi ý nghề |
| `/careers/:id` | Chi tiết nghề |
| `/careers/:id/explore-chat` | Chat hỏi sâu về nghề |
| `/career-explore-chats` | Hub hội thoại nghề |
| `/career-explore-chats/:id` | Hội thoại nghề theo career |
| `/admin/careers` | Quản trị nghề |
| `/admin/core-quiz` | Quản trị Core Quiz |
| `/admin/elements` | Quản trị element |
| `/admin/users` | Quản trị user |

Các route legacy như `/login`, `/register`, `/riasec-test`, `/core-quiz`, `/ai-discovery`, `/career-recommendations` được redirect về route mới.

### 8.2. Auth trên frontend

File `frontend/src/api/axios.js` cấu hình:

- Base URL lấy từ `VITE_API_BASE_URL`, mặc định `http://localhost:5000/api`.
- Request interceptor tự gắn `Authorization: Bearer <token>`.
- Response interceptor tự gọi `/auth/refresh` khi gặp 401.
- Nếu refresh thất bại, xóa token và dispatch event `auth-session-expired`.

Token và user được lưu trong `localStorage`:

- `token`
- `refreshToken`
- `user`

### 8.3. Guard hồ sơ cơ bản

Component `BasicProfileGate` trong `App.jsx` kiểm tra:

- Có token hay không.
- User admin được đi qua.
- Student phải có đủ:
  - grade
  - favoriteSubjects
  - strongSubjects
  - goal

Nếu thiếu, chuyển về `/profile/setup`.

### 8.4. Discovery workflow

Component `DiscoveryWorkflowLayout` hiển thị 5 bước:

1. RIASEC.
2. Core Quiz.
3. AI Discovery.
4. Tổng kết.
5. Gợi ý nghề.

Progress được tính từ profile:

- `riasec`: có `riasecCompletedAt` hoặc `riasecCode`.
- `coreQuiz`: có `coreQuizCompletedAt`.
- `aiDiscovery`: có `aiDiscoveries`.
- `dashboard`: có element score và RIASEC.
- `recommendations`: đã vào trang recommendation, lưu bằng localStorage key theo user.

Các page sau khi hoàn tất bước có dispatch event `discovery-progress-updated` để stepper cập nhật.

### 8.5. Các màn hình học sinh

#### LandingPage

Landing page có modal đăng nhập/đăng ký. Sau đăng ký chuyển tới `/profile/setup`; sau đăng nhập chuyển tới đường dẫn yêu cầu ban đầu hoặc `/discovery`.

#### ProfileSetup và Profile

Cho phép nhập/sửa:

- Lớp 10/11/12.
- Môn học yêu thích.
- Môn học thế mạnh.
- Mục tiêu.

Dữ liệu môn học nhập dạng chuỗi phân tách bằng dấu phẩy, frontend chuyển thành mảng trước khi gửi API.

#### RiasecTest

Chức năng:

- Load 30 câu hỏi RIASEC.
- Cho người dùng chọn mức độ yêu thích.
- Tính điểm từng nhóm.
- Hiển thị biểu đồ radar.
- Lưu mã RIASEC top 3 vào profile.

#### CoreQuizPage

Chức năng:

- Load kết quả đã lưu nếu có.
- Nếu chưa có, load 30 câu hỏi Core Quiz.
- Hỗ trợ câu single và multiple choice.
- Validate người dùng trả lời đủ.
- Nộp quiz để backend tính element score.
- Hiển thị top element, nhóm theo loại.
- Nếu user là admin, hiển thị bảng breakdown điểm chi tiết.

#### AiDiscoveryPage

Chức năng:

- Bắt đầu hoặc resume session.
- Chọn câu hỏi mở đầu.
- Chat với AI.
- Xem candidate element.
- Chọn candidate và mức độ phù hợp.
- Tìm thêm candidate.
- Xác nhận lưu vào profile.
- Reset session để chọn câu hỏi mở đầu khác.

#### DiscoverySummaryDashboard

Dashboard tổng hợp:

- Nhóm ngành nổi bật từ recommendation.
- Radar chart RIASEC.
- Top 10 element cốt lõi.
- Điều hướng sang AI Discovery hoặc Recommendations.

#### CareerRecommendations

Hiển thị nghề gợi ý theo hai chế độ:

- Sơ đồ node trên desktop.
- Bảng xếp hạng, mặc định trên mobile.

Mỗi nghề hiển thị:

- Rank.
- Tên nghề.
- Nhóm nghề.
- Điểm match.
- Top matched elements.
- Link chi tiết hoặc hỏi AI.

#### CareerDetail

Trang chi tiết nghề hiển thị:

- Tổng quan nghề.
- Nhóm nghề.
- RIASEC code của nghề.
- Giải thích điểm mạnh phù hợp.
- Biểu đồ so sánh hồ sơ với yêu cầu nghề.
- Một ngày làm việc điển hình bằng React Flow.
- Element quan trọng theo nhóm.
- CTA sang Career Explore Chat.

#### CareerExploreChats

Hub quản lý hội thoại nghề:

- Danh sách session theo nghề.
- Hiển thị career đang chọn.
- Đổi tên hội thoại.
- Mở lại chat đã lưu.
- Điều hướng về chi tiết nghề.

### 8.6. Các màn hình admin

#### AdminCareers

Cho phép:

- Tìm kiếm/lọc nghề.
- Phân trang.
- Tạo nghề.
- Sửa nghề.
- Xóa nghề.
- Gắn element vào nghề với importance.
- Quản lý nhóm nghề, RIASEC, trạng thái active/suitable.

#### AdminElements

Cho phép:

- Tìm kiếm/lọc element theo type/status.
- Tạo/sửa/xóa element.
- Quản lý RIASEC tags và weights.
- Không cho xóa element nếu đang được career hoặc Core Quiz tham chiếu.

#### AdminCoreQuiz

Cho phép:

- Xem danh sách câu hỏi.
- Tạo/sửa/xóa câu hỏi.
- Tìm element theo target type.
- Cấu hình target elements.
- Cấu hình đáp án và mapping điểm.
- Khi xóa câu hỏi, backend rebuild lại điểm profile bị ảnh hưởng.

#### AdminUsers

Cho phép:

- Tìm kiếm/lọc user.
- Sửa tên, role, trạng thái active.
- Không cho admin tự hạ role hoặc tự khóa tài khoản qua cơ chế update user hiện tại.
- Khi khóa user, refresh token bị revoke.

## 9. Dữ liệu và seed/migration

### 9.1. Seed element

Script:

```bash
npm run seed:elements
```

Nguồn:

- `backend/src/data/elements.csv`
- `backend/src/data/elementRiasecClassifications.json`

Script:

- Parse CSV thủ công.
- Sinh `code` từ tên tiếng Anh.
- Gắn RIASEC tags/weights.
- Upsert vào collection `elements`.
- Validate classification đủ và hợp lệ.

### 9.2. Seed nghề

Script:

```bash
npm run seed:careers
npm run seed:careers:dry-run
```

Nguồn:

- `data/Occupation_Data_ready.csv`
- `data/Abilities.xlsx`
- `data/Essential Skills.xlsx`
- `data/Knowledge.xlsx`
- `data/Transferable Skills.xlsx`
- `data/Work Styles.xlsx`
- `data/onet_riasec_mapped.xlsx`
- `backend/src/data/elements.csv`

Script:

- Load danh sách nghề.
- Load mã element.
- Đọc từng file Excel O*NET để lấy `Data Value`.
- Chuẩn hóa importance về 0-1.
- Gắn RIASEC code.
- Gắn career cluster qua helper `loadCareerClusterMap`.
- Upsert career vào MongoDB.

Lưu ý quan trọng: trong workspace hiện tại, helper `careerCluster.js` mặc định tìm thư mục `career_cluster` ở gốc dự án, nhưng thư mục này không tồn tại trong danh sách file đã rà soát. Vì vậy `seed:careers` hoặc `update:career-clusters` có thể lỗi nếu chưa bổ sung thư mục này hoặc chỉnh lại đường dẫn nguồn cluster.

### 9.3. Seed Core Quiz

Script:

```bash
npm run seed:profiling
```

Nguồn:

- `QAprofiling.json`

Script:

- Validate câu hỏi.
- Normalize element code.
- Validate target element tồn tại và đúng type.
- Upsert vào collection `profilingquestions`.

### 9.4. Migration optimized schemas

Script:

```bash
npm run migrate:optimized-schemas
```

Chức năng:

- Chuẩn hóa `aiDiscoveries.confirmedElements.contribution`.
- Cắt messages AI Discovery còn tối đa 50.
- Chuẩn hóa code trong `ProfilingQuestion.target_elements`.

## 10. Biến môi trường

Backend cần các biến sau:

| Biến | Ý nghĩa |
|---|---|
| `MONGO_URI` | Chuỗi kết nối MongoDB |
| `JWT_SECRET` | Secret ký JWT |
| `ACCESS_TOKEN_EXPIRES_IN` | Thời gian sống access token, mặc định `15m` |
| `REFRESH_TOKEN_TTL_DAYS` | Số ngày sống refresh token, mặc định `30` |
| `ADMIN_SETUP_SECRET` | Secret để tạo admin qua `/auth/admin/create` |
| `DEEPSEEK_API_KEY` | API key DeepSeek |
| `DEEPSEEK_MODEL` | Model DeepSeek, mặc định `deepseek-v4-pro` |
| `TAVILY_API_KEY` | API key Tavily Search, tùy chọn |
| `PORT` | Port backend, mặc định `5000` |

Frontend cần:

| Biến | Ý nghĩa |
|---|---|
| `VITE_API_BASE_URL` | Base URL backend API, mặc định `http://localhost:5000/api` |

## 11. Cách chạy dự án

### 11.1. Backend

```bash
cd backend
npm install
npm run dev
```

Backend chạy mặc định ở:

```text
http://localhost:5000
```

API base:

```text
http://localhost:5000/api
```

### 11.2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend Vite mặc định chạy ở:

```text
http://localhost:5173
```

### 11.3. Seed dữ liệu đề xuất

Thứ tự nên chạy:

```bash
cd backend
npm run seed:elements
npm run seed:profiling
npm run seed:careers:dry-run
npm run seed:careers
```

Nếu `seed:careers` lỗi do thiếu `career_cluster`, cần bổ sung dữ liệu cluster hoặc điều chỉnh helper `loadCareerClusterMap`.

## 12. Kiểm thử

Backend có bộ test trong `backend/tests/`.

Các nhóm test hiện có:

- `careerRecommendation.service.test.js`
  - Giữ top-K element theo loại.
  - Tính similarity full score khi vector giống nhau.
  - Tính RIASEC fit.
  - Rank nghề, loại nghề không overlap, calibrate display score.
  - Giới hạn số recommendation.
  - Fingerprint ổn định khi đổi thứ tự element.
  - Không trả full career elements trong payload cache.
- `careerFitExplanation.service.test.js`
  - Chọn strength mặc định.
  - Reject strength không thuộc matched list.
  - Parse JSON có markdown fence.
  - Validate đủ explanation.
  - Cache đúng theo profile/career version.
- `careerExploreChat.service.test.js`
  - Parse JSON chat.
  - Normalize conversation.
  - Validate feedback.
  - Nhận diện câu hỏi cần web search.
  - Build prompt gồm profile, career, web context.
- `careerDayInLife.service.test.js`
  - Parse activities.
  - Reject danh sách quá ngắn.
  - Cache theo career version.
- `careerCluster.test.js`
  - Normalize/format career cluster.
  - Kiểm tra 14 giá trị cluster tiếng Việt cố định.

Chạy test:

```bash
cd backend
npm test
```

Frontend có cấu hình ESLint:

```bash
cd frontend
npm run lint
```

## 13. Điểm mạnh kỹ thuật của dự án

### 13.1. Thiết kế dữ liệu có khả năng giải thích

Điểm profile không chỉ lưu một con số cuối. `StudentProfile.elementScores` giữ `scoreBreakdown`, gồm:

- Điểm quiz.
- Số lượng bằng chứng quiz.
- Reliability quiz.
- Điểm AI Discovery.
- Level xác nhận.
- Confidence AI.
- Reliability AI.
- Trọng số từng nguồn.

Điều này rất phù hợp với báo cáo đồ án vì có thể giải thích tại sao hệ thống cho ra điểm.

### 13.2. Tách nguồn dữ liệu và dữ liệu dẫn xuất

Hệ thống lưu:

- Dữ liệu nguồn: câu trả lời quiz, confirmations AI.
- Dữ liệu dẫn xuất: elementScores, recommendation snapshot.

Nhờ đó có thể:

- Rebuild điểm khi thuật toán đổi.
- Không mất dữ liệu gốc.
- Tránh cộng dồn sai khi submit/reset/confirm nhiều lần.

### 13.3. Recommendation có nhiều lớp so khớp

Thuật toán không chỉ match element trực tiếp, mà kết hợp:

- Similarity theo vector element.
- RIASEC compatibility.
- Student-to-career fit.
- Coverage nghề.
- Top matched elements để giải thích.

### 13.4. AI output được kiểm soát

Các luồng AI đều yêu cầu JSON schema cụ thể. Backend parse, validate, retry khi JSON lỗi và không tin hoàn toàn output model. Candidate element của AI phải tồn tại trong DB và thuộc danh sách backend cung cấp.

### 13.5. Cache hợp lý

Hệ thống cache:

- Recommendation snapshot.
- Career fit explanations.
- Day-in-life entries.
- Career explore chat sessions.

Cache có fingerprint hoặc career updatedAt để tránh dùng kết quả cũ khi dữ liệu thay đổi.

### 13.6. Có module admin đầy đủ

Admin có thể quản trị dữ liệu cốt lõi mà không cần sửa file:

- Careers.
- Elements.
- Core Quiz.
- Users.

Điều này làm dự án có tính ứng dụng cao hơn prototype đơn giản.

## 14. Hạn chế và rủi ro hiện tại

### 14.1. Hiển thị tiếng Việt trong một số file/log có dấu hiệu lỗi encoding

Khi đọc bằng terminal, nhiều chuỗi tiếng Việt trong một số file hiển thị dạng mojibake. Một số file như `RiasecTest.jsx` hiển thị tiếng Việt đúng, nhưng nhiều file khác hiển thị sai ở output terminal. Cần kiểm tra lại encoding file trong editor và chuẩn hóa toàn bộ source sang UTF-8.

Ảnh hưởng:

- UI có thể hiển thị sai nếu file thật đang bị lưu sai encoding.
- Báo cáo và demo cần rà soát kỹ chữ tiếng Việt.

### 14.2. Thư mục `career_cluster` không có trong workspace

Backend utility `careerCluster.js` trỏ tới:

```text
../../../career_cluster
```

Nhưng thư mục này không xuất hiện trong repo hiện tại. Các script import career cluster có thể lỗi nếu chạy từ đầu.

### 14.3. Chưa thấy test frontend

Backend có test service khá tốt, nhưng frontend chưa có test component/e2e.

### 14.4. Rate limiter dùng memory Map

Rate limiter hiện lưu trong memory process. Khi deploy nhiều instance hoặc restart server, bộ đếm không đồng bộ. Với production lớn nên dùng Redis hoặc dịch vụ rate limit bên ngoài.

### 14.5. AI phụ thuộc dịch vụ ngoài

Các chức năng AI cần `DEEPSEEK_API_KEY`. Nếu thiếu key, server vẫn boot được do client lazy-init, nhưng chức năng AI sẽ lỗi khi gọi. Career Explore Chat có web search phụ thuộc `TAVILY_API_KEY`.

### 14.6. Một số route auth cũ vẫn tồn tại ở frontend

`Login.jsx` và `Register.jsx` vẫn có trong source, nhưng route `/login` và `/register` hiện redirect về LandingPage modal. Đây không phải lỗi nghiêm trọng, nhưng nên dọn nếu muốn source gọn hơn.

## 15. Gợi ý nội dung đưa vào báo cáo đồ án tốt nghiệp

Có thể triển khai báo cáo đồ án theo cấu trúc sau:

### Chương 1. Mở đầu

- Lý do chọn đề tài.
- Mục tiêu nghiên cứu và xây dựng hệ thống.
- Đối tượng sử dụng: học sinh THPT, quản trị viên.
- Phạm vi: định hướng nghề nghiệp tham khảo, không thay thế chuyên gia tư vấn.

### Chương 2. Cơ sở lý thuyết

- Mô hình Holland/RIASEC.
- Dữ liệu nghề nghiệp O*NET.
- Khái niệm vector năng lực/kỹ năng/kiến thức.
- Nguyên tắc recommendation dựa trên similarity.
- Ứng dụng LLM trong khai thác thông tin cá nhân có kiểm soát.

### Chương 3. Phân tích và thiết kế hệ thống

- Actor: học sinh, admin.
- Use case:
  - Đăng ký/đăng nhập.
  - Tạo hồ sơ.
  - Làm RIASEC.
  - Làm Core Quiz.
  - AI Discovery.
  - Xem dashboard.
  - Xem recommendation.
  - Chat hỏi nghề.
  - Quản trị dữ liệu.
- Kiến trúc client-server.
- Thiết kế database MongoDB.
- Thiết kế API.

### Chương 4. Xây dựng thuật toán

- Tính điểm RIASEC.
- Tính điểm Core Quiz.
- Tổng hợp Core Quiz và AI Discovery.
- Chọn element cho AI Discovery.
- Xếp hạng nghề:
  - Cosine similarity.
  - Weighted Jaccard.
  - RIASEC fit.
  - Student-to-career fit.
  - Calibration điểm hiển thị.
- Cơ chế cache/fingerprint.

### Chương 5. Cài đặt hệ thống

- Backend Express/Mongoose.
- Frontend React/Vite.
- Authentication JWT + refresh token.
- Tích hợp DeepSeek.
- Tích hợp Tavily Search.
- Các màn hình chính.
- Các script seed dữ liệu.

### Chương 6. Kiểm thử và đánh giá

- Unit test backend.
- Kiểm thử API.
- Kiểm thử luồng học sinh.
- Kiểm thử luồng admin.
- Đánh giá ưu điểm/hạn chế.

### Chương 7. Kết luận và hướng phát triển

- Kết quả đạt được.
- Hạn chế hiện tại.
- Hướng phát triển:
  - Chuẩn hóa encoding.
  - Bổ sung e2e test.
  - Cải thiện dữ liệu career cluster.
  - Bổ sung thống kê đánh giá recommendation.
  - Cá nhân hóa sâu hơn theo ngành học/trường học tại Việt Nam.

## 16. Tóm tắt giá trị của mã nguồn hiện tại

Dự án không chỉ là một website CRUD đơn giản. Phần giá trị kỹ thuật chính nằm ở việc kết hợp nhiều nguồn dữ liệu để tạo hồ sơ hướng nghiệp:

- RIASEC cho sở thích nghề nghiệp.
- Core Quiz cho bằng chứng định lượng về năng lực/kỹ năng/kiến thức/phong cách.
- AI Discovery cho bằng chứng định tính được học sinh xác nhận.
- O*NET và dữ liệu Việt hóa cho yêu cầu nghề.
- Thuật toán recommendation có nhiều thành phần và có thể giải thích.
- AI insight giúp học sinh hiểu sâu từng nghề thay vì chỉ xem danh sách kết quả.

Mã nguồn hiện tại đủ cơ sở để trình bày một đồ án tốt nghiệp theo hướng hệ thống gợi ý nghề nghiệp cá nhân hóa có tích hợp AI, có backend/frontend hoàn chỉnh, dữ liệu nghề nghiệp thực tế, thuật toán so khớp rõ ràng và module quản trị dữ liệu.
