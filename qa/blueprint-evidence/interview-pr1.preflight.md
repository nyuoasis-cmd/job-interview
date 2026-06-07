# Preflight 증거 — job-interview PR1
> 실행 날짜: 2026-06-07 | slug: interview-pr1

## 종합 판정: ✅ PASS (FAIL 0 / WARN 3)

| Area | 결과 |
|------|------|
| 1. API 실현성 | ✅ PASS |
| 2. 패키지 호환성 | ✅ PASS (WARN 1) |
| 3. DB/타입 정합성 | ✅ PASS (WARN 1) |
| 4. UX 흐름 | ✅ PASS (WARN 해소 / FAIL→PASS) |

---

## Area 1: API 실현성

- ✅ @google/genai 2.8.0 — Gemini 2.5 Flash 지원 (data-class 동일 버전 운영 중)
- ✅ Supabase jblkb REST API 생존 — GET /rest/v1/dc_sessions HTTP 200 실확인
- ✅ Express 5.2.1 정식 안정판
- ⏭ 신규 라우트 5종 — 구현 후 sprint contract grep으로 측정

## Area 2: 패키지 호환성

- ✅ React19(19.2.7) + Vite8(8.0.16) + Tailwind v4(4.3.0) — data-class 동일 조합 실증
- ✅ Express5 async route handler 자동 전파 — data-class 7개 handler 검증
- ✅ @supabase/supabase-js(2.107.0) + js-cookie + zod + @google/genai 모두 호환
- ✅ Node crypto.randomBytes(32) 정상 (Node v24)
- ⚠️ TS 버전: client `~5.9.3` / server `^6.0.2` 분리 권장 (baseUrl 제거 필수, TS5101 Render 빌드 중단 패턴)

## Area 3: DB/타입 정합성

- ✅ interview_sessions / interview_participants 중복 없음 (jblkb 실 쿼리 확인)
- ✅ char(6) CHECK `^[A-Z0-9]{6}$` — data-class dc_sessions.code 동일 패턴 선행 운영
- ✅ join_token char(64) hex CHECK — dry-run 거부 정상 (비-hex 문자 위반 확인)
- ✅ auth.users FK — jblkb auth.users 실 확인 (id 컬럼 uuid)
- ✅ SQL 전체 dry-run EXIT=0 (BEGIN→CREATE×2→ALTER×2→INSERT×2→ROLLBACK)
- ⚠️ 인덱스 3개 (sessions.code, sessions.teacher_id, participants.session_id) — 실 migration 파일에 포함 필요

## Area 4: UX 흐름

- ✅ §9.H-18 뒤로가기: popstate + beforeunload 양쪽 정의 (AC-8)
- ✅ joinToken 소실 시나리오: localStorage + AC-12(리다이렉트) + AC-13(closed 안내) — FAIL→PASS
- ✅ PATCH 에러 6종 클라이언트 표시 문구 정의 (AC-14: 401/403/410/409 문구)
- ✅ 모바일 반응형 AC-15 + sprint contract #16
- ⚠️ PATCH 성공 후 뒤로가기 → industry_confirmed 상태 화면 (AC 있음, 구현 판단 위임)

---

## WARN 수정안

### ⚠️ TS 버전 분리 (Area 2)
generator가 client/package.json에 `"typescript": "~5.9.3"` 고정, server/package.json에 `"typescript": "^6.0.2"` 설정. `tsconfig.json`에서 `"baseUrl"` 줄 제거 필수.

### ⚠️ 인덱스 3개 (Area 3)
`supabase/migrations/0001_interview_tables.sql` 끝에 아래 3줄 포함:
```sql
CREATE INDEX idx_interview_sessions_code       ON interview_sessions(code);
CREATE INDEX idx_interview_sessions_teacher_id ON interview_sessions(teacher_id);
CREATE INDEX idx_interview_participants_session ON interview_participants(session_id);
```
