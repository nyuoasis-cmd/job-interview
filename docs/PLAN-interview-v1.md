# Plan — job-interview (특성화고 AI 면접 코칭)

> 서브도메인 후보: `interview.teachermate.co.kr` · repo: `nyuoasis-cmd/job-interview`
> 입력 목업: `shared/mockups/vocational-job-prep-ai-interview-mockup-v2.html`(기능·공신력 권위본) + `...v3-responsive.html`(반응형 UI 권위본)
> 데이터: `shared/data/ai-interview/` 5종 (questions 176 / taxonomy 8대18소 / followup 34 / star 24 / evaluation 8기준)

## 목적
특성화고 학생이 세션 코드로 입장 → 직종(8대·18소)별 모의 면접(질문·꼬리질문) → STAR 코칭 → 평가 리포트를 무료로 연습하고, 교사가 학급 취업면접 준비 현황을 대시보드로 모니터링한다.
시장 완전 공백(특성화고 직종특화 AI 면접 · 교사 연동 대시보드)을 TeacherMate 세션 강점으로 채운다.

## 현재 상태 (실측)
- 신규 그린필드. `/home/claude/job-interview` 로컬 repo init 완료(base `9802436`). GitHub repo·배포 미생성.
- 데이터 5종 완비:
  - `questions-by-industry.json` — 176문항, id `MFG-001`, industry/category(지원동기|직무역량|성격|상황|꼬리)/difficulty(초급|중급|심화)
  - `industry-taxonomy.json` — 8대18소 분류, commonJobTitles/interviewStyle/keyCompetencies/relatedCertifications/schoolDepartments
  - `followup-patterns.json` — 34개, triggerKeyword/followupQuestion/intent(심화14·검증11·약점9)/suggestedResponse
  - `star-examples.json` — 24개, industry/question/star(STAR 4분해)/level(우수|보통|미흡)/feedback
  - `evaluation-criteria.json` — 8기준, criterion/weight(합=100)/goodExample/badExample/tips
- 참조 스캐폴드(실측): `data-class/` — client(React Router + cookieStorage anon) + server(Express + service_role + lib/sessionCode.ts 6자코드 `[A-Z0-9]{6}` I/O/1 제외)

## 아키텍처 결정 (ADR)

### ADR-1: AI 모델 = Gemini 2.5 Flash + 3.1 Flash Lite 폴백, Anthropic 회피
- **Context**: 꼬리질문 판단·STAR 피드백·리포트 생성에 LLM 필요. jery 방침=Anthropic 회피([[reference_gemini-api-rate-limits-tier1]]: 2.5 Flash RPM1,000/RPD10,000).
- **Decision**: **Gemini 2.5 Flash** 기본, 한도 혼잡 시 **3.1 Flash Lite**(RPM4,000) 폴백. 2.5 Pro(RPM150) = 단체수업 부적합 → 제외.
- **Alternatives**: Claude Haiku — 거부(jery 방침). 2.5 Pro — 거부(한도).
- **Consequences**: (+)한도 넉넉·비용 낮음 (−)Gemini 한국어 STAR 피드백 품질 = 정적 데이터(star-examples 24개·criteria 8개)로 프롬프트 그라운딩해 보완.

### ADR-2: DB = 공유 Supabase(jblkb) + `interview_*` 테이블, single-ref 부팅 가드
- **Decision**: 인증·데이터 모두 공유 jblkb. **단일 공유 config 계약**으로 강제:
  - **서버** 부팅 시 `assertSameSupabaseProject()` — `SUPABASE_URL`(data) ref · `SUPABASE_AUTH_URL`(auth) ref · service_role JWT ref · anon JWT ref **4개** 동일 검증, 불일치 시 throw.
  - **클라이언트** — `VITE_SUPABASE_URL` ref가 서버 data URL ref와 동일인지 빌드 시 또는 app init 시 검증. 쿠키 issuer/audience도 같은 ref.
  - **통합 테스트**: 의도적으로 split된 ref로 서버 기동 → throw 확인(서빙 전 실패 보장).
  - 이 가드 없이는 frontend가 다른 프로젝트에서 토큰을 발급받아도 서버가 모름([[portfolio-sso-auth-data-project-split]] 401 재발 패턴).
- **RLS 멀티테넌시**: RLS deny-all + 서버 service_role + 라우트별 `requireSessionOwner`(교사 세션 소유권 체크 의무).
- **DB code 정규식**: `char(6)` + `CHECK (code ~ '^[A-Z0-9]{6}$')` — API 거부와 불일치 차단.

### ADR-3: STT(발화분석) = 어댑터+NullProvider+플래그, jery 승인 게이트
- **Decision**: `SttProvider` 인터페이스 + **서버·클라 모두 `NullSttProvider`(no-op) 기본**. `VITE_FEATURE_STT=false` 기본.
  - STT 패키지/provider는 **플래그 활성화 분기 안에서만 lazy 로딩** — 플래그 OFF 시 import 자체 없음(빌드·부팅 분리).
  - **CI 보장**: STT env 변수 전무 상태에서 서버 부팅·빌드·PR1~3 텍스트 면접 라우트 전부 통과하는 테스트.
  - 음성 UI 컴포넌트는 플래그 OFF 시 렌더 안 함(조건부 import). route 등록도 플래그 뒤.
- 실제 provider 선택 = jery 승인 후(Web Speech / 서버STT / Gemini audio).
- **Consequences**: (+)텍스트 면접부터 출시 가능 (+)실수로 STT 패키지 끼어들어도 CI가 차단 (−)발화분석 UI는 PR4까지 보류.

### ADR-4: 꼬리질문 매칭 = 정규화 + 형태소 전처리 전략 명시
- **Context**: 단일 `triggerKeyword` 한국어 단순 매칭은 조사/어미/띄어쓰기 변형으로 불안정.
- **Decision**: triggerKeyword 배열(`variants[]`) 확장 + 서버에서 정규화(공백 압축·조사 스트리핑 기본 목록) 후 매칭. 매칭 우선순위: 정확 > 포함. 중복 dedup.
  - **형태소 라이브러리 — ✅ 결정 (2026-06-07, jery 승인): 외부 라이브러리 미채택.** 실측상 `hangul-js`(자모 분해/조합 유틸)·`natural`(영어용 NLP)은 **둘 다 한국어 형태소 분석기가 아님** → 택1 자체가 무효. 매칭은 **라이브러리 없이** `lib/textNormalize.ts`(NFC·공백 압축·소문자) + `triggerKeyword`+`variants[]`(데이터 변형배열) + 조사경계 휴리스틱(키워드 뒤 조사/공백/문장부호만 허용)으로 처리. 진짜 형태소 분석기(은전한닢 WASM·mecab-ko) 도입은 비용·Render 배포·번들 부담 대비 과함 → MVP 제외(자매 설계 `job-ai-interview-feature/PLAN`과 일치). no-match fallback=Gemini는 아래 항목대로 유지.
  - **no-match fallback**: 매칭 패턴 없으면 Gemini에 "이 답변에 적절한 꼬리질문 1개 생성" 위임(데이터 기반 우선, AI 보완).
  - **PR2 수용 기준(AC)**: 한국어 답변 픽스처 20개(조사변형·띄어쓰기·축약 포함) → 꼬리질문 매칭 recall ≥ 80%, false-positive ≤ 10%. 이 게이트 통과 전 PR2 APPROVED 없음.
- **Consequences**: (+)예측 가능한 데이터 기반 꼬리질문 (+)한국어 변형 커버 (+)게이트로 품질 보장 (+)외부 의존성 0·비용0·동시접속 무제한·결정적 (−)variants 데이터 관리 비용 (−)미등록 변형에 약함 → variants[] 보강 + no-match Gemini fallback으로 완화.

### ADR-5: 면접 시도(Attempt) 영속화 — 불변 스냅샷으로 집계 재현성 보장
- **Context**: answers/reports만 저장 → 기준 변경·재시도·재생성 시 대시보드 집계 조용히 변경.
- **Decision**: `interview_attempts`에 **불변 평가 사실 스냅샷** 함께 저장:
  - `assigned_question_ids[]`, `submitted_answers[]`(텍스트), `per_criterion_scores JSONB`, `weakness_tags[]`, `criteria_hash char(64)`(ADR-6), **`questions_bank_hash char(64)`**(부팅 시 `questions-by-industry.json` SHA-256 full digest — ID 재사용 상태에서 질문 내용 변경 시 hash 달라짐), `model_version`(예: `gemini-2.5-flash`), `completed_at`
  - 리포트 렌더/감사 경로는 `questions_bank_hash`로 식별된 정확한 스냅샷 기준으로 해석(현재 뱅크 기준 렌더 금지).
  - attempt당 canonical 완료 리포트 1개(idempotent — 동일 attempt_id로 재요청 시 기존 리포트 반환).
  - 대시보드 집계는 **같은 `criteria_version`끼리만** 평균(버전 혼재 시 명시적 경고).
- **Consequences**: (+)집계 재현 가능 (+)기준 변경 후에도 과거 데이터 오염 없음 (−)행 크기 증가(JSONB) (−)criteria_version 관리 필요.

### ADR-6: 평가 weight 합=100 런타임 가드 + 기준 컨텐츠 해시 (기계적 불변성)
- **Decision**: 서버 부팅 시 `evaluation-criteria.json` 로드 → weight 합=100 + 전항목 존재 검증. 실패 시 부팅 throw.
  - **컨텐츠 해시(SHA-256 전체 64자)** 를 부팅 시 계산. attempt 저장 시 `criteria_hash char(64)` 컬럼에 **full digest** 저장. UI 표시용으로만 앞 8자 축약 — DB 저장·집계·CI 비교는 반드시 full digest.
  - 버전 문자열(`"version": "v1.0"`)은 사람 가독 레이블 — 식별은 hash가 담당. 파일 내용이 바뀌면 hash가 달라지므로 수동 bump 실수 불가.
  - **CI 검증**: 커밋된 criteria 파일의 hash == 서버 코드에 hardcode된 expected_hash 비교. 불일치 시 CI 실패(배포 전 발견).
  - 대시보드 집계는 `criteria_hash`가 동일한 attempt끼리만 평균. 혼재 시 명시적 경고.

### ADR-7: 진입 = BUILDER-UX-POLICY §3 + Ghost CTA 폐지
- **Decision**: 학생 = 교사 세션의 6자리 코드+이름으로 참여. **"혼자 만들어볼게요 →" 류 Ghost CTA 신규 금지**. 공개 모의면접(데모) = 별도 `/demo` 라우트(세션 불요).
- **Consequences**: (+)교사 수업연동 강제 (+)공개 유입 데모로 SEO.

### ADR-8: 공신력 = 코드 강제
- **Decision**: 질문·평가 인용은 typed `source` 필드만. Gemini 산출 post-check: 합격률 수치·미확보 인증/제휴 토큰 검출 시 제거 또는 "참고용" 처리. zod로 데이터 스키마 검증.

## 미결 사항 (jery, 구현 시작 후 게이트)
1. STT provider 선택(Web Speech / 서버STT / Gemini audio) — PR4 블로킹.
2. 서비스명/서브도메인 최종 확정(`interview.teachermate.co.kr`).

## Out of Scope (이번 에픽에서 안 하는 것)
- 영상 면접(카메라·표정·시선) — jery 제외 확정.
- 다른 3개 서비스(dress/resume/color) — 별도 터미널.
- GitHub repo 생성·DNS·Render 배포 = 새 세션 master 액션(마지막).
- STT 실제 구현(PR4, 승인 전).

## 에픽 구조 (수직 슬라이스)

| PR | 내용 | AI | 블로킹 |
|----|------|----|--------|
| **PR1** | 스캐폴드 + 랜딩 + 세션참여(6자리코드+이름) + 직종 선택 + 부팅 가드 | 없음 | ✅무블로킹 |
| PR2 | 모의면접(직종별 질문·꼬리질문·STAR 입력) + Gemini 피드백 | Gemini | ✅무블로킹 |
| PR3 | 평가 리포트(attempt 집계·점수·약점TOP3) | Gemini | ✅무블로킹 |
| PR4 | 발화분석 STT UI | STT provider | ⚠️jery 승인 |
| PR5 | 교사 대시보드(학급 취업준비 현황·attempt 집계) | 없음 | ✅(PR1~3 후) |

> **1차 AO 핸드오프 = PR1 (slug: `interview-pr1`).**
