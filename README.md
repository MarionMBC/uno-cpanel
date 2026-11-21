# Panel de Combustibles · UNO Guaimaca Centro

## Desarrollo local (emuladores Firebase)

Producción (`uno-panel`) tiene reglas de Firestore vencidas; para trabajar en local se usan los emuladores.

Requisitos: Node 22+, JDK 21+ (se detecta solo en `C:/Program Files/Microsoft|Eclipse Adoptium|Java`) y el CLI `firebase` (`npm i -g firebase-tools`).

```bash
cp .env.emulator.example .env.development.local   # solo lo carga `next dev`, nunca `next build`
npm run emulators      # terminal 1: Auth 9099, Firestore 8080, UI http://127.0.0.1:4000 (proyecto demo-uno-panel)
npm run seed:emu       # terminal 2: usuarios, bombas, precios y lecturas de ejemplo
npm run dev            # http://localhost:3000
```

Usuarios de prueba (clave `uno12345`): `admin@uno.local` (Administrador), `operador@uno.local`, `operador2@uno.local` (Operador), `inactivo@uno.local` (rechazado).
Los emuladores guardan en memoria: al reiniciarlos, correr `npm run seed:emu` de nuevo.

`firebase.emulator.json` usa `firestore.emulator.rules` (abiertas) y nunca se despliega; `firebase.json` es la config de producción.

---

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
