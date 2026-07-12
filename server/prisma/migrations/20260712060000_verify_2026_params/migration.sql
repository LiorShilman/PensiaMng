-- Verified 2026 values (Tax Authority + National Insurance publications, July 2026)
UPDATE "RegulatoryParameter" SET "value" = 57.5, "notes" = 'מדרגת ביניים ראשונה — אומת מול הנחיות רשות המסים 2026' WHERE "id" = 'regp_exemption_pct_2026';
UPDATE "RegulatoryParameter" SET "value" = 9700, "notes" = 'הכנסה מזכה חודשית לשכיר — אומת 2026' WHERE "id" = 'regp_tax_qual_income_emp';
UPDATE "RegulatoryParameter" SET "value" = 232800, "notes" = 'הכנסה מזכה שנתית לעצמאי — 2026' WHERE "id" = 'regp_tax_qual_income_self';
UPDATE "RegulatoryParameter" SET "value" = 1838, "notes" = 'קצבת אזרח ותיק ליחיד — אומת 2026' WHERE "id" = 'regp_ni_old_age_individual';
UPDATE "RegulatoryParameter" SET "value" = 924, "notes" = 'תוספת בן/בת זוג — אומת 2026' WHERE "id" = 'regp_ni_old_age_spouse';
UPDATE "RegulatoryParameter" SET "value" = 1838, "notes" = 'קצבת שאירים לאלמן/ה 50+ — אומת 2026' WHERE "id" = 'regp_ni_survivors_widow50';
UPDATE "RegulatoryParameter" SET "value" = 862, "notes" = 'תוספת ליתום — אומת 2026' WHERE "id" = 'regp_ni_survivors_orphan';
UPDATE "RegulatoryParameter" SET "value" = 4771, "notes" = 'קצבת נכות כללית מלאה — אומת 2026' WHERE "id" = 'regp_ni_disability_full';
-- תקרת קצבה מזכה 2026 (ללא שינוי מ-2025 אך מפורש)
INSERT INTO "RegulatoryParameter" ("id", "key", "value", "validFrom", "validTo", "source", "notes") VALUES
('regp_annuity_ceiling_2026', 'annuity_ceiling_monthly', 9430, '2026-01-01', NULL, 'רשות המסים', 'תקרת קצבה מזכה 2026 — אומת')
ON CONFLICT ("id") DO NOTHING;
UPDATE "RegulatoryParameter" SET "validTo" = '2025-12-31' WHERE "id" = 'regp_annuity_ceiling_2025';
