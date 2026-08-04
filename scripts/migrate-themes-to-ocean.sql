-- Normalize all user theme preferences to Ocean Blue.
-- Removes legacy / unknown themes: blue, navy, azure, sky, indigo, etc.
--
-- Usage:
--   mysql -h HOST -u USER -p DATABASE < scripts/migrate-themes-to-ocean.sql
-- Or via npm:
--   npm run themes:ocean

UPDATE users
SET themePreference = 'ocean'
WHERE themePreference IS NULL
   OR themePreference = ''
   OR LOWER(themePreference) <> 'ocean';

SELECT themePreference, COUNT(*) AS users
FROM users
GROUP BY themePreference;
