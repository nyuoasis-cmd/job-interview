-- confirm_participant_industry: 직종 선택 원자적 확정 RPC
-- 단일 UPDATE SQL로 참여자·세션 상태·토큰·확정여부를 동시에 검증
-- 0행 업데이트 시 reason으로 session_closed / already_confirmed 구분

CREATE OR REPLACE FUNCTION confirm_participant_industry(
  p_participant_id UUID,
  p_join_token     CHAR(64),
  p_industry       TEXT,
  p_sub            TEXT
) RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rows INTEGER;
  v_reason TEXT;
BEGIN
  -- 단일 atomic UPDATE: 참여자·세션 join + token + industry_confirmed=false 동시 검증
  UPDATE interview_participants p
  SET
    selected_industry  = p_industry,
    selected_sub       = p_sub,
    industry_confirmed = TRUE
  FROM interview_sessions s
  WHERE p.id            = p_participant_id
    AND p.join_token    = p_join_token
    AND p.industry_confirmed = FALSE
    AND s.id            = p.session_id
    AND s.status        = 'active';

  GET DIAGNOSTICS v_rows = ROW_COUNT;

  IF v_rows > 0 THEN
    RETURN json_build_object('ok', TRUE);
  END IF;

  -- 0행: 원인 구분 (race 이후 단순 읽기)
  SELECT
    CASE
      WHEN p.industry_confirmed THEN 'already_confirmed'
      WHEN s.status <> 'active'  THEN 'session_closed'
      ELSE                            'session_closed'
    END
  INTO v_reason
  FROM interview_participants p
  JOIN interview_sessions s ON s.id = p.session_id
  WHERE p.id = p_participant_id
  LIMIT 1;

  RETURN json_build_object(
    'ok',     FALSE,
    'reason', COALESCE(v_reason, 'session_closed')
  );
END;
$$;
