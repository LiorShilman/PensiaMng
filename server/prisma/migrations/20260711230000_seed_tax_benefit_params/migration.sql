-- Seed RegulatoryParameter with deposit tax-benefit values (section 45a, 2025 — to verify).
INSERT INTO "RegulatoryParameter" ("id", "key", "value", "validFrom", "validTo", "source", "notes") VALUES
('regp_tax_qual_income_emp',   'tax_qualifying_income_employee_monthly', 9400,   '2025-01-01', NULL, 'רשות המסים', 'הכנסה מזכה חודשית לשכיר (סעיף 45א) — לאימות'),
('regp_tax_emp_deposit_pct',   'tax_employee_credit_deposit_pct',        7,      '2025-01-01', NULL, 'פקודת מס הכנסה', 'תקרת הפקדת עובד המזכה בזיכוי'),
('regp_tax_credit_rate',       'tax_credit_rate_pct',                    35,     '2025-01-01', NULL, 'סעיף 45א', 'שיעור הזיכוי'),
('regp_tax_qual_income_self',  'tax_qualifying_income_self_annual',      225600, '2025-01-01', NULL, 'רשות המסים', 'הכנסה מזכה שנתית לעצמאי — לאימות'),
('regp_tax_self_credit_pct',   'tax_self_credit_pct',                    5.5,    '2025-01-01', NULL, 'פקודת מס הכנסה', 'עצמאי: % הפקדה לזיכוי'),
('regp_tax_self_deduction_pct','tax_self_deduction_pct',                 11,     '2025-01-01', NULL, 'סעיף 47', 'עצמאי: % הפקדה לניכוי');
