# ABARROTES PRO — Mi Bodega

Punto de venta offline (PWA) para un puesto de abarrotes por mayor.

- `mi-bodega-handoff/`: especificación, modelo de datos, diseño y mockups.
- `app/`: la aplicación (React + TypeScript + Vite + Dexie).
- `PLAN.md`: plan, fases y decisiones tomadas.

## Uso

```bash
cd app
npm install
npm run dev        # http://<ip-de-tu-pc>:5173 desde el teléfono en la misma red Wi-Fi
npm test           # tests de dominio y BD (Vitest)
npm run e2e        # flujos en viewport móvil (Playwright)
npm run build && npm run preview   # PWA instalable y offline
```

Para instalarla en el teléfono: abre la dirección en Chrome → menú → "Agregar a pantalla principal".
