# Web Admin (Angular)

Admin dashboard for **Annai Golden Builders** — manage projects, supervisors, clients, expenses, etc.

## Stack
- Angular 18
- Standalone components
- Reactive forms

## Run

```bash
# from repo root
npm install
npm start
# → http://localhost:4200
```

## Build

```bash
npm run build          # → dist/annai-builders-dashboard/
```

## Pages

| Path | Purpose |
|------|---------|
| `/login` | Admin login |
| `/dashboard` | Overview stats |
| `/projects` | Project list & detail |
| `/supervisors` | Manage supervisors (invite, deactivate) |
| `/clients` | Manage clients |
| `/expenses` | Site expenses |
| `/settings` | Profile, app config, role permissions |

## API

Configured in `src/environments/environment.prod.ts`:
```ts
export const environment = {
  production: true,
  apiUrl: 'https://agb-o3cc.onrender.com/api',
  // ...
};
```

## Layout

```
src/
├── app/
│   ├── core/           # services (api, auth, guards)
│   ├── pages/          # routed page components
│   ├── layout/         # shell, header, sidebar
│   ├── shared/         # reusable components
│   └── models/         # TypeScript types
├── assets/             # logos, icons
├── data/               # mock/seed data
├── environments/       # dev / prod configs
├── main.ts
├── styles.css
└── index.html
```
