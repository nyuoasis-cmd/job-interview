# HANDOFF — job-interview PR1 round1
> 특성화고 AI 면접 코칭 | 스캐폴드 + 랜딩 + 세션참여 + 직종선택 + 부팅가드

---

## §0 메타

| 항목 | 값 |
|------|-----|
| branch | `feat/interview-pr1` |
| base | `master` (dab107f — SDD + 증거 커밋 포함) |
| **generator model override** | **codex** |
| **eval-visual model override** | **claude-sonnet-4-6** |
| **eval-interaction model override** | **codex** |

본 PR은 IMPLEMENTATION-NOTES-POLICY 적용 대상.
Generator는 `docs/implementation-notes/PR-pending-interview-pr1.md`에
Decisions / Changes / Tradeoffs / Notes 4섹션을 STEP마다 누적 갱신.

**SDD**: `docs/SDD-interview-pr1-v1.md`
**증거**:
- `qa/blueprint-evidence/interview-pr1.sdd.codex.md` — codex R10 APPROVED
- `qa/blueprint-evidence/interview-pr1.preflight.md` — preflight PASS (FAIL 0)

---

## §A Generator (Codex)

### 목표
job-interview 서비스 PR1 전체를 구현한다. 기존 코드 0 (그린필드). `data-class/`를 참조 스캐폴드로 사용한다.

### 참조 파일 (복사 기준)
- `data-class/client/src/lib/supabase.ts` → cookieStorage + `sb-auth-token` + `.teachermate.co.kr` 패턴 그대로 복사
- `data-class/server/src/lib/sessionCode.ts` → `generateUniqueCode()` 그대로 복사
- `data-class/server/src/middleware/auth.ts` → `verifySupabaseJwt()` 그대로 복사
- `data-class/server/src/db.ts` → `supabaseAdmin`, `createUserScopedClient()` 패턴 복사 후 `assertSameSupabaseProject()` 추가

### 신규 생성 파일 전체 목록 (SDD §3)

```
job-interview/
├── package.json                          # workspace root
├── .env.example
├── supabase/migrations/
│   └── 0001_interview_tables.sql         # §4 DDL (인덱스 3개 포함 필수)
├── client/
│   ├── package.json                      # typescript: "~5.9.3", @tailwindcss/vite 포함
│   ├── tsconfig.json                     # baseUrl 줄 없음 (TS5101 방지)
│   ├── vite.config.ts
│   ├── index.html
│   └── src/
│       ├── main.tsx
│       ├── App.tsx                       # React Router 설정
│       ├── index.css                     # Tailwind v4 @import
│       ├── lib/supabase.ts               # cookieStorage 패턴
│       ├── types/index.ts
│       └── pages/
│           ├── LandingPage.tsx           # 히어로 + CTA 2개
│           ├── JoinPage.tsx              # 6자리코드 + 이름 입력
│           ├── IndustrySelectPage.tsx    # 8대→18소 드릴다운
│           ├── TeacherSessionPage.tsx    # 세션 생성 + 코드 표시
│           ├── DemoPage.tsx              # 직종 선택 stub
│           ├── DevLoginPage.tsx
│           └── AuthCallback.tsx
└── server/
    ├── package.json                      # typescript: "^6.0.2"
    ├── tsconfig.json
    └── src/
        ├── index.ts                      # Express5 + boot guards
        ├── db.ts                         # supabaseAdmin + assertSameSupabaseProject
        ├── lib/
        │   ├── sessionCode.ts
        │   └── bootGuards.ts
        ├── middleware/auth.ts
        ├── routes/
        │   ├── index.ts
        │   ├── sessions.ts
        │   ├── participants.ts
        │   ├── industries.ts
        │   └── config.ts                 # GET /api/config
        └── types/index.ts
```

### 핵심 구현 계약 (SDD §CONTRACT SUMMARY)

| 계약 | 값 |
|------|-----|
| `/api/config` 응답 | `{ "supabaseRef": string }` — 비밀 없음, ref만 |
| `interview_participants.join_token` | `char(64) NOT NULL CHECK hex` — crypto.randomBytes(32).toString('hex') |
| POST /join 응답 | `{ participant: {...}, joinToken: "<64자 hex>" }` — 1회만 반환 |
| joinToken 클라이언트 저장 | `localStorage`, 키: `interview_join_token_{participantId}` |
| PATCH /industry 소유권 | `X-Join-Token` 헤더 → DB 비교 → 불일치 403 |
| PATCH 처리 순서 | participant→401/403→session closed 410→already_confirmed 409→taxonomy 400→atomic UPDATE |
| `interview_attempts.assigned_question_ids` | `text[] NOT NULL DEFAULT '{}'` (ID 형태: `MFG-001`) |
| 부팅 가드 순서 | assertSameSupabaseProject → validateCriteriaWeights → computeCriteriaHash → computeQuestionsBankHash → NullSttProvider |

### Sprint Contract — 검증 기준 (Eval-Interaction이 grep으로 측정)

```bash
# 1. 부팅 가드
grep -rn 'assertSameSupabaseProject' server/src/ | wc -l  # >= 2
grep -rn 'validateCriteriaWeights' server/src/ | wc -l   # >= 2
grep -rn 'computeCriteriaHash\|computeQuestionsBankHash' server/src/ | wc -l  # >= 2
grep -rn 'NullSttProvider' server/src/ | wc -l           # >= 1
grep -rn 'VITE_FEATURE_STT' client/src/ | wc -l          # >= 1

# 2. DB code 정규식
grep -rn "A-Z0-9" supabase/migrations/0001_interview_tables.sql | wc -l  # >= 1
grep -c 'ENABLE ROW LEVEL SECURITY' supabase/migrations/0001_interview_tables.sql  # >= 2
grep -c 'CREATE INDEX' supabase/migrations/0001_interview_tables.sql  # >= 3

# 3. 쿠키·인증
grep -rn 'sb-auth-token' client/src/ | wc -l              # >= 1
grep -rn 'teachermate.co.kr' client/src/lib/supabase.ts | wc -l  # >= 1

# 4. joinToken localStorage
grep -rn 'interview_join_token_\|localStorage' client/src/ | wc -l  # >= 1

# 5. X-Join-Token 검증
grep -rn 'X-Join-Token\|join_token_required\|join_token_invalid' server/src/ | wc -l  # >= 3

# 6. PATCH atomic — session_closed 410 + already_confirmed 409
grep -rn 'session_closed\|already_confirmed' server/src/ | wc -l  # >= 2

# 7. /api/config 라우트
grep -rn "'/api/config'\|api/config" server/src/routes/ | wc -l  # >= 1

# 8. 클라이언트 ref 검증
grep -rn 'server_client_supabase_ref_mismatch\|api/config' client/src/ | wc -l  # >= 1

# 9. 모바일 반응형
grep -rn 'grid-cols-1\|sm:grid-cols\|md:grid-cols' client/src/ | wc -l  # >= 1

# 10. 직종 선택 이탈 방지
grep -rn 'useExitGuard\|popstate\|beforeunload' client/src/ | wc -l  # >= 1
```

### Out of Scope (PR1에서 절대 구현하지 않는 것)

- Gemini API 호출, 면접 질문, STAR 코칭 (PR2)
- `interview_attempts` 테이블 생성 (PR2)
- 평가 리포트 (PR3)
- STT 실제 구현 (PR4)
- 교사 대시보드 학급 현황 (PR5)
- GitHub repo 생성·DNS·Render 배포

### 절대 규약

- 작업 branch = `feat/interview-pr1`. 별도 브랜치 생성 금지. PR 생성 금지.
- `tsconfig.json`에 `"baseUrl"` 줄 없음 (TS5101 Render 빌드 중단 방지)
- 서버 코드에서 `VITE_` 환경변수 직접 접근 금지 (VITE_는 클라이언트 전용)
- Tailwind v4: `tailwind.config.ts` 생성 금지, CSS-first 방식 (`@import "tailwindcss"`)

센티넬 경로(절대): `/home/claude/job-interview/qa/ao-logs/interview-pr1-r1-generator.status`

---

## §B Eval-Visual (claude-sonnet-4-6)

### 검증 목표
SDD 입력 목업 2종과 실 구현 비교:
- `shared/mockups/vocational-job-prep-ai-interview-mockup-v2.html` — 기능·공신력 권위본
- `shared/mockups/vocational-job-prep-ai-interview-mockup-v3-responsive.html` — 반응형 UI 권위본

### 시각 검증 기준

| 화면 | 검증 항목 |
|------|----------|
| 랜딩 (/) | 히어로 타이틀, CTA 2개 버튼 표시, 모바일/PC 레이아웃 |
| 참여 (/join) | 6자리 코드 입력 필드, 이름 입력, 에러 인라인 표시 위치 |
| 직종 선택 (/session/:code/industry) | 8대 직종 카드 그리드, 모바일 1~2열, 소직종 드릴다운 |
| 교사 세션 (/teacher/sessions) | 코드 표시 (큰 글씨), 복사 버튼 |

### 스크린샷 경로 (Puppeteer)
- `file://` 방식 사용 (서버 미기동 — `vite build` 후 dist 열기)
- 데스크탑(1280×800) + 모바일(375×812) 각 핵심 화면

센티넬 경로(절대): `/home/claude/job-interview/qa/ao-logs/interview-pr1-r1-eval-visual.status`

---

## §C Eval-Interaction (Codex)

### 검증 목표
Sprint Contract grep 기준 전체 + 기능 계약 검증

### 검증 항목

1. **Sprint Contract 10개 항목** 전부 grep → 수치 측정 → SDD 기준 충족 여부
2. **부팅 가드 함수 시그니처**: `assertSameSupabaseProject()`, `validateCriteriaWeights()` 구현 존재 및 서버 index.ts에서 호출 여부
3. **PATCH /industry atomic update**: 단일 UPDATE SQL (joined → active session → token match → confirmed check → taxonomy → UPDATE) 순서 준수
4. **TypeScript 컴파일**: `cd client && tsc --noEmit && cd ../server && tsc --noEmit` → EXIT=0
5. **빌드**: `cd client && npm run build` → EXIT=0
6. **joinToken 소실 시나리오**: IndustrySelectPage.tsx에서 localStorage 미존재 시 /join 리다이렉트 코드 존재

### 절대 규약

- 작업 branch = `feat/interview-pr1`. 절대로 다른 branch 사용 금지.

센티넬 경로(절대): `/home/claude/job-interview/qa/ao-logs/interview-pr1-r1-eval-interaction.status`
