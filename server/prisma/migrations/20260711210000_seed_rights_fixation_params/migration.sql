-- Seed RegulatoryParameter with rights-fixation (kibua zchuyot, section 9a / amendment 190) values.
-- Spec section 12: regulatory values live in the DB with validity dates, never only in code.
-- The calc engine keeps documented code defaults; DB rows override when present.

INSERT INTO "RegulatoryParameter" ("id", "key", "value", "validFrom", "validTo", "source", "notes") VALUES
-- תקרת קצבה מזכה (₪ לחודש) לפי שנה
('regp_annuity_ceiling_2020', 'annuity_ceiling_monthly', 8510,  '2020-01-01', '2020-12-31', 'רשות המסים', 'תקרת קצבה מזכה 2020'),
('regp_annuity_ceiling_2021', 'annuity_ceiling_monthly', 8460,  '2021-01-01', '2021-12-31', 'רשות המסים', 'תקרת קצבה מזכה 2021'),
('regp_annuity_ceiling_2022', 'annuity_ceiling_monthly', 8660,  '2022-01-01', '2022-12-31', 'רשות המסים', 'תקרת קצבה מזכה 2022'),
('regp_annuity_ceiling_2023', 'annuity_ceiling_monthly', 9120,  '2023-01-01', '2023-12-31', 'רשות המסים', 'תקרת קצבה מזכה 2023'),
('regp_annuity_ceiling_2024', 'annuity_ceiling_monthly', 9430,  '2024-01-01', '2024-12-31', 'רשות המסים', 'תקרת קצבה מזכה 2024'),
('regp_annuity_ceiling_2025', 'annuity_ceiling_monthly', 9430,  '2025-01-01', NULL,         'רשות המסים', 'תקרת קצבה מזכה 2025 — הערך האחרון הידוע; לעדכן בינואר'),
-- אחוז הפטור על הקצבה המזכה — מדרגות תיקון 190
('regp_exemption_pct_2012',   'pension_exemption_pct',   43.5,  '2012-01-01', '2015-12-31', 'תיקון 190 לפקודה', 'מדרגה ראשונה'),
('regp_exemption_pct_2016',   'pension_exemption_pct',   49,    '2016-01-01', '2019-12-31', 'תיקון 190 לפקודה', 'מדרגה שנייה'),
('regp_exemption_pct_2020',   'pension_exemption_pct',   52,    '2020-01-01', '2024-12-31', 'תיקון 190 לפקודה', 'מדרגה שלישית'),
('regp_exemption_pct_2025',   'pension_exemption_pct',   67,    '2025-01-01', NULL,         'תיקון 190 לפקודה', 'מדרגה סופית'),
-- קבועי הנוסחה
('regp_fixation_factor',      'fixation_factor',         180,   '2012-01-01', NULL,         'סעיף 9א לפקודה', 'מקדם ההיוון: הון פטור ⇄ פטור חודשי'),
('regp_offset_multiplier',    'grant_offset_multiplier', 1.35,  '2012-01-01', NULL,         'סעיף 9א לפקודה', 'מכפיל קיזוז מענקים פטורים'),
('regp_grant_window_years',   'grant_window_years',      32,    '2012-01-01', NULL,         'סעיף 9א לפקודה', 'חלון שנות המענקים הפוגעים בהון הפטור');
