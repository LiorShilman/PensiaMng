-- Fix pension-exemption schedule: later legislation spread the 67% step
-- (2026: 57%, 2027: 62.5%, 2028+: 67%); 52% stays through 2025.
UPDATE "RegulatoryParameter"
  SET "validTo" = '2025-12-31', "notes" = 'מדרגה שלישית — נותרה בתוקף עד סוף 2025 (פריסת העלייה בחוק ההסדרים)'
  WHERE "id" = 'regp_exemption_pct_2020';

DELETE FROM "RegulatoryParameter" WHERE "id" = 'regp_exemption_pct_2025';

INSERT INTO "RegulatoryParameter" ("id", "key", "value", "validFrom", "validTo", "source", "notes") VALUES
('regp_exemption_pct_2026', 'pension_exemption_pct', 57,   '2026-01-01', '2026-12-31', 'תיקון 190 + פריסה בחוק ההסדרים', 'מדרגת ביניים ראשונה — לאימות'),
('regp_exemption_pct_2027', 'pension_exemption_pct', 62.5, '2027-01-01', '2027-12-31', 'תיקון 190 + פריסה בחוק ההסדרים', 'מדרגת ביניים שנייה — לאימות'),
('regp_exemption_pct_2028', 'pension_exemption_pct', 67,   '2028-01-01', NULL,         'תיקון 190 + פריסה בחוק ההסדרים', 'המדרגה הסופית');
