# PensiaMng — מערכת מקצועית לתכנון פנסיה

מערכת לניהול ותכנון פנסיה בישראל. המפרט המלא: [SPECIFICATION.md](SPECIFICATION.md).

## מבנה הפרויקט

| תיקייה | תוכן |
|---|---|
| `server/` | NestJS + Prisma + PostgreSQL — API ומנוע החישוב |
| `server/src/calc-engine/` | מנוע החישוב הדטרמיניסטי (pure TS, בדיקות יחידה לכל נוסחה) |
| `server/prisma/schema.prisma` | מודל הנתונים: לקוחות, מוצרים, מסלולים, פרמטרים רגולטוריים |
| `client/` | React + Vite + TypeScript — ממשק עברית RTL |

## הרצה (פיתוח)

**הדרך הקלה:** לחיצה כפולה על `start.bat` בתיקיית השורש — פותח שני חלונות (שרת ופרונט) ומריץ הכל אוטומטית. אחרי כמה שניות פותחים את הכתובת שמופיעה בחלון ה-Client (בד"כ `http://localhost:5173`).

**ידנית:**

```bash
# שרת — פורט 3210 (פורט 3000 תפוס ע"י פרויקט אחר במחשב)
cd server
npm run start:dev

# פרונט — Vite (בד"כ פורט 5173, ואם תפוס — 5174 וכו')
cd client
npm run dev
```

## בדיקות

```bash
cd server
npx jest src/calc-engine    # בדיקות מנוע החישוב
```

## מסד נתונים

PostgreSQL 18 מקומי. לפני המיגרציה הראשונה — לעדכן את הסיסמה ב-`server/.env`:

```env
DATABASE_URL="postgresql://postgres:<סיסמה>@localhost:5432/pensiamng?schema=public"
```

ואז:

```bash
cd server
npx prisma migrate dev --name init
```

## עקרונות מרכזיים (מהמפרט)

- **מנוע חישוב דטרמיניסטי** — כל נוסחה עם בדיקות יחידה; ה-AI (בהמשך) לעולם לא מחשב בעצמו.
- **עקבות חישוב (trace)** — כל תוצאה מחזירה את הנוסחה, הקלטים וההנחות ששימשו.
- **פרמטרים רגולטוריים בטבלה, לא בקוד** — `RegulatoryParameter` עם תאריכי תחולה.
- **שלושה תרחישים** — כל תחזית מוצגת כפסימי/מרכזי/אופטימי, לא מספר יחיד.
