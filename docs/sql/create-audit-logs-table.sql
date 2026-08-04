-- Audit trail for mutating API calls and security rejects (HTML/script in inputs).
-- Run once against the CDRMS MySQL database.

CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  user_id VARCHAR(255) NULL,
  username VARCHAR(255) NULL,
  module VARCHAR(128) NOT NULL,
  action VARCHAR(64) NOT NULL,
  method VARCHAR(16) NULL,
  path VARCHAR(512) NULL,
  status_code INT NULL,
  ip_address VARCHAR(64) NULL,
  user_agent VARCHAR(512) NULL,
  entity_type VARCHAR(128) NULL,
  entity_id VARCHAR(128) NULL,
  old_value JSON NULL,
  new_value JSON NULL,
  created_at DATETIME(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6),
  INDEX IDX_AUDIT_USER_CREATED (user_id, created_at),
  INDEX IDX_AUDIT_MODULE_ACTION (module, action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
