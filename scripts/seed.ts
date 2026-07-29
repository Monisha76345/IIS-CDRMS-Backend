/**
 * Bootstrap seed for CDRMS local/dev.
 *
 * Admin login after seed:
 *   Email / Login ID : admin@cdrms.local  /  CDRMS00001
 *   Password         : Okay@123
 *
 * Also seeds: CDRMS roles, application statuses, system parameters, sample geo locations.
 *
 * Run: npm run seed
 */
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { loadEnvironment, requireEnv, requireEnvNumber } from '../src/config/load-env';

async function main() {
  loadEnvironment();

  const ds = new DataSource({
    type: requireEnv('DB_TYPE') as 'mysql',
    host: requireEnv('DB_HOST'),
    port: requireEnvNumber('DB_PORT'),
    username: requireEnv('DB_USERNAME'),
    password: requireEnv('DB_PASSWORD'),
    database: requireEnv('DB_DATABASE'),
    synchronize: false,
    logging: false,
  });

  await ds.initialize();
  const qr = ds.createQueryRunner();
  await qr.connect();

  try {
    // Roles
    const roles = [
      ['super_admin', 'Super Admin — full CDRMS administration'],
      ['cao', 'CAO — verify / return / reject CDR applications'],
      ['engineer', 'Engineer — field site-visit capture'],
    ];
    for (const [code, description] of roles) {
      await qr.query(
        `INSERT INTO roles (code, name, description, createdAt, updatedAt)
         SELECT ?, ?, ?, NOW(6), NOW(6)
         WHERE NOT EXISTS (SELECT 1 FROM roles r WHERE r.name = ? OR r.code = ?)`,
        [code, code, description, code, code],
      );
      await qr.query(
        `UPDATE roles SET code = ?, description = ?, updatedAt = NOW(6) WHERE name = ? OR code = ?`,
        [code, description, code, code],
      );
    }

    // Series counters
    for (const [prefix, value] of [
      ['CDRMS', '00001'],
      ['POST', '00000'],
    ] as const) {
      await qr.query(
        `INSERT INTO series_generator (prefix, value, createdAt, updatedAt)
         SELECT ?, ?, NOW(6), NOW(6)
         WHERE NOT EXISTS (SELECT 1 FROM series_generator s WHERE s.prefix = ?)`,
        [prefix, value, prefix],
      );
    }

    const passwordHash = await bcrypt.hash('Okay@123', 10);

    await qr.query(
      `INSERT INTO users (
         id, userType, status, changePasswordRequired, loginId, password,
         email, name, aliasName, isDeletable, createdAt, updatedAt
       )
       SELECT UUID(), 'super_admin', 'active', 0, 'CDRMS00001', ?,
              'admin@cdrms.local', 'CDRMS Admin', 'Super Admin', 0, NOW(6), NOW(6)
       WHERE NOT EXISTS (
         SELECT 1 FROM users u
         WHERE u.email = 'admin@cdrms.local' OR u.loginId = 'CDRMS00001'
       )`,
      [passwordHash],
    );

    await qr.query(
      `UPDATE users
       SET password = ?,
           name = 'CDRMS Admin',
           aliasName = 'Super Admin',
           userType = 'super_admin',
           status = 'active',
           loginId = COALESCE(loginId, 'CDRMS00001'),
           isDeletable = 0,
           updatedAt = NOW(6)
       WHERE email = 'admin@cdrms.local' OR loginId = 'CDRMS00001'`,
      [passwordHash],
    );

    // Application statuses
    const statuses: Array<[string, string]> = [
      ['Draft', 'Draft'],
      ['Submitted', 'Submitted'],
      ['Returned', 'Returned'],
      ['Verified', 'Verified'],
      ['Rejected', 'Rejected'],
    ];
    for (const [code, label] of statuses) {
      await qr.query(
        `INSERT INTO application_statuses (id, code, label, status, isSystem, createdAt, updatedAt)
         SELECT UUID(), ?, ?, 'Active', 1, NOW(6), NOW(6)
         WHERE NOT EXISTS (SELECT 1 FROM application_statuses s WHERE s.code = ?)`,
        [code, label, code],
      );
    }

    // System parameters
    const params: Array<[string, string, string, string | null, string]> = [
      ['otp_validity_minutes', 'OTP validity', '5', 'min', 'How long an OTP remains valid after dispatch.'],
      ['otp_length', 'OTP length', '6', null, 'Number of digits in SMS OTP.'],
      ['otp_resend_cooldown_seconds', 'OTP resend cooldown', '30', 'sec', 'Minimum wait before requesting another OTP.'],
      ['otp_max_attempts', 'OTP max attempts', '5', null, 'Failed validation attempts before lockout.'],
      ['max_photo_count', 'Max photo count', '10', null, 'Maximum photographs per site-visit application.'],
      ['max_photo_size_mb', 'Max photo size', '10', 'MB', 'Per-file photo size limit.'],
      ['max_video_size_mb', 'Max video size', '50', 'MB', 'Single video size limit per application.'],
      ['session_timeout_minutes', 'Session timeout', '30', 'min', 'Idle timeout for web and mobile sessions.'],
      ['pdf_template_version', 'PDF template version', 'v1.2', null, 'Active CDR PDF pack template metadata.'],
    ];
    for (const [key, label, value, unit, description] of params) {
      await qr.query(
        `INSERT INTO system_parameters (\`key\`, label, value, unit, description, createdAt, updatedAt)
         SELECT ?, ?, ?, ?, ?, NOW(6), NOW(6)
         WHERE NOT EXISTS (SELECT 1 FROM system_parameters p WHERE p.\`key\` = ?)`,
        [key, label, value, unit, description, key],
      );
    }

    // Sample geo locations
    const geos: Array<[string, string, string]> = [
      ['East Zone', 'EZ', 'Active'],
      ['West Zone', 'WZ', 'Active'],
      ['North Zone', 'NZ', 'Active'],
      ['South Zone', 'SZ', 'Active'],
      ['Bommanahalli', 'BMH', 'Active'],
      ['Yelahanka', 'YLK', 'Inactive'],
    ];
    for (const [name, code, status] of geos) {
      await qr.query(
        `INSERT INTO geo_locations (id, name, code, status, createdAt, updatedAt)
         SELECT UUID(), ?, ?, ?, NOW(6), NOW(6)
         WHERE NOT EXISTS (SELECT 1 FROM geo_locations g WHERE g.code = ?)`,
        [name, code, status, code],
      );
    }

    // Sample attribute masters (subset)
    const attrs: Array<[string, string, string]> = [
      ['site_type', 'Residential', 'SITE-RES'],
      ['site_type', 'Commercial', 'SITE-COM'],
      ['site_type', 'Civic Amenity', 'SITE-CA'],
      ['road_type', 'Asphalt', 'ROAD-ASP'],
      ['road_type', 'Concrete', 'ROAD-CON'],
      ['boundary_type', 'Compound Wall', 'BND-WALL'],
      ['measurement_unit', 'Square Metre', 'UNIT-SQM'],
      ['bandi_type', 'Check Bandi', 'BNDI-CHK'],
      ['surrounding', 'Road', 'SUR-ROAD'],
      ['surrounding', 'Park', 'SUR-PARK'],
    ];
    for (const [type, label, code] of attrs) {
      await qr.query(
        `INSERT INTO attribute_masters (id, type, label, code, status, createdAt, updatedAt)
         SELECT UUID(), ?, ?, ?, 'Active', NOW(6), NOW(6)
         WHERE NOT EXISTS (
           SELECT 1 FROM attribute_masters a WHERE a.type = ? AND a.code = ?
         )`,
        [type, label, code, type, code],
      );
    }

    console.log('CDRMS seed complete.');
    console.log('  Login ID : CDRMS00001');
    console.log('  Email    : admin@cdrms.local');
    console.log('  Password : Okay@123');
  } finally {
    await qr.release();
    await ds.destroy();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
