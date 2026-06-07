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

CREATE TABLE interview_participants (
  id                   uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id           uuid        NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  name                 text        NOT NULL
                                   CHECK (length(trim(name)) >= 1 AND length(name) <= 30),
  join_token           char(64)    NOT NULL
                                   CHECK (join_token ~ '^[a-f0-9]{64}$'),
  joined_at            timestamptz NOT NULL DEFAULT now(),
  selected_industry    text,
  selected_sub         text,
  industry_confirmed   boolean     NOT NULL DEFAULT false
);

ALTER TABLE interview_sessions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_participants ENABLE ROW LEVEL SECURITY;

CREATE INDEX idx_interview_sessions_code ON interview_sessions(code);
CREATE INDEX idx_interview_sessions_teacher_id ON interview_sessions(teacher_id);
CREATE INDEX idx_interview_participants_session ON interview_participants(session_id);
