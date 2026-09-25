# CLAUDE.md — Mi Bodega

Reglas del proyecto. Léelas antes de cada tarea.

## Qué es

Una PWA de punto de venta para un puesto de abarrotes por mayor en un mercado. Tiene un solo usuario (el dueño), se usa en un teléfono Android y debe funcionar sin internet. Las especificaciones están en `docs/`.

## Stack (propuesta; se puede discutir en el plan inicial)

| Área | Elección | Por qué |
|---|---|---|
| Framework | React 18 + TypeScript (strict) + Vite | Rápido, tipado, fácil de mantener |
| PWA / offline | `vite-plugin-pwa` (Workbox), precache de todo el shell | Debe abrir sin señal |
| Base de datos local | IndexedDB con **Dexie 4** | Transacciones reales y consultas por índice |
| Estado de UI | Zustand (solo estado efímero: carrito, tickets en espera, pestaña activa) | Los datos persistentes viven en Dexie |
| Lecturas reactivas | `useLiveQuery` de `dexie-react-hooks` | La UI se actualiza sola al cambiar la BD |
| Estilos | CSS Modules + variables CSS (tokens en `docs/DESIGN.md`) | Sin frameworks CSS pesados |
| Gráficos | Chart.js 4 (solo en Estadísticas, con carga diferida) | Liviano |
| Criptografía | WebCrypto: PBKDF2-SHA256 para los códigos | Nativo, sin dependencias |
| Tests | Vitest para dominio y BD (`fake-indexeddb`), Playwright para flujos | |
| Impresión | CSS `@media print` para ticket de 58/80 mm; ESC/POS por Web Bluetooth como fase opcional | |

Sin backend en v1. La sincronización en la nube es una fase posterior (SPEC §0, Fase 6).

## Estructura sugerida

```
src/
  domain/        # lógica pura, sin React ni Dexie: money, prediction, pin, balances, operationCode
  db/            # esquema Dexie, migraciones, repositorios (una función por operación atómica)
  features/
    sell/        # vender, carrito, tickets en espera, cobrar, recibo
    inventory/
    parties/     # clientes y vendedores, fiado, consignación, liquidación, códigos
    cash/        # caja, compras, gastos, retiros, aportes
    stats/
    settings/
  ui/            # componentes compartidos: TileButton, PinPad, MoneyText, BottomBar, Sheet
  print/
  app/           # rutas, shell, providers
```

## Reglas de código

1. **Dinero:** siempre `number` entero en céntimos (tipo `Cents`). Solo se formatea al mostrar (`formatPEN(cents)` → `S/ 1,234.50`). Queda prohibido `parseFloat` sobre dinero fuera de `domain/money.ts`.
2. **Cantidades:** número entero de unidades de venta (sacos, cajas). Si un producto admite fracciones (`allowsFraction`), se guardan en milésimas enteras.
3. **Atomicidad:** toda operación de negocio es una sola función en `db/` que corre dentro de `db.transaction('rw', [...tablas], ...)`. La UI nunca escribe en varias tablas por su cuenta.
4. **Sin borrados:** las entidades de negocio se anulan (`status: 'void'`, `voidReason`, `voidedAt`). Solo se borran físicamente los borradores de carrito.
5. **Snapshots:** las líneas de venta o entrega guardan nombre, precio y costo al momento, para que el historial no cambie si luego se edita el producto.
6. **Dominio puro:** la predicción, los saldos, el vuelto y la verificación del código son funciones puras con tests unitarios.
7. **Rendimiento:** la respuesta visual de un toque en un producto debe ocurrir en menos de 50 ms. La escritura en BD del carrito se hace en segundo plano y no bloquea la UI. No se re-renderiza la cuadrícula completa por cada toque (memoización por tile).
8. **Accesibilidad táctil:** objetivos de al menos 44×44 px (los de venta, 96 px o más). `<button>` reales y `aria-label` en los botones que solo tienen icono.
9. **Textos de UI** en español de Perú, centralizados en `src/i18n/es-PE.ts`.
10. **Nunca** guardes ni registres (`log`) un código de cliente en texto plano.

## Comandos esperados

- `npm run dev`: servidor local accesible desde el teléfono en la misma red (`--host`).
- `npm test`: Vitest.
- `npm run e2e`: Playwright con viewport móvil (390×844).
- `npm run build && npm run preview`: prueba de PWA instalable y offline.

## Definición de terminado (por fase)

- Criterios de aceptación de la fase en `docs/SPEC.md` cumplidos.
- Tests de dominio y de las operaciones de BD de la fase en verde.
- Al menos un test e2e del flujo principal de la fase.
- Funciona con la red desactivada.
- Resumen para el dueño de qué probar a mano.
