# Algorithm v3 - Career Recommendation Scoring

Tài liệu này mô tả thuật toán tính điểm gợi ý nghề nghiệp phiên bản 3, tương ứng với `RECOMMENDATION_ALGORITHM_VERSION = 3` trong backend.

Code chính:

- `backend/src/services/careerRecommendation.service.js`
- `backend/src/services/careerRecommendationWorkflow.service.js`
- `backend/src/models/StudentProfile.js`

## 1. Mục tiêu thay đổi

Phiên bản cũ so sánh vector học sinh với toàn bộ vector nghề nghiệp. Mỗi nghề O*NET thường có rất nhiều element, trong khi hồ sơ học sinh chỉ có một tập element nhỏ hơn nhiều. Điều này làm điểm tuyệt đối thấp và nhiều nghề gần nhau.

Phiên bản 3 chuyển trọng tâm sang:

- Chỉ dùng các element cốt lõi nhất của nghề theo từng nhóm.
- Đánh giá riêng từng nhóm element để tránh một nhóm dữ liệu lớn lấn át nhóm khác.
- Thêm RIASEC interest fit vào điểm tổng.
- Thêm `studentToCareerFit` để đo xem điểm mạnh hiện có của học sinh có được nghề đó trọng dụng không.
- Giữ `rawScoreV3` để sort/cache, nhưng dùng `displayMatchScore` đã hiệu chuẩn percentile để hiển thị cho client.

## 2. Dữ liệu đầu vào

### 2.1. Profile học sinh

Từ `profile.elementScores`, backend tạo vector:

```text
profileWeights[code] = finalScore
```

Trong đó:

- `code`: mã element, được normalize về lowercase.
- `finalScore`: điểm tổng hợp element của học sinh, clamp trong khoảng `0..1`.
- Nếu trùng code, lấy điểm lớn nhất.

Backend cũng dùng:

```text
profile.riasecCode
```

Ví dụ:

```text
RIA
```

### 2.2. Career data

Mỗi nghề có:

```text
career.elements[] = {
  code,
  type,
  importance
}
```

Trong đó `importance` đã được normalize về `0..1` khi seed dữ liệu nghề.

Nghề cũng có:

```text
career.riasecCode
```

Ví dụ:

```text
IRC
```

## 3. Preprocess Career Vector

Trước khi tính điểm, vector nghề được rút gọn thành `careerCoreElements`.

Mục tiêu: chỉ giữ các element quan trọng nhất của nghề, tránh việc toàn bộ vector O*NET quá dày làm score bị kéo thấp.

Thuật toán:

1. Gom `career.elements` theo `type`.
2. Normalize `code` về lowercase.
3. Clamp `importance` về `0..1`.
4. Nếu cùng một nghề có duplicate element code trong cùng type, giữ bản có `importance` cao nhất.
5. Với từng type, sort giảm dần theo `importance`.
6. Lấy top-K theo cấu hình.

Cấu hình top-K:

```text
ability: 20
workstyle: 15
transferable_skill: 10
essential_skill: 5
knowledge: 10
```

Kết quả:

```text
careerCoreElements = top-K important elements per type
```

Các element ngoài top-K không tham gia tính score v3.

## 4. Element Fit

`elementFit` đo mức độ tương đồng giữa profile học sinh và các element cốt lõi của nghề.

Điểm này được tính riêng theo từng `type`, sau đó cộng có trọng số.

### 4.1. Chỉnh vector user cùng chiều với career type vector

Với mỗi `type`, backend lấy vector nghề sau preprocess:

```text
careerTypeWeights = careerCoreElements where element.type = type
```

Vector học sinh được chiếu lên cùng không gian code với career type vector:

```text
profileWeight_i = profileWeights[code_i] || 0
careerWeight_i = careerTypeWeights[code_i]
```

Nghĩa là nếu nghề có một core element mà học sinh chưa có điểm ở element đó, điểm học sinh tại chiều đó là `0`.

### 4.2. Cosine similarity theo type

Với các code trong `careerTypeWeights`:

```text
cosine_type =
  sum(profile_i * career_i)
  / sqrt(sum(profile_i^2) * sum(career_i^2))
```

Nếu một trong hai vector có magnitude bằng `0`, `cosine_type = 0`.

### 4.3. Weighted Jaccard theo type

Với các code trong `careerTypeWeights`:

```text
weightedJaccard_type =
  sum(min(profile_i, career_i))
  / sum(max(profile_i, career_i))
```

Nếu mẫu số bằng `0`, `weightedJaccard_type = 0`.

### 4.4. Type Fit

Mỗi type fit là tổ hợp giữa cosine và weighted Jaccard:

```text
typeFit =
  0.65 * cosine_type
  + 0.35 * weightedJaccard_type
```

Cosine được ưu tiên cao hơn vì phản ánh hướng tương đồng của vector. Weighted Jaccard bổ sung yếu tố overlap theo trọng số tuyệt đối.

### 4.5. Tổng Element Fit

Sau khi có `typeFit` cho từng nhóm:

```text
elementFit =
  0.30 * abilityFit
  + 0.30 * workstyleFit
  + 0.15 * transferableSkillFit
  + 0.15 * essentialSkillFit
  + 0.10 * knowledgeFit
```

Trọng số này nhấn mạnh `ability` và `workstyle`, vì đây là tín hiệu ổn định hơn với học sinh phổ thông. `knowledge` được giữ thấp hơn vì học sinh chưa nhất thiết đã có đủ kiến thức nghề chuyên môn.

## 5. Student To Career Fit

`studentToCareerFit` trả lời câu hỏi:

```text
Những gì học sinh đang có mạnh nhất có được nghề này trọng dụng không?
```

Công thức:

```text
studentToCareerFit =
  sum(profile_i * career_i for matched i)
  / sum(profile_i)
```

Trong đó:

- `profile_i`: điểm element của học sinh.
- `career_i`: importance của element đó trong `careerCoreElements`.
- Nếu một element học sinh có nhưng không nằm trong `careerCoreElements`, `career_i = 0`.
- Mẫu số là tổng toàn bộ điểm profile của học sinh.

Nếu `sum(profile_i) = 0`, điểm này bằng `0`.

Ý nghĩa:

- Cao: các điểm mạnh hiện có của học sinh được nghề này sử dụng nhiều.
- Thấp: học sinh có thể có nhiều điểm mạnh, nhưng các điểm đó không phải core requirement của nghề.

Điểm này khác với `elementFit`:

- `elementFit` nhìn từ phía nghề: học sinh match các core element của nghề đến đâu.
- `studentToCareerFit` nhìn từ phía học sinh: nghề này tận dụng profile hiện có của học sinh đến đâu.

## 6. RIASEC Interest Fit

`riasecFit` đo sự giao nhau giữa RIASEC của học sinh và RIASEC của nghề.

### 6.1. Normalize RIASEC code

Backend normalize code bằng cách:

1. Uppercase.
2. Chỉ giữ các ký tự `R`, `I`, `A`, `S`, `E`, `C`.
3. Bỏ duplicate, giữ thứ tự xuất hiện đầu tiên.

Ví dụ:

```text
"ria" -> "RIA"
"RIIR" -> "RI"
```

### 6.2. Rank weight

Mỗi chữ trong RIASEC code được gán trọng số theo thứ hạng.

Với code có độ dài `n`:

```text
weight(letter_at_index_i) = (n - i) / n
```

Ví dụ với `RIA`:

```text
R = 1.0000
I = 0.6667
A = 0.3333
```

### 6.3. Weighted intersection over union

Với tập chữ xuất hiện trong student hoặc career code:

```text
riasecFit =
  sum(min(studentWeight_l, careerWeight_l))
  / sum(max(studentWeight_l, careerWeight_l))
```

Nếu cả hai bên không có RIASEC code hợp lệ, điểm bằng `0`.

Ví dụ:

```text
student = RIA
career = RIA
riasecFit = 1
```

```text
student = RIA
career = SEC
riasecFit = 0
```

```text
student = RIA
career = IRS
riasecFit > 0
```

## 7. Raw Score V3

Điểm thô của nghề:

```text
rawScoreV3 =
  0.45 * elementFit
  + 0.25 * riasecFit
  + 0.30 * studentToCareerFit
```

Ý nghĩa trọng số:

- `elementFit` 45%: nghề có khớp với năng lực/phong cách/kỹ năng/kiến thức cốt lõi của học sinh không.
- `riasecFit` 25%: nghề có khớp với sở thích nghề nghiệp không.
- `studentToCareerFit` 30%: nghề có tận dụng tốt những điểm mạnh hiện có của học sinh không.

`rawScoreV3` nằm trong khoảng `0..1`.

Backend dùng `rawScoreV3` để:

- Sort danh sách recommendation.
- Lưu cache snapshot.
- Debug/explain score.

## 8. Matched Elements

Backend cũng tính danh sách element match để giải thích cho client.

Với mỗi element trong `careerCoreElements`:

```text
profileWeight = profileWeights[code] || 0
careerImportance = careerCoreElement.importance
contribution = profileWeight * careerImportance
```

Chỉ giữ element có `contribution > 0`.

Sort:

1. `contribution` giảm dần.
2. `careerImportance` giảm dần.
3. `code` tăng dần.

Lấy tối đa:

```text
TOP_MATCHED_ELEMENT_LIMIT = 5
```

Payload mỗi matched element:

```json
{
  "code": "analysis",
  "type": "ability",
  "profileScore": 0.9,
  "careerImportance": 0.8,
  "contribution": 0.72
}
```

## 9. Career Coverage

`careerCoverage` đo tỷ lệ trọng số career core elements đã được match.

```text
careerCoverage =
  sum(careerImportance of matched core elements)
  / sum(careerImportance of all career core elements)
```

Điểm này không nằm trực tiếp trong `rawScoreV3`, nhưng được dùng làm tie-break khi hai nghề có cùng raw score.

Sort recommendation:

```text
1. rawScoreV3 giảm dần
2. careerCoverage giảm dần
3. title_vi hoặc title_en tăng dần
```

## 10. Display Score Calibration

Backend giữ nguyên `rawScoreV3` cho ranking/cache, nhưng không hiển thị trực tiếp điểm thô cho học sinh.

Sau khi đã:

1. Tính score cho tất cả nghề.
2. Lọc nghề không có matched element.
3. Sort theo `rawScoreV3`.
4. Slice theo recommendation limit.

Backend hiệu chuẩn điểm hiển thị dựa trên chính danh sách kết quả trả về cho học sinh đó.

### 10.1. Percentile

Với danh sách score đã sort tăng dần:

```text
sortedScores = sort(rawScoreV3 ascending)
```

Percentile của một nghề:

```text
percentile = rank(rawScoreV3) / (n - 1)
```

Nếu có nhiều nghề cùng raw score, dùng trung bình vị trí đầu và cuối của nhóm score bằng nhau.

Nếu danh sách chỉ có 1 nghề:

```text
percentile = 1
```

### 10.2. Display Match Score

Công thức:

```text
displayMatchScore =
  round(55 + 40 * percentile(rawScoreV3)^0.75)
```

Khoảng điểm hiển thị:

```text
55..95
```

Ý nghĩa:

- Nghề thấp nhất trong danh sách vẫn không bị hiển thị như "không phù hợp".
- Nghề cao nhất trong danh sách thường đạt khoảng `95`.
- Hàm mũ `0.75` làm phần giữa danh sách dễ đọc hơn, không nén quá mạnh vào vùng thấp.

Backend trả về:

```json
{
  "rawScoreV3": 0.4123,
  "recommendationScore": 0.4123,
  "displayMatchScore": 87,
  "matchPercentage": 87
}
```

`matchPercentage` hiện được set bằng `displayMatchScore` để giữ tương thích với frontend cũ.

## 11. API Payload Chính

Mỗi recommendation trả về các field quan trọng:

```json
{
  "onetCode": "15-1252.00",
  "title_en": "Software Developers",
  "title_vi": "...",
  "riasecCode": "IRC",
  "recommendationScore": 0.4123,
  "rawScoreV3": 0.4123,
  "displayMatchScore": 87,
  "matchPercentage": 87,
  "similarityBreakdown": {
    "elementFit": 0.38,
    "riasecFit": 0.72,
    "studentToCareerFit": 0.29,
    "careerCoverage": 0.31,
    "typeFits": {
      "ability": {
        "typeFit": 0.51,
        "cosine": 0.56,
        "weightedJaccard": 0.42,
        "careerCoreElementCount": 20
      }
    }
  },
  "matchedElementCount": 8,
  "careerCoreElementCount": 60,
  "topMatchedElements": []
}
```

## 12. Cache Và Fingerprint

Recommendation snapshot vẫn được lưu trong `StudentProfile.careerRecommendationSnapshot`.

Điều kiện reuse cache:

```text
snapshot.algorithmVersion == RECOMMENDATION_ALGORITHM_VERSION
snapshot.recommendationLimit == DEFAULT_RECOMMENDATION_LIMIT
snapshot.elementScoresFingerprint == currentElementScoresFingerprint
snapshot.profileRecommendationFingerprint == currentProfileRecommendationFingerprint
snapshot.careerDataFingerprint == currentCareerDataFingerprint
snapshot.recommendations is array
```

`profileRecommendationFingerprint` được tạo từ:

```text
elementScoresFingerprint
riasecCode
```

Nhờ vậy, nếu học sinh làm lại RIASEC nhưng element scores chưa đổi, recommendation vẫn được tính lại.

`RECOMMENDATION_ALGORITHM_VERSION = 3` cũng làm snapshot v2 tự invalidated.

## 13. Các Trường Hợp Biên

### 13.1. Học sinh chưa có element scores

Workflow trả lỗi:

```text
409 Complete the profiling steps before requesting recommendations
```

### 13.2. Nghề không có overlap element

Nếu:

```text
matchedElementCount = 0
```

Nghề bị loại khỏi danh sách recommendation.

### 13.3. Nghề thiếu RIASEC

Nếu `career.riasecCode` rỗng hoặc không hợp lệ:

```text
riasecFit = 0
```

Nghề vẫn có thể được recommend nếu element fit đủ tốt.

### 13.4. Học sinh thiếu RIASEC

Nếu `profile.riasecCode` rỗng hoặc không hợp lệ:

```text
riasecFit = 0
```

Tuy nhiên workflow sản phẩm hiện thường yêu cầu học sinh hoàn thành RIASEC trước các bước khám phá sâu.

### 13.5. Type không có career core element

Nếu một type không có element sau preprocess:

```text
cosine_type = 0
weightedJaccard_type = 0
typeFit = 0
```

Type đó vẫn đóng góp `0` vào `elementFit`.

## 14. Tóm Tắt Công Thức

```text
careerCoreElements =
  top-K elements by importance within each type
```

```text
typeFit =
  0.65 * cosine_type
  + 0.35 * weightedJaccard_type
```

```text
elementFit =
  0.30 * abilityFit
  + 0.30 * workstyleFit
  + 0.15 * transferableSkillFit
  + 0.15 * essentialSkillFit
  + 0.10 * knowledgeFit
```

```text
studentToCareerFit =
  sum(profile_i * career_i for matched i)
  / sum(profile_i)
```

```text
riasecFit =
  weighted_intersection(studentRiasec, careerRiasec)
  / weighted_union(studentRiasec, careerRiasec)
```

```text
rawScoreV3 =
  0.45 * elementFit
  + 0.25 * riasecFit
  + 0.30 * studentToCareerFit
```

```text
displayMatchScore =
  round(55 + 40 * percentile(rawScoreV3)^0.75)
```
