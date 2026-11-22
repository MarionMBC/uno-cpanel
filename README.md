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

## Reglas de operación (auditoría TASK-004, tareas 006–021)

- **Acceso**: solo usuarios con ficha activa en `users/{correo}` y correo verificado; permisos por rol (`roles`). Reglas en `firestore.rules`, pruebas por rol con `npm run test:rules` (emulador).
- **Día operativo** en hora de Honduras (`lib/fecha.ts`), cambia solo a medianoche.
- **Lecturas**: una por manguera y día (`readings/{fecha}_{dispensador}`); la inicial se precarga con la final anterior (si cambia, motivo); las finales se guardan sin cerrar el día; una final guardada solo se corrige con permiso de cierre y motivo (queda en auditoría con antes → después); vuelta a cero del totalizador con `meterMax` y tope de 20 000 L por manguera y día.
- **Un solo cálculo de venta** (`calcVenta`, litros × precio de la lectura) en Lectura final, Cuadro y Dashboard.
- **Inventario**: pipas atómicas y anulables con motivo; apertura precargada con el inventario final de ayer; cuadre de evaporación guardado con alerta si supera 0,5 %.
- **Bombas**: no se desactivan ni retiran mangueras con lecturas abiertas.
- **Despliegue**: `npm run build` genera `out/` (export estático) → `firebase deploy --only hosting,firestore:rules`. Functions (`precioOficialSemanal`) requieren plan Blaze y `settings/precios.autoOficial = true`.

## Turnos y cierre por bombero (opcional)

Interruptor en Configuración bombas → Turnos (`settings/operacion.shiftsEnabled`, apagado por defecto: todo funciona por día como antes). Encendido: plantillas Mañana/Tarde/Noche, apertura de turno con asignación de bomberos a mangueras y fondo por bombero, lecturas por turno encadenadas (la final de un turno es la inicial del siguiente), corte de precio a mitad de turno, arqueo por bombero (efectivo, POS, créditos, retiros vs esperado), y el día solo se cierra con todos los turnos cerrados y arqueados. La lectura diaria guarda la venta por tramos de precio. Con turnos activos, Lectura inicial y final quedan en solo consulta.

## Precio oficial de referencia (SEN)

Pantalla **Precio del combustible** → "Consultar precio oficial": la Secretaría de Energía fija precios máximos **semanales** (vigentes desde el lunes) solo para Tegucigalpa y San Pedro Sula, en L/galón. El panel lee desde el navegador las notas de Once Noticias y HCH (API pública de WordPress), extrae los precios de Tegucigalpa (`lib/preciosOficiales.ts`), los cruza entre fuentes, enlaza la imagen oficial de sen.hn y suma el **diferencial de Guaimaca** por producto (L/litro, `settings/precios`). "Usar estos precios" solo llena el formulario; si las fuentes no coinciden o el salto supera 15 % exige confirmar que se verificó en la imagen oficial. Nada se aplica solo.

## Control de combustible y evaporación

Menú **Control inventario**: varilla de tanques en **pulgadas** → galones con las tablas de calibración de la estación (`lib/calibracion.ts`: Diésel 5016 gal hasta 71.50 pulg, Súper 5040 gal hasta 70.75 pulg; entre puntos se interpola). Regular no tiene tabla cargada: se digita en galones. Pipas en galones. El cuadre por tanque compara inicial + pipas − vendido (totalizadores, L ÷ 3.78541) contra la varilla final y muestra el faltante/evaporación en gal, L y %. La pestaña **Tablas de calibración** tiene consulta rápida y marca 3 valores de la hoja impresa a revisar.

## Cuadro de totalizadores

Menú **Cuadro de totalizadores**: lectura inicial y final de cada manguera (etiqueta `cara-manguera` por bomba), litros, precio por litro y total en lempiras, subtotales por bomba, resumen por producto, fondo de cambio y total en caja. Exporta a Excel con el formato del cuadro diario. Las mangueras sin lectura final quedan "Pendiente" y no suman (nunca totales negativos). El precio del sistema es **por litro**.

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
