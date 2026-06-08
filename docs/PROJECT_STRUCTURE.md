# Project Structure

```txt
wulfzx-invoice-tracker/
├─ app/
│  ├─ login/
│  │  └─ page.tsx
│  ├─ dashboard/
│  │  └─ page.tsx
│  ├─ customers/
│  │  ├─ page.tsx
│  │  └─ new/
│  │     └─ page.tsx
│  ├─ invoices/
│  │  ├─ page.tsx
│  │  └─ new/
│  │     └─ page.tsx
│  ├─ payments/
│  │  └─ page.tsx
│  ├─ receipts/
│  │  └─ page.tsx
│  ├─ reports/
│  │  └─ page.tsx
│  ├─ settings/
│  │  └─ page.tsx
│  ├─ globals.css
│  ├─ layout.tsx
│  └─ page.tsx
│
├─ components/
│  ├─ Sidebar.tsx
│  └─ StatCard.tsx
│
├─ lib/
│  ├─ supabase/
│  │  ├─ client.ts
│  │  └─ server.ts
│  ├─ calculations.ts
│  ├─ invoice-number.ts
│  └─ types.ts
│
├─ db/
│  └─ schema.sql
│
├─ docs/
│  ├─ BLUEPRINT.md
│  ├─ PROJECT_STRUCTURE.md
│  └─ BUILD_CHECKLIST.md
│
├─ public/
├─ .env.example
├─ .gitignore
├─ package.json
└─ README.md
```
