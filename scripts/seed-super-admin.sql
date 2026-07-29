-- =============================================================================
-- CDRMS — Super Admin seed ONLY
-- Tables: roles, personal_details, post_details, post_person_mappings (+ users)
-- =============================================================================
-- Run after API has synced schema (npm run start:dev once):
--
--   mysql -h127.0.0.1 -uroot -p cdrms < scripts/seed-super-admin.sql
--
-- Login after seed:
--   Login ID : CDRMS00001
--   Email    : admin@cdrms.local
--   Password : Okay@123
-- =============================================================================

-- ------------------------------------------------------------
-- 1) roles (super_admin, cao, engineer)
-- ------------------------------------------------------------
INSERT INTO roles (code, name, description, createdAt, updatedAt)
SELECT 'super_admin', 'super_admin', 'Super Admin — full CDRMS administration', NOW(6), NOW(6)
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'super_admin' OR code = 'super_admin');

INSERT INTO roles (code, name, description, createdAt, updatedAt)
SELECT 'cao', 'cao', 'CAO — verify / return / reject CDR applications', NOW(6), NOW(6)
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'cao' OR code = 'cao');

INSERT INTO roles (code, name, description, createdAt, updatedAt)
SELECT 'engineer', 'engineer', 'Engineer — field site-visit capture', NOW(6), NOW(6)
WHERE NOT EXISTS (SELECT 1 FROM roles WHERE name = 'engineer' OR code = 'engineer');

UPDATE roles
SET description = 'Super Admin — full CDRMS administration',
    code = 'super_admin',
    updatedAt = NOW(6)
WHERE name = 'super_admin' OR code = 'super_admin';

SET @super_admin_role_id := (
  SELECT id FROM roles WHERE name = 'super_admin' OR code = 'super_admin' LIMIT 1
);

-- ------------------------------------------------------------
-- 2) series counters
-- ------------------------------------------------------------
INSERT INTO series_generator (prefix, value, createdAt, updatedAt)
SELECT 'CDRMS', '00001', NOW(6), NOW(6)
WHERE NOT EXISTS (SELECT 1 FROM series_generator WHERE prefix = 'CDRMS');

INSERT INTO series_generator (prefix, value, createdAt, updatedAt)
SELECT 'POST', '00001', NOW(6), NOW(6)
WHERE NOT EXISTS (SELECT 1 FROM series_generator WHERE prefix = 'POST');

-- bcrypt hash for Okay@123
SET @pwd := '$2b$10$YZGA5N79/OQTtAou1M5v5u0AG8eVDHFeRGPNo4/DCTaZIu4APVSuC';

-- ------------------------------------------------------------
-- 3) users (login account)
-- ------------------------------------------------------------
INSERT INTO users (
  id, userType, status, changePasswordRequired, loginId, password,
  email, name, aliasName, isDeletable, createdAt, updatedAt
)
SELECT
  UUID(), 'super_admin', 'active', 0, 'CDRMS00001', @pwd,
  'admin@cdrms.local', 'CDRMS Admin', 'Super Admin', 0, NOW(6), NOW(6)
WHERE NOT EXISTS (
  SELECT 1 FROM users
  WHERE email = 'admin@cdrms.local' OR loginId = 'CDRMS00001'
);

UPDATE users
SET password = @pwd,
    name = 'CDRMS Admin',
    aliasName = 'Super Admin',
    userType = 'super_admin',
    status = 'active',
    loginId = COALESCE(loginId, 'CDRMS00001'),
    isDeletable = 0,
    updatedAt = NOW(6)
WHERE email = 'admin@cdrms.local' OR loginId = 'CDRMS00001';

-- ------------------------------------------------------------
-- 4) personal_details (personUniqueId = users.loginId)
-- ------------------------------------------------------------
INSERT INTO personal_details (
  id, personUniqueId, firstName, lastName, email, mobileNumber,
  gender, state, districtName, department, status, createdAt, updatedAt
)
SELECT
  UUID(), 'CDRMS00001', 'System', 'Administrator', 'admin@cdrms.local', '9800000001',
  'Other', 'Karnataka', 'Bengaluru Urban', 'BDA', 'active', NOW(6), NOW(6)
WHERE NOT EXISTS (
  SELECT 1 FROM personal_details WHERE personUniqueId = 'CDRMS00001'
);

UPDATE personal_details
SET firstName = 'System',
    lastName = 'Administrator',
    email = 'admin@cdrms.local',
    status = 'active',
    updatedAt = NOW(6)
WHERE personUniqueId = 'CDRMS00001';

SET @person_id := (
  SELECT id FROM personal_details WHERE personUniqueId = 'CDRMS00001' LIMIT 1
);

-- ------------------------------------------------------------
-- 5) post_details (System Administrator seat)
-- ------------------------------------------------------------
INSERT INTO post_details (
  id, postId, postName, departmentName, roleId, roleName,
  location, ofcAddress, email, phoneNumber, aliasName, createdAt, updatedAt
)
SELECT
  UUID(),
  'POST00001',
  'System Administrator',
  'BDA HQ',
  @super_admin_role_id,
  'super_admin',
  'Bengaluru',
  'BDA Office, Bengaluru',
  'admin@cdrms.local',
  '9800000001',
  'Super Admin',
  NOW(6),
  NOW(6)
WHERE @super_admin_role_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM post_details WHERE postId = 'POST00001');

UPDATE post_details
SET postName = 'System Administrator',
    roleId = @super_admin_role_id,
    roleName = 'super_admin',
    aliasName = 'Super Admin',
    updatedAt = NOW(6)
WHERE postId = 'POST00001'
  AND @super_admin_role_id IS NOT NULL;

SET @post_uuid := (
  SELECT id FROM post_details WHERE postId = 'POST00001' LIMIT 1
);

-- ------------------------------------------------------------
-- 6) post_person_mappings (active assignment)
-- ------------------------------------------------------------
INSERT INTO post_person_mappings (
  postId, personId, startDate, endDate, status, createdAt, updatedAt
)
SELECT
  @post_uuid,
  @person_id,
  CURDATE(),
  NULL,
  'active',
  NOW(6),
  NOW(6)
WHERE @post_uuid IS NOT NULL
  AND @person_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM post_person_mappings m
    WHERE m.postId = @post_uuid
      AND m.personId = @person_id
      AND m.status = 'active'
  );

-- Ensure any existing active mapping for this pair is dated/current
UPDATE post_person_mappings
SET startDate = COALESCE(startDate, CURDATE()),
    endDate = NULL,
    status = 'active',
    updatedAt = NOW(6)
WHERE postId = @post_uuid
  AND personId = @person_id;

SELECT 'CDRMS super-admin seed complete' AS message,
       'CDRMS00001' AS loginId,
       'admin@cdrms.local' AS email,
       'Okay@123' AS password;
