-- audit_logs: drop + recreate to match CDRMS AuditLog entity
-- (actionType, title, meta, userId, userName + BaseEntity columns)

DROP TABLE IF EXISTS `audit_logs`;

CREATE TABLE `audit_logs` (
  `createdBy`  varchar(255) DEFAULT NULL,
  `createdAt`  datetime(6)  DEFAULT CURRENT_TIMESTAMP(6),
  `updatedBy`  varchar(255) DEFAULT NULL,
  `updatedAt`  datetime(6)  DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6),
  `id`         varchar(36)  NOT NULL,
  `actionType` varchar(255) NOT NULL,
  `title`      varchar(255) NOT NULL,
  `meta`       text,
  `userId`     varchar(36)  DEFAULT NULL,
  `userName`   varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `IDX_AUDIT_USER_CREATED` (`userId`, `createdAt`),
  KEY `IDX_AUDIT_ACTION_TYPE` (`actionType`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
