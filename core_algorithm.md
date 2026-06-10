# Phan tich thuat toan loi he thong goi y nghe nghiep

Tai lieu nay tong hop cac thuat toan backend quan trong hien co, gom Core Quiz, AI Discovery, diem tong element va diem phu hop nghe. Phan tich dua tren code hien tai trong `backend/src/services`, model MongoDB, du lieu seed O*NET va doi chieu voi mot so cach tiep can pho bien trong huong nghiep.

## 1. Boi canh du lieu va luong tong the

He thong dang dung 5 nhom element:

- `ability`: nang luc/kha nang
- `workstyle`: phong cach lam viec/tinh cach lien quan cong viec
- `essential_skill`: ky nang thiet yeu
- `transferable_skill`: ky nang chuyen doi
- `knowledge`: mien kien thuc

Nguon nghe nghiep duoc seed tu cac file O*NET:

- `Abilities.xlsx`
- `Essential Skills.xlsx`
- `Knowledge.xlsx`
- `Transferable Skills.xlsx`
- `Work Styles.xlsx`

Trong `backend/src/scripts/seedCareers.js`, moi element cua nghe duoc chuan hoa ve `importance` trong khoang 0..1:

```text
Neu scale IM 1..5: importance = (value - 1) / 4
Neu scale WI -3..3: importance = (value + 3) / 6
```

Thong ke nhanh tu du lieu hien co:

- Core Quiz co 81 cau hoi nguon trong `QAprofiling.json`.
- Moi lan lam quiz chon 30 cau: ability 9, workstyle 7, transferable_skill 6, knowledge 5, essential_skill 3.
- Diem mapping dap an Core Quiz trong du lieu hien tai nam trong khoang 0.3..0.8, trung binh khoang 0.6922.
- Du lieu nghe co 923 nghe co element.
- Moi nghe co rat nhieu element: min 21, p25 112, median 123, p75 131, max 140.
- `career.elements.importance` co trung vi khoang 0.4717, trung binh khoang 0.4748.

Nhan xet quan trong: profile hoc sinh sau quiz/AI thuong chi co mot vector element kha thua, trong khi moi nghe co vector rat day, thuong hon 100 element. Day la nguyen nhan chinh lam diem tuong dong tuyet doi bi thap va cac nghe gan nhau.

## 2. Thuat toan Core Quiz

Code chinh:

- `backend/src/services/coreQuiz.service.js`
- `backend/src/controllers/coreQuiz.controller.js`
- `backend/src/models/ProfilingQuestion.js`

### 2.1. Chon cau hoi

Core Quiz load ngan hang cau hoi tu MongoDB `ProfilingQuestion` neu `use_data_from_mongo = true`; neu khong thi load tu `QAprofiling.json`.

Quota cau hoi:

```text
ability: 9
workstyle: 7
transferable_skill: 6
knowledge: 5
essential_skill: 3
Tong: 30 cau
```

Thuat toan:

1. Loc cau hoi active theo tung `target_type`.
2. Shuffle ngau nhien tung nhom.
3. Lay so cau theo quota.
4. Neu thieu tong 30 cau thi lay fallback tu cac cau chua chon.
5. Shuffle lan cuoi de tron thu tu hien thi.
6. Tra ve cau hoi da sanitize, mac dinh khong tra mapping diem cho hoc sinh. Admin co the xem `elementScores`.

### 2.2. Mapping dap an thanh diem element

Moi cau hoi co `target_elements` tu 1 den 4 element. Moi answer co `mapping`, trong do moi element mapping co:

```text
score: 0.1..1
evidence_strength: weak | medium | strong
```

Trong code hien tai, `evidence_strength` chi duoc validate va luu, chua duoc dung trong cong thuc tinh diem.

Voi moi dap an hoc sinh chon:

```text
rawSum[element] += mapping.score
evidenceCount[element] += 1
```

Sau khi gom het dap an:

```text
averageScore = rawSum / evidenceCount
confidence = min(evidenceCount / 10 + 0.5, 1)
coreQuizFinalScore = averageScore * confidence
```

Ket qua Core Quiz rieng tung element:

```json
{
  "code": "example",
  "type": "ability",
  "finalScore": 0.72,
  "scoreBreakdown": {
    "averageScore": 0.8,
    "confidence": 0.9,
    "evidenceCount": 4,
    "rawSum": 3.2
  }
}
```

### 2.3. Diem can luu y

Trong `calculateProfileElementScores`, he thong khong dung `coreQuizFinalScore` cua Core Quiz truc tiep. He thong dung `scoreBreakdown.averageScore` lam `quizScore`, roi tinh lai reliability/discount o lop tong hop. Nghia la cong thuc `averageScore * confidence` trong `calculateElementScores` hien chu yeu co gia tri khi hien thi ket qua Core Quiz rieng, con diem tong profile dung cong thuc khac.

Day la thiet ke hop ly neu muon tach "diem nguon quiz" va "do tin cay cua nguon quiz". Tuy nhien ten `finalScore` trong Core Quiz co the gay nham lan vi no khong phai diem cuoi cung cua profile.

## 3. Thuat toan AI Discovery

Code chinh:

- `backend/src/controllers/aiDiscovery.controller.js`
- `backend/src/services/elementSelectionService.js`
- `backend/src/prompts/aiDiscoveryPrompt.js`
- `backend/src/constants/aiDiscovery.js`

### 3.1. Dieu kien bat dau

Hoc sinh phai co profile va da co `riasecCode`. Neu chua co RIASEC, API tra loi:

```text
Complete the RIASEC test before starting AI discovery
```

### 3.2. Chon element dua vao RIASEC va chu de hoi

AI Discovery khong dua toan bo element cho model. He thong chon mot danh sach ung vien co gioi han.

Base quota:

```text
ability: 22
workstyle: 18
transferable_skill: 8
essential_skill: 6
knowledge: 6
Tong: 60 element
```

Neu opening topic khac nhau thi quota se thay doi. Vi du:

- `curiosity_research`: tang `knowledge`
- `helping_people`: tang `workstyle` va `transferable_skill`
- `planning_structure`: tang `workstyle` va `essential_skill`

Voi moi element, he thong tinh:

```text
riasecScore = tong riasec_weights cua cac chu cai top trong riasecCode hoc sinh
topicBoost = boost theo openingTopic va type
randomScore = random on dinh theo seed/session va code element
selectionScore = riasecScore + topicBoost + randomScore * 0.03
```

Sau do moi nhom element:

1. Lay khoang 70% quota theo `selectionScore` cao nhat.
2. Phan con lai lay theo random co seed de mo rong kham pha.
3. Neu thieu thi bu bang cac element con lai co `selectionScore` cao.

### 3.3. AI de xuat candidate

Prompt yeu cau AI:

- Hoi tiep neu bang chung con mo ho.
- Neu da du ro thi de xuat 3-6 candidate elements.
- Chi chon trong `availableElements`.
- Moi candidate co `confidence` 0.1..1.0.

Backend khong tin truc tiep du lieu code/type/name tu AI. Sau khi AI tra JSON, backend doi chieu candidate code voi danh sach element da cung cap. Candidate hop le phai:

- Co code trong available elements.
- Co reason khong rong.
- Co confidence hop le.
- Tong so candidate tu 3 den 6.

### 3.4. Hoc sinh xac nhan AI Discovery

Hoc sinh chon candidate va gan `level`:

```text
level = 1 | 2 | 3
```

Khi confirm, backend luu vao profile:

```text
code
type
level
contribution = candidate.confidence
```

Neu cung mot element xuat hien o nhieu AI Discovery session, thuat toan tong hop chi dung ban moi nhat cho element do. Cach nay tranh viec mot element bi cong lap nhieu lan.

## 4. Thuat toan tinh diem tong element cua hoc sinh

Code chinh:

- `backend/src/services/profileElementScore.service.js`
- `backend/src/models/StudentProfile.js`

Version hien tai:

```text
ELEMENT_SCORE_ALGORITHM_VERSION = 2
```

### 4.1. Dau vao

Diem tong profile duoc rebuild tu source records:

- `coreQuizAnswers`
- `aiDiscoveries`

Thiet ke nay tot vi:

- Idempotent: goi lai submit/confirm khong lam diem bi cong don sai.
- Co the migrate lai khi doi cong thuc.
- Giam loi lam tron tich luy.

### 4.2. Them bang chung Core Quiz

Tu Core Quiz, he thong tinh `quizElementScores`, sau do voi moi element:

```text
quizScore = scoreBreakdown.averageScore
quizEvidenceCount = scoreBreakdown.evidenceCount
```

Khong dung `coreQuizFinalScore` o buoc nay.

### 4.3. Them bang chung AI Discovery

Voi moi confirmed element moi nhat:

```text
aiDiscoveryScore = level / 3
aiDiscoveryLevel = level
aiDiscoveryConfidence = clamp(contribution, 0.1, 1)
```

Neu snapshot cu khong co contribution thi dung `DEFAULT_AI_CONFIDENCE = 0.5`.

### 4.4. Tinh finalScore cua tung element

Cac hang so:

```text
AI_DISCOVERY_BASE_WEIGHT = 0.75
CORE_QUIZ_BASE_WEIGHT = 0.25
QUIZ_EVIDENCE_TARGET = 5
```

Reliability:

```text
quizReliability = min(quizEvidenceCount / 5, 1)
aiDiscoveryReliability = 0.8 + 0.2 * aiDiscoveryConfidence
```

Truong hop co ca Core Quiz va AI Discovery:

```text
quizWeight = 0.25 * quizReliability
aiDiscoveryWeight = 0.75 * aiDiscoveryReliability

finalScore =
  (quizScore * quizWeight + aiDiscoveryScore * aiDiscoveryWeight)
  / (quizWeight + aiDiscoveryWeight)
```

Truong hop chi co AI Discovery:

```text
finalScore = aiDiscoveryScore
aiDiscoveryWeight = aiDiscoveryReliability
```

Truong hop chi co Core Quiz:

```text
finalScore = quizScore * (0.5 + 0.5 * quizReliability)
quizWeight = quizReliability
```

Ket qua tra ve sap xep giam dan theo `finalScore`.

### 4.5. Danh gia cong thuc tong element

Diem manh:

- Tach nguon du lieu quiz va AI ro rang.
- AI Discovery duoc uu tien vi co xac nhan truc tiep cua hoc sinh.
- Quiz-only bi discount khi bang chung it, tranh viec 1-2 cau hoi lam mot element qua cao.
- Co `scoreBreakdown` giai thich duoc.

Rui ro:

- `evidence_strength` trong cau hoi chua duoc dung, nen dap an weak/medium/strong khong khac nhau neu cung score.
- `quizScore` la average cua cac mapping duoc chon, khong so voi cac dap an khong chon. Neu ngan hang cau hoi mapping thien ve score 0.6..0.8, diem quiz de bi nén.
- AI Discovery `level` 1/2/3 thanh 0.333/0.667/1.0. Day la thang thô, co the tao buoc nhay lon neu hoc sinh chon level 3.
- Khi chi co AI Discovery, finalScore khong bi discount theo reliability. Code co tinh `aiDiscoveryReliability` nhung khong nhan vao `finalScore`. Dieu nay hop ly neu xem xac nhan hoc sinh la bang chung manh, nhung nen hien thi confidence rieng.

## 5. Thuat toan tinh diem phu hop nghe

Code chinh:

- `backend/src/services/careerRecommendation.service.js`
- `backend/src/routes/career.routes.js`

Version hien tai:

```text
RECOMMENDATION_ALGORITHM_VERSION = 2
```

### 5.1. Loc nghe co the goi y

API `/api/careers/recommendations/me` chi lay nghe thoa:

```json
{
  "is_active": true,
  "student_suitable": true,
  "elements.0": { "$exists": true }
}
```

Neu profile khong co element nao `finalScore > 0`, API tra 409 yeu cau hoan thanh profiling.

### 5.2. Vector hoc sinh va vector nghe

Profile:

```text
profileWeights[code] = element.finalScore
```

Career:

```text
careerWeights[code] = career.elements.importance
```

Neu co duplicate code thi lay weight lon nhat.

Tat ca weight duoc clamp 0..1.

### 5.3. Similarity hien tai

He thong tinh 2 do do:

```text
cosine =
  dot(profile, career)
  / (||profile|| * ||career||)
```

```text
weightedJaccard =
  sum(min(profile_i, career_i))
  / sum(max(profile_i, career_i))
```

Sau do:

```text
recommendationScore = 0.7 * cosine + 0.3 * weightedJaccard
matchPercentage = round(recommendationScore * 100)
```

He thong cung tinh:

```text
careerCoverage =
  tong careerImportance cua element co match
  / tong careerImportance cua tat ca career element
```

Nhung `careerCoverage` chi dung lam thong tin breakdown va tie-break khi sort, khong nam trong `recommendationScore`.

### 5.4. Top matched elements

Voi moi code co ca profileWeight va careerWeight:

```text
contribution = min(profileWeight, careerWeight)
```

Sap xep theo:

1. contribution giam dan
2. careerImportance giam dan
3. code tang dan

Lay toi da 5 element dau.

### 5.5. Cache ket qua goi y

He thong tao fingerprint tu:

- `elementScores`
- version thuat toan
- limit goi y
- fingerprint du lieu nghe: career count + career latest updatedAt/id

Neu fingerprint khong doi thi tra snapshot cached.

## 6. Vi sao score_match thap va nhieu nghe gan nhau

Day la van de co co so ky thuat, khong phai chi do UI.

### 6.1. Vector nghe qua day so voi vector hoc sinh

Moi nghe trong du lieu hien co co median khoang 123 element. Trong khi do profile hoc sinh sau Core Quiz va AI Discovery chi co mot tap element duong nho hon nhieu. Cosine similarity bi chia boi norm cua vector nghe:

```text
cosine = dot / (profileMagnitude * careerMagnitude)
```

Khi careerMagnitude lon vi nghe co rat nhieu requirement, score se thap neu hoc sinh chi match mot phan nho, du cac match do rat tot.

Weighted Jaccard con bi anh huong manh hon:

```text
union = sum(max(profile_i, career_i))
```

Cac element nghe khong co trong profile van nam trong union, nen mau so rat lon. Neu hoc sinh chi co 8-15 element match voi mot nghe co 120 element, weighted Jaccard thuong thap la binh thuong.

### 6.2. He thong dang tinh "full requirement fit", khong phai "career exploration affinity"

Voi hoc sinh cap 3, profile chua nen duoc hieu la "da co du nang luc/knowledge de lam nghe". Nhung similarity hien tai lai so profile voi toan bo requirement cua nghe. Dieu nay nghiem ngat hon muc can thiet cho bai toan kham pha nghe.

Vi du: hoc sinh rat hop huong "software/data" nhung chua co tat ca knowledge/skills cua nghe. Neu nghe co 120 element, score tuyet doi co the thap du day la nghe dang de kham pha.

### 6.3. Diem input cua quiz bi gioi han trong khoang hep

Mapping Core Quiz hien co co score 0.3..0.8, trung binh 0.6922. Sau discount reliability, quiz-only element co the thap hon nua. Khi profileWeights khong co nhieu diem gan 1.0, cac dot product se khong tach biet manh.

### 6.4. Nhieu nghe O*NET co chung requirement nen diem gan nhau

Nhung nghe trong cung nhom nganh thuong co nhieu ability/skill/workstyle giong nhau. Neu score chi dua tren element overlap, cac nghe gan nhau la dung ve mat vector. Can them tin hieu phan biet nhu:

- RIASEC code cua nghe
- careerCluster
- muc do phu hop voi muc tieu hoc sinh
- mon hoc yeu thich/manh
- do tuoi/lop va lo trinh hoc tap
- co hoi thi truong Viet Nam
- muc do "student_suitable"

## 7. Doi chieu voi cach tiep can pho bien

### 7.1. O*NET Content Model

O*NET Content Model la nen tang du lieu phu hop cho he thong nay vi no to chuc thong tin ve cong viec va nguoi lao dong thanh cac nhom nhu Worker Characteristics, Worker Requirements, Occupational Requirements va Market. Trang O*NET Resource Center mo ta Content Model la nen tang cua O*NET va gom cac thong tin ve jobs/workers trong mot cau truc ro rang: https://www.onetcenter.org/content.html.

He thong hien tai dang dung nhieu mien dung voi O*NET:

- Abilities
- Skills
- Knowledge
- Work Styles
- Career Interests/RIASEC

Day la huong dung ve mat du lieu.

### 7.2. O*NET Interest Profiler va RIASEC

O*NET Interest Profiler la cong cu self-assessment giup nguoi dung kham pha loai hoat dong va nghe ma ho thich, do 6 nhom Realistic, Investigative, Artistic, Social, Enterprising, Conventional. Tai lieu O*NET cung neu cong cu nay co lien ket ket qua voi hon 900 occupations va co lich su nghien cuu/validation: https://www.onetcenter.org/IP.html.

So voi cach do, he thong hien tai da co RIASEC, nhung RIASEC chu yeu duoc dung de:

- Dieu kien bat dau AI Discovery.
- Chon candidate elements cho AI Discovery.
- Luu trong profile.

RIASEC chua duoc dua truc tiep vao `recommendationScore`, du model Career co truong `riasecCode`. Day la mot thieu sot neu bai toan la huong nghiep cho hoc sinh, vi interest congruence thuong la tin hieu rat de giai thich voi nguoi hoc.

### 7.3. O*NET Scales

O*NET OnLine giai thich moi descriptor co scale nhu Importance, Level, Extent; Importance thuong 1..5, Level thuong 0..7, va cac scale can chuan hoa de dien giai dung: https://www.onetonline.org/help/online/scales.

He thong hien tai chi dung Importance/Work Styles impact va chuan hoa ve 0..1. Cach nay don gian va chap nhan duoc cho ranking ban dau. Tuy nhien:

- Importance cho biet descriptor quan trong den dau.
- Level cho biet muc do thanh thao/cuong do can thiet.

Neu chi dung Importance, he thong biet "ky nang nay quan trong" nhung chua biet "can gioi den muc nao". Voi hoc sinh cap 3, Level co the dung de phan biet nghe "nen kham pha" va nghe "doi hoi nang luc/dao tao cao".

### 7.4. O*NET Data Collection

O*NET dung chuong trinh thu thap du lieu da nguon: job incumbents, occupational experts, analyst ratings, employer postings, machine learning, NLP... va du lieu duoc refresh hang nam cho mot phan profile: https://www.onetcenter.org/dataCollection.html.

Dieu nay ung ho viec dung O*NET lam nguon nghe. Tuy nhien khi ap dung cho hoc sinh Viet Nam, nen xem O*NET la knowledge base nen, khong nen hien score nhu chan ly tuyet doi. Can them calibration theo ngu canh hoc sinh/Viet Nam.

### 7.5. Person-environment fit

Ly thuyet person-environment fit/person-job fit nhin chung so sanh dac diem ca nhan voi dac diem moi truong/cong viec. Cach he thong dung vector profile va vector career la mot dang indirect fit. Van de la "fit" co nhieu cach operationalize: fit ve so thich, fit ve nang luc, fit ve gia tri, fit ve nhu cau, fit ve yeu cau cong viec.

He thong hien tai dang tron nhieu loai fit vao mot score element. Dieu nay tot cho MVP, nhung voi hoc sinh, nen tach thanh cac diem con de giai thich:

- Interest fit: co thich loai cong viec nay khong?
- Strength fit: diem manh hien tai co dung trong nghe khong?
- Requirement readiness: nghe nay doi hoi them gi?
- Exploration confidence: he thong co du bang chung ve hoc sinh chua?

## 8. Danh gia muc do phu hop voi quy trinh test hoc sinh

Quy trinh hien tai:

1. Hoc sinh lam RIASEC.
2. Hoc sinh lam Core Quiz.
3. Hoc sinh chat AI Discovery va xac nhan element.
4. He thong tong hop elementScores.
5. He thong so elementScores voi career.elements de goi y nghe.

### 8.1. Diem phu hop

Quy trinh nay hop ly ve mat san pham:

- RIASEC dat nen tang ve so thich.
- Core Quiz tao bang chung co cau truc.
- AI Discovery bo sung bang chung tu hoi thoai va de hoc sinh xac nhan.
- Goi y nghe dua tren du lieu nghe co cau truc.

### 8.2. Diem chua phu hop

Voi hoc sinh cap 3, diem goi y nghe khong nen duoc tinh nhu bai toan tuyen dung/selection. Hoc sinh chua co day du knowledge/skills cua nghe, nen thieu match o nhieu requirement la binh thuong.

Vi vay, score hien tai nen duoc xem la "muc do lien quan cua nghe voi bang chung profile hien co", khong nen hien la "ban chi phu hop 23% voi nghe nay". Neu UI hien so thap, hoc sinh se nghi he thong khong tin vao cac lua chon top.

### 8.3. Ket luan danh gia

Thuat toan hien tai dung de ranking noi bo, nhung chua phu hop de hien thang diem match tuyet doi cho hoc sinh. Nen tach:

- `rawRecommendationScore`: score ky thuat de sort/cache/debug.
- `displayMatchScore`: diem da calibration de hien thi.
- `confidenceLevel`: do tin cay dua tren so bang chung.
- `explanation`: vi sao nghe nay duoc de xuat, dua tren top matched elements va RIASEC.

## 9. De xuat cai tien thuat toan

### 9.1. Cai tien nhanh: calibration diem hien thi

Khong nen hien truc tiep:

```text
matchPercentage = round(recommendationScore * 100)
```

Nen giu `recommendationScore` de sort, nhung tao `displayMatchScore` theo percentile trong danh sach nghe cua chinh hoc sinh.

Vi du:

```text
rankPercentile = 1 - rankIndex / (candidateCount - 1)
displayMatchScore = round(60 + 35 * rankPercentile^0.7)
```

Tac dung:

- Top nghe co the hien 88-95 thay vi 18-30.
- Cac nghe top van co thu tu dung.
- Khong lam sai raw score noi bo.

Can hien label:

```text
Do phu hop tuong doi trong danh sach nghe da doi chieu
```

Khong nen goi la "xac suat thanh cong".

### 9.2. Dung top-K career requirements thay vi toan bo 120+ element

Cho moi nghe, chi lay cac element quan trong nhat:

```text
careerTopElements =
  top K theo importance moi type
  hoac importance >= percentile 70 cua chinh nghe
```

Vi du:

```text
ability: top 20
workstyle: top 12
knowledge: top 10
essential_skill: top 8
transferable_skill: top 8
```

Sau do tinh similarity tren tap nay. Cach nay phu hop voi giai thich "nhung yeu cau noi bat cua nghe", giam viec mau so bi phinh to boi cac element phu.

### 9.3. Tach diem "student strengths useful for career" va "career requirements covered"

Nen tinh 2 chieu:

```text
studentToCareerFit =
  sum(profile_i * career_i for matched i)
  / sum(profile_i)
```

Y nghia: diem manh cua hoc sinh co dung trong nghe nay khong?

```text
careerRequirementCoverage =
  sum(min(profile_i, career_i) for matched i)
  / sum(career_i for top career requirements)
```

Y nghia: hoc sinh da co bang chung cho bao nhieu yeu cau noi bat cua nghe?

Voi hoc sinh, diem hien thi nen uu tien `studentToCareerFit`, con `careerRequirementCoverage` nen hien nhu "can bo sung" thay vi keo diem chinh xuong qua manh.

### 9.4. Dua RIASEC vao recommendationScore

Career model da co `riasecCode`, profile da co `riasecCode/riasecScores`, nhung score hien tai chua dung truc tiep.

Co the them:

```text
riasecFit = weighted overlap giua profile RIASEC va career.riasecCode
```

Vi du don gian:

```text
profileLetters = riasecCode cua hoc sinh, co trong so theo vi tri: 1.0, 0.7, 0.5
careerLetters = riasecCode cua nghe, co trong so theo vi tri: 1.0, 0.7, 0.5
riasecFit = sum(min(profileWeight[L], careerWeight[L])) / sum(careerWeight[L])
```

Hybrid score de ranking:

```text
recommendationScoreV3 =
  0.45 * elementFit
  + 0.25 * riasecFit
  + 0.20 * studentToCareerFit
  + 0.10 * evidenceConfidence
```

Trong do `elementFit` co the la cosine/Jaccard tren top-K career elements.

### 9.5. Dung evidence_strength cua Core Quiz

Hien tai `evidence_strength` chua duoc dung. Nen chuyen thanh weight:

```text
weak = 0.5
medium = 0.8
strong = 1.0
```

Khi tinh quiz:

```text
weightedRawSum += mapping.score * evidenceWeight
weightedEvidence += evidenceWeight
quizScore = weightedRawSum / weightedEvidence
quizEvidenceCount = weightedEvidence
```

Tac dung: cau hoi/dap an co bang chung manh anh huong nhieu hon.

### 9.6. Chuan hoa theo type

Do so element moi type khac nhau rat lon, ability va knowledge co the lan at. Nen tinh score moi type rieng roi tron:

```text
typeFit[type] = similarity(profile[type], career[type])

elementFit =
  0.25 ability
  + 0.20 workstyle
  + 0.20 transferable_skill
  + 0.20 essential_skill
  + 0.15 knowledge
```

Trong bai toan hoc sinh, nen can nhac tang workstyle/interest va giam knowledge, vi knowledge co the duoc hoc sau.

### 9.7. Them evidenceConfidence rieng

Do tin cay khong nen tron hoan toan vao match score. Nen tinh rieng:

```text
quizCoverage = min(numberOfAnsweredQuestions / 30, 1)
aiCoverage = min(numberOfConfirmedAiElements / 6, 1)
sourceDiversity = co ca RIASEC + Core Quiz + AI Discovery ? cao : thap

evidenceConfidence =
  0.4 * quizCoverage
  + 0.4 * aiCoverage
  + 0.2 * sourceDiversity
```

UI co the hien:

```text
Do tin cay: Trung binh
Hoan thanh them AI Discovery de goi y chinh xac hon
```

### 9.8. Dieu chinh ngon ngu UI

Neu tiep tuc dung raw score, khong nen hien:

```text
Phu hop 24%
```

Nen hien:

```text
Muc do uu tien: Rat phu hop / Phu hop / Co the kham pha
```

Hoac:

```text
Top 3 trong danh sach nghe cua ban
```

Kem giai thich:

- Vi sao phu hop: top matched elements.
- Nen tim hieu them gi: career requirements chua co bang chung.

## 10. De xuat cong thuc V3 cu the

Day la phuong an can bang giua dung ky thuat va trai nghiem hoc sinh.

### 10.1. Preprocess career vector

Cho moi nghe:

```text
careerCoreElements = lay top-K element theo importance trong tung type
```

K goi y:

```text
ability: 20
workstyle: 15
transferable_skill: 10
essential_skill: 10
knowledge: 10
```

Hoac dung nguong:

```text
importance >= max(0.55, percentile70 cua nghe)
```

### 10.2. Element fit

Tinh similarity rieng theo type:

```text
typeFit = 0.65 * cosine_type + 0.35 * weightedJaccard_type
```

Neu type khong co profile evidence thi bo qua hoac gan weight thap, khong nen phat nang.

Tong:

```text
elementFit = weightedAverage(typeFit)
```

### 10.3. Interest fit

```text
riasecFit = overlap(profile.riasecCode, career.riasecCode)
```

Neu thieu `career.riasecCode`, fallback ve element `riasec_tags`.

### 10.4. Strength usefulness

```text
strengthUsefulness =
  sum(profile_i * career_i for matched i)
  / sum(profile_i)
```

Chi tinh tren profile elements co finalScore >= 0.4 de tranh nhieu tin hieu yeu gay nhieu.

### 10.5. Final ranking score

```text
rawScoreV3 =
  0.45 * elementFit
  + 0.25 * riasecFit
  + 0.20 * strengthUsefulness
  + 0.10 * evidenceConfidence
```

### 10.6. Display score

Sau khi rank tat ca nghe:

```text
displayMatchScore =
  round(55 + 40 * percentile(rawScoreV3)^0.75)
```

Gioi han:

```text
Neu evidenceConfidence < 0.4 thi displayMatchScore <= 82
Neu matchedElementCount < 3 thi displayMatchScore <= 75
```

Tac dung:

- Diem top nghe khong con thap bat thuong.
- Diem khong bi thoi phong khi bang chung qua it.
- Van giu ranking theo raw score.

## 11. Ket luan

Thuat toan hien tai co nen tang dung: dung O*NET elements, dung RIASEC trong quy trinh, tong hop Core Quiz va AI Discovery co breakdown. Van de lon nhat nam o lop recommendation/display:

- `recommendationScore` hien la diem tuong dong vector tuyet doi voi toan bo requirement cua nghe.
- Voi hoc sinh cap 3, vector profile con thua va chua dai dien cho day du nang luc nghe nghiep.
- Moi nghe co qua nhieu element, lam cosine/Jaccard thap va cac score gan nhau.
- UI nhan score nay thanh phan tram match lam hoc sinh de mat tin tuong.

Huong nen lam:

1. Giu raw score de sort/debug, nhung khong hien truc tiep thanh phan tram.
2. Them display score theo percentile va confidence.
3. Tinh similarity tren top-K requirement noi bat cua nghe thay vi toan bo element.
4. Dua RIASEC fit vao ranking.
5. Tach "diem manh cua em co dung trong nghe nay" va "yeu cau nghe em can bo sung".
6. Dung `evidence_strength` trong Core Quiz de tang chat luong diem.

Neu chi sua mot viec truoc, nen sua `matchPercentage` thanh diem hien thi da calibration va doi label UI. Neu sua bai ban, nen tao `RECOMMENDATION_ALGORITHM_VERSION = 3` voi hybrid score va display score rieng.

## 12. Nguon tham khao

- O*NET Resource Center, The O*NET Content Model: https://www.onetcenter.org/content.html
- O*NET Resource Center, O*NET Interest Profiler: https://www.onetcenter.org/IP.html
- O*NET OnLine Help, Scales, Ratings, and Standardized Scores: https://www.onetonline.org/help/online/scales
- O*NET Resource Center, Data Collection Overview: https://www.onetcenter.org/dataCollection.html
- O*NET Resource Center, Questionnaires: https://www.onetcenter.org/questionnaires.html
