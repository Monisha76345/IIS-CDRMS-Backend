-- Audit trail for mutating API calls and security rejects (HTML/script in inputs).
-- Matches TypeORM entity `AuditLog` (uuid PK + BaseEntity audit columns).

CREATE TABLE IF NOT EXISTS audit_logs (
  id CHAR(36) NOT NULL PRIMARY KEY,
  createdBy VARCHAR(255) NULL,
  createdAt DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6),
  updatedBy VARCHAR(255) NULL,
  updatedAt DATETIME(6) NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  actionType VARCHAR(255) NOT NULL,
  title VARCHAR(255) NOT NULL,
  meta TEXT NULL,
  userId VARCHAR(36) NULL,
  userName VARCHAR(255) NULL,
  INDEX IDX_AUDIT_USER_CREATED (userId, createdAt),
  INDEX IDX_AUDIT_ACTION_TYPE (actionType)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
