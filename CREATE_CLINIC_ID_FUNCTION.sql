-- ============================================================================
-- CREATE FUNCTION TO GET CLINIC_ID FROM AUTH_USER_ID
-- ============================================================================
-- This function bypasses REST API restrictions by being called server-side
-- Solution: Instead of querying admin_auth directly, call this function
-- ============================================================================

CREATE OR REPLACE FUNCTION get_clinic_id_for_user(user_id UUID)
RETURNS UUID AS $$
BEGIN
  RETURN (
    SELECT clinic_id 
    FROM admin_auth 
    WHERE auth_user_id = user_id
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Verify it works
SELECT get_clinic_id_for_user('9bf6605a-db64-4024-9245-f23ef16cae37'::UUID) as clinic_id;

SELECT '✅ FUNCTION CREATED' as status;
