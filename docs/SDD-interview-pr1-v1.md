# SDD — job-interview PR1 v1
## 스캐폴드 + 랜딩 + 세션참여 + 직종선택 + 부팅가드

> slug: `interview-pr1` · 서브도메인: `interview.teachermate.co.kr`
> 입력 목업: `shared/mockups/vocational-job-prep-ai-interview-mockup-v2.html`(기능·공신력 권위본) + `...v3-responsive.html`(반응형 UI 권위본)
> 참조 스캐폴드: `data-class/` (라우트·auth·sessionCode 패턴)

## §CONTRACT SUMMARY (단일 진실 소스 — §5·§8·AC 전부 이 정의 참조)

| 계약 | 값 |
|------|-----|
| `/api/config` 응답 스키마 | `{ "supabaseRef": string }` — 비밀 없음, ref만 |
| `interview_participants.join_token` | `char(64) NOT NULL CHECK (join_token ~ '^[a-f0-9]{64}$')` — 입장 시 1회 발급, PATCH 시 X-Join-Token 헤더로 검증 |
| PATCH 소유권 증명 | `X-Join-Token: <joinToken>` 헤더 — DB `join_token`과 constant-time 비교, 불일치 → 403 |
| `interview_attempts.assigned_question_ids` 타입 | `text[] NOT NULL DEFAULT '{}'` (질문 ID 형태: `MFG-001`, `^[A-Z]{2,4}-[0-9]{3}$`) |
| `interview_attempts.criteria_hash` 타입 | `char(64) NOT NULL CHECK (criteria_hash ~ '^[a-f0-9]{64}$')` |
| `interview_attempts.questions_bank_hash` 타입 | `char(64) NOT NULL CHECK (questions_bank_hash ~ '^[a-f0-9]{64}$')` |

---

## §0 메타

| 항목 | 값 |
|------|-----|
| branch | `feat/interview-pr1` |
| base | `master` (9802436) |
| **generator model override** | **codex** |
| **eval-visual model override** | **claude-sonnet-4-6** |
| **eval-interaction model override** | **codex** |

본 PR은 IMPLEMENTATION-NOTES-POLICY 적용 대상.
Generator는 `docs/implementation-notes/PR-pending-interview-pr1.md`에
Decisions / Changes / Tradeoffs / Notes 4섹션을 STEP마다 누적 갱신.

---

## §1 목적

특성화고 AI 면접 코칭 서비스의 기반 인프라를 구축한다.
- 학생: 6자리 세션 코드 + 이름으로 입장 → 직종(8대·18소) 선택까지 도달
- 교사: 카카오 로그인 → 세션 생성 → 6자리 코드 확인
- 서버: 부팅 시 공신력·DB·인증 split 여부를 전부 자가 진단하여 결함 있으면 throw (서빙 전 실패)

PR1 단독으로 "교사가 세션 열고 학생이 직종 선택까지 들어가는" 수직 슬라이스가 완성된다.
면접 질문·AI 호출·리포트(PR2·PR3)는 Out of Scope.

---

## §2 현재 상태 (실측)

| 항목 | 실측 결과 |
|------|----------|
| `/home/claude/job-interview/` | `docs/PLAN-interview-v1.md`, `qa/ao-logs/`, `qa/blueprint-evidence/` 존재. 코드 파일 0 |
| 공유 데이터 | `shared/data/ai-interview/` 5종 완비 (questions 176 / taxonomy 8대18소 / followup 34 / star 24 / evaluation 8기준) |
| 참조 스캐폴드 | `data-class/client/src/lib/supabase.ts` — cookieStorage + `sb-auth-token` + `.teachermate.co.kr` 쿠키 도메인 패턴 |
| 참조 sessionCode | `data-class/server/src/lib/sessionCode.ts` — `generateUniqueCode()` alphabet `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (I·O·1 제외) |
| 참조 auth | `data-class/server/src/middleware/auth.ts` — `verifySupabaseJwt()`, cookie JSON/raw JWT 추출 패턴 |
| 참조 db | `data-class/server/src/db.ts` — `supabaseAdmin`, `createUserScopedClient()` |
| 공유 Supabase | `jblkb` (ref: jblkbztpbwqidfvmmoey) — 인증·데이터 공유 |

---

## §3 변경 명세

### 신규 파일 목록

```
job-interview/
├── package.json                          # workspace root (scripts: dev, build)
├── .env.example
├── supabase/
│   └── migrations/
│       └── 0001_interview_tables.sql     # interview_sessions + interview_participants
├── client/
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── tailwind.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── index.css
│       ├── lib/
│       │   └── supabase.ts               # cookieStorage + storageKey 'sb-auth-token' 패턴
│       ├── types/
│       │   └── index.ts                  # shared TS types
│       └── pages/
│           ├── LandingPage.tsx           # 히어로 + CTA 2개
│           ├── JoinPage.tsx              # 6자리코드 + 이름 입력
│           ├── IndustrySelectPage.tsx    # 8대→18소 드릴다운
│           ├── TeacherSessionPage.tsx    # 세션 생성 + 코드 표시
│           ├── DemoPage.tsx              # 직종 선택 stub (세션 불요)
│           ├── DevLoginPage.tsx          # 로컬 개발 이메일 로그인
│           └── AuthCallback.tsx         # 카카오 OAuth 콜백
└── server/
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── index.ts                      # Express5 부팅 + boot guards 호출
        ├── db.ts                         # supabaseAdmin + assertSameSupabaseProject
        ├── lib/
        │   ├── sessionCode.ts            # generateUniqueCode (data-class 패턴)
        │   └── bootGuards.ts             # validateCriteriaWeights / computeHash / NullSttProvider
        ├── middleware/
        │   └── auth.ts                   # verifySupabaseJwt (data-class 패턴)
        ├── routes/
        │   ├── index.ts                  # 라우트 등록
        │   ├── sessions.ts               # POST /api/sessions, GET /api/sessions/:code
        │   ├── participants.ts           # POST /api/sessions/:code/join
        │   └── industries.ts             # GET /api/industries
        └── types/
            └── index.ts
```

### Sprint Contract (측정 가능한 grep 기준)

모든 기준은 `grep -rn ... | wc -l` 로 검증 가능. Generator가 각 항목을 충족한 뒤 §B Eval이 판정한다.

```bash
# 1. 부팅 가드 — assertSameSupabaseProject
grep -rn 'assertSameSupabaseProject' server/src/ | wc -l
# expected: >= 2  (정의 1 + 호출 1)

# 2. 부팅 가드 — criteria weight 합=100
grep -rn 'validateCriteriaWeights' server/src/ | wc -l
# expected: >= 2  (정의 1 + 호출 1)

# 3. 부팅 가드 — criteria hash 계산
grep -rn 'computeCriteriaHash\|computeQuestionsBankHash' server/src/ | wc -l
# expected: >= 2  (각 1개씩)

# 4. STT NullProvider — 기본 바인딩
grep -rn 'NullSttProvider' server/src/ | wc -l
# expected: >= 1

# 5. STT 피처 플래그 — 클라이언트
grep -rn 'VITE_FEATURE_STT' client/src/ | wc -l
# expected: >= 1

# 6. DB code 정규식 constraint
grep -rn "A-Z0-9" supabase/migrations/0001_interview_tables.sql | wc -l
# expected: >= 1  (CHECK 절 존재)

# 7. RLS ENABLE — 두 테이블
grep -c 'ENABLE ROW LEVEL SECURITY' supabase/migrations/0001_interview_tables.sql
# expected: >= 2

# 8. 쿠키 스토리지 패턴 (공유 쿠키)
grep -rn 'sb-auth-token' client/src/ | wc -l
# expected: >= 1

grep -rn 'teachermate.co.kr' client/src/lib/supabase.ts | wc -l
# expected: >= 1

# 9. 교사 requireAuth 가드 — TeacherSessionPage
grep -rn 'requireAuth\|ProtectedRoute\|AuthGuard' client/src/ | wc -l
# expected: >= 1

# 10. 직종 목록 API 라우트 등록
grep -rn "industries" server/src/routes/ | wc -l
# expected: >= 2

# 11. 세션 코드 alphabet 검증 (I·O·1 제외)
grep -rn 'ABCDEFGHJKLMNP\|I.*O.*1\|alphabet' server/src/lib/sessionCode.ts | wc -l
# expected: >= 1

# 12. participant name 길이 제약 (1~30자)
grep -rn 'length.*name\|name.*length\|30\|trim' supabase/migrations/0001_interview_tables.sql | wc -l
# expected: >= 1
```

---

## §4 DB 스키마

```sql
-- 0001_interview_tables.sql
-- ⚠️ 신규 테이블만. 공유 jblkb에 적용.

-- 1. interview_sessions: 교사가 생성하는 면접 세션
CREATE TABLE interview_sessions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  code        char(6)     NOT NULL UNIQUE
                          CHECK (code ~ '^[A-Z0-9]{6}$'),
  teacher_id  uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       text        NOT NULL CHECK (length(trim(title)) >= 1 AND length(title) <= 100),
  status      text        NOT NULL DEFAULT 'active'
                          CHECK (status IN ('active', 'closed')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  closed_at   timestamptz
);

-- 2. interview_participants: 학생 입장 기록 (익명, 인증 없음)
CREATE TABLE interview_participants (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id           uuid        NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  name                 text        NOT NULL
                                   CHECK (length(trim(name)) >= 1 AND length(name) <= 30),
  -- 익명 소유권 증명: 입장 시 발급, 이후 변경 API 전부에 필요
  join_token           char(64)    NOT NULL
                                   CHECK (join_token ~ '^[a-f0-9]{64}$'),  -- crypto random 32bytes hex
  joined_at            timestamptz NOT NULL DEFAULT now(),
  selected_industry    text,           -- 8대 직종 majorCategory
  selected_sub         text,           -- 18소 직종 subCategory.name
  industry_confirmed   boolean     NOT NULL DEFAULT false  -- "면접 시작" 눌러야 true
);

-- RLS: deny-all (서버 service_role만 접근)
ALTER TABLE interview_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_participants ENABLE ROW LEVEL SECURITY;

-- 인덱스
CREATE INDEX idx_interview_sessions_code       ON interview_sessions(code);
CREATE INDEX idx_interview_sessions_teacher_id ON interview_sessions(teacher_id);
CREATE INDEX idx_interview_participants_session ON interview_participants(session_id);
```

> **주의**: `interview_attempts` (ADR-5·6, criteria_hash·questions_bank_hash 포함)는 PR2·PR3에서 추가.

---

## §5 API 계약

### POST `/api/sessions`
교사 세션 생성. `requireTeacherAuth` 미들웨어 필수.

**Request**:
```json
{ "title": "3-2반 모의면접" }
```

**Response 200**:
```json
{
  "session": {
    "id": "uuid",
    "code": "A3K9PL",
    "title": "3-2반 모의면접",
    "status": "active",
    "created_at": "ISO8601"
  }
}
```

**Error**:
| status | body.error | 조건 |
|--------|-----------|------|
| 401 | `unauthorized` | 인증 없음 |
| 422 | `title_required` | title 빈 문자열 |
| 500 | `code_generation_failed` | 5회 중복 코드 생성 실패 |

---

### GET `/api/sessions/:code`
세션 유효성 확인. 인증 불요.

**Response 200**:
```json
{
  "session": {
    "id": "uuid",
    "code": "A3K9PL",
    "title": "3-2반 모의면접",
    "status": "active"
  }
}
```

**Error**:
| status | body.error | 조건 |
|--------|-----------|------|
| 400 | `invalid_code_format` | 6자리 `[A-Z0-9]` 아님 |
| 404 | `session_not_found` | 존재 없음 |
| 410 | `session_closed` | `status = 'closed'` |

---

### POST `/api/sessions/:code/join`
학생 입장. 인증 불요.

**Request**:
```json
{ "name": "홍길동" }
```

**Response 200**:
```json
{
  "participant": {
    "id": "uuid",
    "session_id": "uuid",
    "name": "홍길동",
    "joined_at": "ISO8601"
  },
  "joinToken": "<64자 hex>"
}
```
- `joinToken`: 서버가 생성한 `crypto.randomBytes(32).toString('hex')`. 클라이언트는 **`localStorage`**에 `interview_join_token_{participantId}` 키로 보관.
  - `localStorage` 채택 이유: `sessionStorage`는 탭 닫힘 시 소실 → PATCH 불가 상태(❌ preflight FAIL 해소). `localStorage`는 브라우저 재시작 후에도 유지되어 소실 케이스 대폭 감소.
  - **토큰 소실 대응 시나리오 (AC-12)**:
    - `/session/:code/industry` 로드 시 `localStorage`에 토큰이 없으면 → `/join?code=:code` 로 리다이렉트 (새 participant 생성 흐름)
    - 세션이 `closed`이고 토큰도 없으면 → "세션이 종료됐습니다" 인라인 안내.
  - 세션 `closed` 후 서버가 410을 반환하므로 저장된 토큰은 자동 무효화됨 (클라이언트 명시적 삭제 불요).
- **주의**: `joinToken`은 응답에서 단 1회 반환. DB에 저장된 값은 이후 API에서 서버가 직접 비교하며, 재발급 없음.
- `join_token`은 응답에서 노출하지 않음(64자 hex는 joinToken과 동일 값이지만 DB 컬럼명은 join_token).


**Error**:
| status | body.error | 조건 |
|--------|-----------|------|
| 400 | `invalid_code_format` | 코드 형식 오류 |
| 400 | `name_required` | 이름 없음 or 빈 문자열 |
| 400 | `name_too_long` | 30자 초과 |
| 404 | `session_not_found` | |
| 410 | `session_closed` | |

---

### PATCH `/api/participants/:id/industry`
직종 선택 저장. **`X-Join-Token` 헤더 필수** — 입장 시 발급된 joinToken으로 소유권 증명.

**Headers**: `X-Join-Token: <64자 hex>`

**Request**:
```json
{
  "selected_industry": "제조·기계",
  "selected_sub": "반도체·전자"
}
```

**Response 200**:
```json
{ "ok": true }
```

**서버 처리 순서 (atomic)**:
1. participant 조회 → 없으면 404
2. X-Join-Token 검증 → 없으면 401, 불일치 → 403
3. 연결된 session.status 확인 → 'closed' → 410
4. participant.industry_confirmed = true 확인 → 이미 확정 → 409
5. taxonomy 유효성 검증 → invalid → 400
6. `selected_industry`, `selected_sub`, `industry_confirmed = true` 원자적 UPDATE (단일 SQL)

**Error**:
| status | body.error | 조건 |
|--------|-----------|------|
| 401 | `join_token_required` | X-Join-Token 헤더 없음 |
| 403 | `join_token_invalid` | participant.join_token ≠ 헤더 값 |
| 410 | `session_closed` | session.status = 'closed' |
| 409 | `industry_already_confirmed` | industry_confirmed = true (이미 면접 시작됨) |
| 400 | `invalid_industry` | taxonomy에 없는 값 |
| 404 | `participant_not_found` | |

---

### GET `/api/config`
공개 엔드포인트. 인증 불요. 클라이언트 app init 시 호출해 VITE_ 컴파일 값과 교차 검증.

**Response 200** (§5·§8·AC-11 단일 스키마):
```json
{
  "supabaseRef": "<ref>"
}
```
- `supabaseRef`: 서버 `SUPABASE_URL`에서 파싱한 Supabase 프로젝트 ref (예: `jblkbztpbwqidfvmmoey`)
- 비밀(service_role key, anon key) 노출 금지. ref만 반환.

**클라이언트 검증 흐름**:
1. App init 시 `GET /api/config` fetch
2. `VITE_SUPABASE_URL` 파싱 ref ≠ `supabaseRef` → `console.error("server_client_supabase_ref_mismatch")` + UI 경보 배너 + Supabase 초기화 중단
3. 스테일 빌드(서버 ref 변경 후 클라이언트 미재빌드) 자동 감지

**Sprint Contract 추가**:
```bash
# /api/config 라우트 등록
grep -rn "'/api/config'\|api/config" server/src/routes/ | wc -l
# expected: >= 1

# 클라이언트 교차 검증 함수
grep -rn 'api/config\|server_client_supabase_ref_mismatch' client/src/ | wc -l
# expected: >= 1
```

---

### GET `/api/industries`
인증 불요. 서버 메모리에서 taxonomy JSON 반환.

**Response 200**:
```json
{
  "taxonomy": [
    {
      "majorCategory": "제조·기계",
      "subCategories": [
        {
          "name": "반도체·전자",
          "keyCompetencies": [...],
          "interviewStyle": "혼합 (인성 + 간단 실기/상식)"
        }
      ]
    }
  ]
}
```

> 응답은 taxonomy 전체 필드 아닌 UI 필요 필드(majorCategory, subCategories.name, keyCompetencies, interviewStyle)만 포함.

---

## §6 UX 흐름

```
[랜딩 /]
  ├─ CTA "세션 참여하기" ──────────────→ [참여 /join]
  │                                         ├─ 6자리 코드 입력
  │                                         ├─ 이름 입력
  │                                         └─ "참여" 버튼 → POST /api/sessions/:code/join
  │                                              ├─ 404/410 → 에러 인라인 표시 (모달 X)
  │                                              └─ 200 → [직종 선택 /session/:code/industry]
  │                                                           ├─ 8대 직종 카드 그리드
  │                                                           ├─ 카드 클릭 → 18소 드릴다운
  │                                                           └─ "면접 시작" 버튼
  │                                                                → PATCH /api/participants/:id/industry
  │                                                                → (PR2) 면접 라우트
  │
  ├─ CTA "데모 면접 해보기" ───────────→ [데모 /demo]
  │                                         ├─ 직종 선택 (세션 없이)
  │                                         └─ "면접 시작" 버튼 → (PR2) 데모 면접 라우트 stub
  │
  └─ 헤더 "교사 로그인" ────────────────→ [카카오 로그인 /auth/kakao]
                                              └─ callback → [교사 세션 /teacher/sessions]
                                                               ├─ "새 세션 만들기" 버튼
                                                               │    → POST /api/sessions
                                                               │    → 세션 코드 모달(6자리 + QR stub)
                                                               └─ 기존 세션 목록 (stub)
```

**에러 표시 정책**: 인라인 텍스트 (`text-red-600` 디자인 토큰), 토스트·모달 금지.
**뒤로가기 가드**: `/session/:code/industry` 이탈 시 `useExitGuard` (popstate + beforeunload 양쪽) 적용. (DESIGN-POLICY §9.H-18 준수)

---

## §6.5 Acceptance Criteria (Given-When-Then)

### AC-1: 서버 부팅 가드 — Supabase split 방지
- **Given** SUPABASE_URL ref와 SUPABASE_AUTH_URL ref가 다른 Supabase 프로젝트를 가리킬 때,
- **When** 서버를 기동하면,
- **Then** 부팅 단계에서 즉시 throw("supabase_project_mismatch")하고 서빙이 시작되지 않는다.

### AC-2: 서버 부팅 가드 — criteria weight 합=100
- **Given** evaluation-criteria.json의 weight 합이 100이 아닐 때,
- **When** 서버를 기동하면,
- **Then** throw("criteria_weight_sum_invalid: got X, expected 100")하고 서빙이 시작되지 않는다.

### AC-3: 학생 세션 참여 — 정상 경로
- **Given** 교사가 생성한 세션 코드 "A3K9PL"이 존재하고 status=active일 때,
- **When** 학생이 /join에서 코드 "A3K9PL"과 이름 "홍길동"을 입력하고 참여 버튼을 누르면,
- **Then** /session/A3K9PL/industry 화면으로 이동하고, 8대 직종 카드가 표시된다.

### AC-4: 학생 세션 참여 — 잘못된 코드
- **Given** 존재하지 않는 코드 "XXXXXX"를 입력했을 때,
- **When** 참여 버튼을 누르면,
- **Then** "세션을 찾을 수 없습니다" 에러 메시지가 입력 필드 하단에 표시되고 화면 이동 없음.

### AC-5: 학생 세션 참여 — 종료된 세션
- **Given** status=closed 세션 코드를 입력했을 때,
- **When** 참여 버튼을 누르면,
- **Then** "이미 종료된 세션입니다" 메시지 표시. 화면 이동 없음.

### AC-6: 직종 선택 — 8대→18소 드릴다운
- **Given** 학생이 /session/:code/industry에 있을 때,
- **When** "제조·기계" 카드를 클릭하면,
- **Then** 소직종 목록("반도체·전자", "자동차·기계금속", "화학·식품·섬유")이 표시된다.

### AC-7: 직종 선택 — 저장 (정상)
- **Given** 학생이 POST /join으로 입장해 받은 `joinToken`이 localStorage(`interview_join_token_{participantId}`)에 있고, 소직종 "반도체·전자"를 선택했을 때,
- **When** "면접 시작" 버튼을 누르면,
- **Then** `X-Join-Token: <joinToken>` 헤더를 포함한 PATCH 요청이 성공(200)하고, (PR2 stub) "준비 중입니다" 안내 화면이 표시된다.

### AC-7b: 직종 선택 — joinToken 없을 때 401
- **Given** X-Join-Token 헤더 없이 PATCH /api/participants/:id/industry를 호출하면,
- **When** 서버가 요청을 처리할 때,
- **Then** `401 join_token_required` 응답이 반환되고 selected_industry/selected_sub이 변경되지 않는다.

### AC-7c: 직종 선택 — 다른 참가자 토큰으로 403
- **Given** 다른 참가자의 ID와 그 참가자가 아닌 joinToken을 조합해 PATCH를 호출하면,
- **When** 서버가 요청을 처리할 때,
- **Then** `403 join_token_invalid` 응답이 반환되고 해당 참가자의 선택이 변경되지 않는다.

### AC-7d: 직종 선택 — 종료된 세션 410
- **Given** 교사가 세션을 closed로 변경한 후 학생이 유효한 joinToken으로 PATCH를 시도하면,
- **When** 서버가 요청을 처리할 때,
- **Then** `410 session_closed` 응답이 반환되고 selected_industry/selected_sub이 변경되지 않는다.

### AC-7e: 직종 선택 — 이미 확정된 경우 409
- **Given** 학생이 이미 직종을 선택해 industry_confirmed=true 상태에서 다시 PATCH를 시도하면,
- **When** 서버가 요청을 처리할 때,
- **Then** `409 industry_already_confirmed` 응답이 반환되고 기존 선택이 변경되지 않는다.

### AC-12: joinToken 소실 → /join 재유도
- **Given** 학생이 `/session/:code/industry`를 직접 열었을 때 `localStorage`에 joinToken이 없으면,
- **When** 페이지가 로드되면,
- **Then** `/join?code=:code`로 자동 리다이렉트되어 학생이 이름을 다시 입력해 새로 입장한다.

### AC-13: joinToken 소실 + 세션 종료
- **Given** localStorage에 joinToken이 없고 세션 status=closed일 때 `/session/:code/industry`를 열면,
- **When** 페이지가 로드되면,
- **Then** "이 세션은 이미 종료됐습니다" 인라인 메시지가 표시되고, /join 리다이렉트는 일어나지 않는다.

### AC-14: PATCH 에러 — 클라이언트 인라인 표시
- **Given** PATCH /api/participants/:id/industry가 서버 에러를 반환할 때,
- **When** 각 에러 코드별로:
  - 401(join_token_required): "인증 정보가 없습니다. 다시 입장해주세요."
  - 403(join_token_invalid): "입장 정보가 올바르지 않습니다. 다시 입장해주세요."
  - 410(session_closed): "세션이 종료되어 직종을 선택할 수 없습니다."
  - 409(industry_already_confirmed): "이미 직종을 선택하고 면접을 시작했습니다."
- **Then** 해당 메시지가 "면접 시작" 버튼 하단에 `text-red-600` 인라인으로 표시된다. 모달·토스트 금지.

### AC-15: 모바일 반응형 — 직종 선택 화면
- **Given** 모바일(375px) 기기에서 `/session/:code/industry`를 열면,
- **When** 8대 직종 카드 그리드가 표시될 때,
- **Then** 카드가 1~2열로 렌더링되어 가로 스크롤 없이 볼 수 있고, "면접 시작" 버튼이 화면 하단에 눌리기 충분한 크기로 표시된다.

### AC-8: 직종 선택 — 이탈 방지
- **Given** 학생이 직종 선택 화면에 있을 때,
- **When** 브라우저 뒤로가기를 시도하면,
- **Then** "직종 선택을 취소하시겠습니까?" 확인 다이얼로그가 뜨고, 취소 클릭 시 이탈이 차단된다.

### AC-9: 교사 세션 생성
- **Given** 교사가 로그인한 상태에서 /teacher/sessions에 있을 때,
- **When** 제목 "3-2반 모의면접"을 입력하고 "새 세션 만들기"를 누르면,
- **Then** 6자리 코드(예: "A3K9PL")가 화면에 크게 표시되고, "복사" 버튼이 있다.

### AC-11: 클라이언트 서버 Supabase ref 일치 확인
- **Given** 앱이 로드될 때,
- **When** `/api/config` 응답의 `supabaseRef`가 VITE_SUPABASE_URL에서 파싱한 ref와 일치하면,
- **Then** 정상 초기화된다. 불일치 시 빨간 경보 배너("서버 설정 불일치 — 관리자에게 문의")가 표시되고 면접 기능을 차단한다.

### AC-10: STT 피처 플래그 OFF — 음성 UI 미노출
- **Given** VITE_FEATURE_STT=false (기본값)일 때,
- **When** 면접 관련 어느 화면을 열어도,
- **Then** 마이크 아이콘이나 음성 입력 UI가 전혀 표시되지 않는다.

---

## §7 구현 노트 의무

본 SDD 기반 PR은 IMPLEMENTATION-NOTES-POLICY 적용 대상.
Generator는 `docs/implementation-notes/PR-pending-interview-pr1.md`에
Decisions / Changes / Tradeoffs / Notes 4 섹션을 STEP마다 누적 갱신.

---

## §8 부팅 가드 상세 (`server/src/lib/bootGuards.ts`)

### 서버 4-ref 일치 가드 (`assertSameSupabaseProject`)

```typescript
// 검증 대상 — 모두 서버 env (VITE_ 없음, 서버에서 VITE_ 접근 불가):
//   1. SUPABASE_URL             → parse URL → ref 추출 (https://<ref>.supabase.co)
//   2. SUPABASE_AUTH_URL        → parse URL → ref 추출 (없으면 SUPABASE_URL ref와 동일로 간주)
//   3. SUPABASE_SERVICE_ROLE_KEY → JWT iss claim → ref 추출
//   4. SUPABASE_ANON_KEY        → JWT iss claim → ref 추출
// 4개 ref 불일치 시: throw new Error('supabase_project_mismatch: urls=[url_ref], keys=[key_ref]')
//
// ⚠️ VITE_SUPABASE_ANON_KEY 는 클라이언트 번들 전용 — 서버 process.env 에 없음.
//    서버는 SUPABASE_ANON_KEY(non-VITE) 를 별도로 필요로 함. .env.example 에 모두 명시.
```

### 클라이언트 ref 자가 검증 (`client/src/lib/supabase.ts`)

```typescript
// VITE_ 변수 2개는 클라이언트에서 직접 접근 가능.
// app init 시 assertClientSupabaseConsistency() 실행:
//   1. VITE_SUPABASE_URL 에서 ref 추출: URL.hostname 첫 번째 서브도메인
//   2. VITE_SUPABASE_ANON_KEY JWT iss claim 에서 ref 추출
//   3. 두 ref 불일치 시 console.error("client_supabase_ref_mismatch") + Sentry 경보
//      (throw 금지 — 클라이언트는 서버 부팅 차단보다 에러 가시성이 목표)
//
// 서버와 클라이언트 ref 가 같은지(교차 검증)는 public 엔드포인트 `/api/config` 로 확인:
//   GET /api/config → { supabaseRef: string }
//   클라이언트 app init 시 fetch → VITE_SUPABASE_URL ref 와 비교
//   불일치 시 console.error("server_client_supabase_ref_mismatch") + UI 경보 배너
```

### `/api/config` 공개 엔드포인트 (신규 라우트)

```
GET /api/config → 인증 불요
Response: { "supabaseRef": "<ref>" }   ← §5·§8·AC-11 단일 스키마. 비밀 노출 없음.
- supabaseRef = SUPABASE_URL 파싱 ref (서버측)
- 클라이언트가 app init 시 호출해 VITE_SUPABASE_URL ref 와 비교
```

Sprint Contract 추가 (§3 append):
```bash
# 13. /api/config 엔드포인트 존재
grep -rn "'/api/config'" server/src/ | wc -l
# expected: >= 1

# 14. 클라이언트 ref 검증 함수
grep -rn 'assertClientSupabaseConsistency\|server_client_supabase_ref_mismatch' client/src/ | wc -l
# expected: >= 1

# 15. joinToken localStorage 저장 패턴
grep -rn 'interview_join_token_\|localStorage' client/src/ | wc -l
# expected: >= 1

# 16. 모바일 반응형 그리드
grep -rn 'grid-cols-1\|sm:grid-cols\|md:grid-cols' client/src/ | wc -l
# expected: >= 1
```

### 기타 부팅 가드

```typescript
// validateCriteriaWeights: evaluation-criteria.json 로드 → weight 합=100
// computeCriteriaHash: SHA-256(전체 JSON 문자열) → hex 64자
// computeQuestionsBankHash: SHA-256(questions-by-industry.json) → hex 64자
//   → PR1에서는 startup log 출력만. DB 저장은 PR2(interview_attempts DDL).

// NullSttProvider: SttProvider 인터페이스 구현체 (no-op)
// interface SttProvider { transcribe(audioBuffer: Buffer): Promise<string> }
// class NullSttProvider implements SttProvider {
//   transcribe(_: Buffer): Promise<string> { return Promise.resolve('') }
// }

// 모두 server/src/index.ts 에서 순서대로 호출:
// await assertSameSupabaseProject()
// await validateCriteriaWeights()
// const criteriaHash = await computeCriteriaHash()     // startup log에만 출력
// const qBankHash = await computeQuestionsBankHash()   // startup log에만 출력
// const sttProvider = new NullSttProvider()
```

---

## §9 Out of Scope (PR1에서 안 하는 것)

- 면접 질문·꼬리질문·STAR 코칭 — PR2
- 평가 리포트·attempt 집계 — PR3
- STT 실제 구현 — PR4 (jery 승인 후)
- 교사 대시보드 학급 현황 — PR5
- `interview_attempts` 테이블 생성 — PR2 SDD에서 아래 DDL 계약 완전 명세 의무:

```sql
-- PR2 SDD 의무 포함 DDL (미리 확정, 여기서 빠지면 PR2 codex REVISE)
CREATE TABLE interview_attempts (
  id                    uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_id        uuid        NOT NULL REFERENCES interview_participants(id) ON DELETE CASCADE,
  session_id            uuid        NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  -- 불변 스냅샷 (ADR-5)
  -- 질문 ID = 'MFG-001' 형태 (^[A-Z]{2,4}-[0-9]{3}$). uuid 아님. §CONTRACT SUMMARY 참조.
  assigned_question_ids text[]      NOT NULL DEFAULT '{}',
  submitted_answers     text[]      NOT NULL DEFAULT '{}',
  per_criterion_scores  jsonb       NOT NULL DEFAULT '{}',
  weakness_tags         text[]      NOT NULL DEFAULT '{}',
  -- 기준 해시 (ADR-6)
  criteria_hash         char(64)    NOT NULL CHECK (criteria_hash ~ '^[a-f0-9]{64}$'),
  questions_bank_hash   char(64)    NOT NULL CHECK (questions_bank_hash ~ '^[a-f0-9]{64}$'),
  model_version         text        NOT NULL,
  -- 시간
  started_at            timestamptz NOT NULL DEFAULT now(),
  completed_at          timestamptz,           -- NULL = 진행 중
  -- 리포트 멱등성
  CONSTRAINT uq_attempt_report UNIQUE (id)     -- 동일 attempt_id 재요청 시 기존 반환
);
ALTER TABLE interview_attempts ENABLE ROW LEVEL SECURITY;
-- 대시보드 집계: WHERE criteria_hash = $1 (같은 버전끼리만 평균)
CREATE INDEX idx_interview_attempts_session     ON interview_attempts(session_id);
CREATE INDEX idx_interview_attempts_criteria    ON interview_attempts(criteria_hash);
```

> **PR2 SDD gate**: 위 DDL이 그대로 포함돼 있지 않으면 codex REVISE.
- criteria_hash·questions_bank_hash를 DB에 저장 — PR2 (PR1 부팅 시 로그만)
- GitHub repo 생성·DNS·Render 배포 — 새 세션 master 액션
- 데모 면접 실제 질문 흐름 — PR2
- QR코드 실제 생성 — stub (`[QR]` placeholder)

## §10 PR 순서 및 base 정책

모든 PR은 `master` base의 독립 브랜치. Stacked PR(PR2→PR1 base 등) 금지.

| PR | branch | base 분기 시점 | 시작 블로킹 조건 | 비고 |
|----|--------|--------------|----------------|------|
| PR1 | `feat/interview-pr1` | 현재 master (`9802436`) | 없음 | 이 SDD 대상 |
| PR2 | `feat/interview-pr2` | **PR1이 master에 머지된 후 `git checkout -b feat/interview-pr2 origin/master`** | PR1 머지 + 형태소 전략 결정(ADR-4) | Gemini 첫 호출 |
| PR3 | `feat/interview-pr3` | **PR1+PR2 머지 후 origin/master** | PR2 머지 + attempt DDL 확인 | 리포트 |
| PR4 | `feat/interview-pr4` | PR1 머지 후 origin/master | jery STT provider 승인 | 음성 |
| PR5 | `feat/interview-pr5` | **PR1+PR2+PR3 머지 후 origin/master** | PR1~3 머지 | 교사 대시보드 |

**규칙**: 각 PR은 이전 PR이 master에 **완전히 머지된 이후** `origin/master` 최신 HEAD를 base로 분기한다. Stacked PR(미머지 PR을 base로 삼는 구조) 금지. 동시 병렬 worktree도 같은 dir 공유 충돌 방지를 위해 금지.

**형태소 결정 게이트 (PR2 블로킹)**:
PR2 작업 시작 전 `hangul-js` vs `natural` 경량 옵션 평가 결과를 SDD에 명시. 미결 상태로 PR2 코드 착수 금지 (ADR-4).
