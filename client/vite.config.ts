import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  // בפרודקשן מוגש דרך IIS תחת /PensiaMng/ (Application ב-Default Web Site) —
  // חייב להתאים לנתיב שם, אחרת כתובות ה-assets נשברות. בפיתוח נשאר '/'.
  base: mode === 'production' ? '/PensiaMng/' : '/',
}))
