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
- **Decision**: 인증·데이터 모두 공유 jblkb. 서버 부팅 시 `assertSameSupabaseProject()` — data URL·auth URL·JWT ref 전부 동일 검증, 불일치 시 throw([[portfolio-sso-auth-data-project-split]] 401 재발 차단).
- **RLS 멀티테넌시**: RLS deny-all + 서버 service_role + 라우트별 `requireSessionOwner`(교사 세션 소유권 체크 의무).
- **DB code 정규식**: `char(6)` + `CHECK (code ~ '^[A-Z0-9]{6}$')` — API 거부와 불일치 차단.

### ADR-3: STT(발화분석) = 어댑터+NullProvider+플래그, jery 승인 게이트
- **Decision**: `SttProvider` 인터페이스 + `NullSttProvider`(no-op) 기본 주입. `VITE_FEATURE_STT=false` 기본. STT 없이 텍스트 면접 전 경로 동작·테스트 통과 보장.
- STT env 전무 시 음성 UI 렌더 안 함(조건부 import). 실제 provider 선택은 jery 승인 후.
- **Consequences**: (+)텍스트 면접부터 출시 가능 (−)발화분석 UI는 PR4까지 보류.

### ADR-4: 꼬리질문 매칭 = 정규화 + 형태소 전처리 전략 명시
- **Context**: 단일 `triggerKeyword` 한국어 단순 매칭은 조사/어미/띄어쓰기 변형으로 불안정.
- **Decision**: triggerKeyword 배열(`variants[]`) 확장 + 서버에서 정규화(공백 압축·조사 스트리핑 기본 목록) 후 매칭. 매칭 우선순위: 정확 > 포함. 중복 dedup. 형태소 분석 라이브러리 도입은 PR2에서 평가(Over-engineering 판단 후).
- **Consequences**: (+)예측 가능한 데이터 기반 꼬리질문 (+)한국어 변형 커버 (−)variants 관리 비용.

### ADR-5: 면접 시도(Attempt) 영속화 — 대시보드 집계 재현성
- **Context**: answers/reports만 저장하면 대시보드 평균·약점 집계 재현 불가(리프레시·재시도·중복 시도 시 모호).
- **Decision**: `interview_attempts`(participant_id, session_id, industry_code, assigned_question_ids[], status, started_at, completed_at, report_id) 테이블 추가. 대시보드는 attempt 기준 집계.
- **Consequences**: (+)집계 재현 가능 (+)학생 다회 연습 구분 (−)스키마 복잡도 소폭 증가.

### ADR-6: 평가 weight 합=100 런타임 가드
- **Decision**: 서버 부팅 시 `evaluation-criteria.json` 로드 → weight 합=100 + 전항목 존재 검증. 실패 시 부팅 throw(데이터 변경 시 즉시 발견).

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
