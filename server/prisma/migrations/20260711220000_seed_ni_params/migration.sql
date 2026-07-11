-- Seed RegulatoryParameter with National Insurance (Bituach Leumi) benefit values (2025, to verify).
INSERT INTO "RegulatoryParameter" ("id", "key", "value", "validFrom", "validTo", "source", "notes") VALUES
('regp_ni_old_age_individual',  'ni_old_age_monthly_individual',  1795, '2025-01-01', NULL, 'ביטוח לאומי', 'קצבת אזרח ותיק ליחיד עד גיל 80 — לאימות'),
('regp_ni_old_age_spouse',      'ni_old_age_spouse_supplement',    902, '2025-01-01', NULL, 'ביטוח לאומי', 'תוספת בן/בת זוג — לאימות'),
('regp_ni_seniority_per_year',  'ni_seniority_pct_per_year',         2, '2025-01-01', NULL, 'ביטוח לאומי', 'תוספת ותק לשנת ביטוח'),
('regp_ni_seniority_max',       'ni_seniority_max_pct',             50, '2025-01-01', NULL, 'ביטוח לאומי', 'תקרת תוספת ותק'),
('regp_ni_survivors_widow50',   'ni_survivors_widow_50plus',      1795, '2025-01-01', NULL, 'ביטוח לאומי', 'קצבת שאירים לאלמן/ה 50+ — לאימות'),
('regp_ni_survivors_widow40',   'ni_survivors_widow_40to49',      1349, '2025-01-01', NULL, 'ביטוח לאומי', 'קצבת שאירים לאלמן/ה 40–49 — לאימות'),
('regp_ni_survivors_orphan',    'ni_survivors_orphan_supplement',  902, '2025-01-01', NULL, 'ביטוח לאומי', 'תוספת ליתום (עד גיל 18) — לאימות'),
('regp_ni_orphan_age_limit',    'ni_orphan_age_limit',              18, '2025-01-01', NULL, 'ביטוח לאומי', 'גיל תום זכאות יתום בביטוח לאומי'),
('regp_ni_disability_full',     'ni_disability_full_individual',  4291, '2025-01-01', NULL, 'ביטוח לאומי', 'קצבת נכות כללית מלאה ליחיד — לאימות');
