# Mi Bodega — plan de desarrollo

La especificación está en `mi-bodega-handoff/` y el código en `app/`.

## Estructura

```
app/
  src/
    domain/     lógica pura: money, qty, cart (deshacer), multiplier, gridOrder, time, tileColor
    db/         esquema Dexie, operaciones atómicas (products, tickets, settings, seed)
    features/
      sell/     Vender, pestañas, cuadrícula, multiplicador, detalle, Cobrar
      inventory/  lista, ficha de producto, ajuste de stock, foto
      history/  historial de ventas: reimprimir y anular
      settings/
    ui/         Sheet, NumPad, Button, MoneyText, Toast, ScreenHeader, useLongPress
    print/      recibo de 58/80 mm con @media print
    app/        shell, navegación (con botón atrás de Android), arranque
    i18n/es-PE.ts
  e2e/          Playwright (viewport 390×844)
```

## Librerías (versiones instaladas)

| Paquete | Versión | Nota |
|---|---|---|
| react / react-dom | 19.3 | CLAUDE.md dice 18; la 19 es la estable actual y no cambia nada de lo que usamos |
| vite | 8.3 | |
| typescript | 6.0 (strict) | |
| dexie / dexie-react-hooks | 4.4 / 4.4 | |
| zustand | 5.0 | solo estado efímero |
| vite-plugin-pwa (Workbox) | 1.3 | precache del shell y de las fuentes |
| @fontsource/archivo, ibm-plex-mono | 5.3 | fuentes incluidas en el paquete (offline) |
| ulid | 3.0 | ids ordenables por tiempo |
| vitest + fake-indexeddb + jsdom | 5.0 / 6.2 | |
| @playwright/test | 1.63 | |

Chart.js entra en la Fase 5 (Estadísticas), con carga diferida.

## Fases (SPEC §0)

| Fase | Estado |
|---|---|
| 1. Base: BD, inventario, vender, tickets en espera, cobrar (efectivo/Yape), recibo, PWA offline | **Hecha, esperando tu OK** |
| 2. Predicción "Siguiente probable" y orden por popularidad | pendiente |
| 3. Clientes/vendedores, código personal, fiado, cobro de deudas, comprobante | pendiente |
| 4. Consignación: entregar y liquidar | pendiente |
| 5. Caja, compras, gastos, estadísticas, inicio | pendiente |
| 6. Respaldo, ESC/POS Bluetooth, nube (opcional) | pendiente |

## Ambigüedades y cómo las resolví (Fase 1)

Puedes cambiar cualquiera de estas decisiones.

1. **Cuántos tiles se ven.** La cuadrícula llena las filas que entran en la pantalla (en un teléfono de 390×844 son 11 productos y "Buscar"). El resto se encuentra con "Buscar". No hay scroll, así el dedo no se pierde.
2. **Multiplicador mayor que el stock.** Si tocas ×10 y solo quedan 5, se agregan los 5, el teléfono vibra y sale el aviso "Solo quedan 5".
3. **"Exacto" viene marcado por defecto** al cobrar en efectivo. Con eso la venta típica sale en 5 toques (el mockup resalta S/ 500, pero así no daría 5 toques).
4. **N.º de ticket.** El correlativo del día (#0001…) se asigna al cobrar, no al abrir la pestaña. Así no quedan huecos por pestañas vacías.
5. **Fracciones (kg, litro).** La cantidad se guarda en milésimas. El total de la línea se redondea al céntimo más cercano. Es el único redondeo de la app. Una vez creado el producto, no se puede activar ni quitar "permite fracciones", porque eso cambiaría el significado del stock guardado.
6. **"Cantidad de productos" en la barra de cobro** = suma de unidades (2 arroz + 1 aceite = 3). Una línea con fracción cuenta como 1.
7. **Cerrar una pestaña vacía.** La spec no dice cómo se cierra una pestaña sin cobrar. Agregué, en el toque largo de la pestaña (renombrar), el botón "Cerrar pestaña vacía". Solo aparece si la pestaña no tiene productos. Si prefieres que no exista, lo quito.
8. **Historial de ventas.** §4 pide reimprimir desde el historial, así que agregué "Historial de ventas" al menú. Ahí también se anula una venta del día con motivo. Las ventas de días anteriores necesitan el código de dueño, que llega en la Fase 3; mientras tanto no se pueden anular.
9. **Fiado** aparece en Cobrar, pero desactivado ("Pronto") hasta la Fase 3.
10. **Orden de la cuadrícula en la Fase 1:** primero los fijados y luego el resto por nombre. Se recalcula al abrir la app o con "Reordenar" en Ajustes, y nunca mientras haya tickets con productos. La popularidad con decaimiento entra en la Fase 2.
11. **Esquema de BD.** La versión 1 tiene solo las tablas de la Fase 1. Cada fase agrega una versión de Dexie (migración), en vez de crear ahora tablas que todavía no se usan.

## Propuestas (no implementadas; necesito tu decisión)

- **"Deshacer" después de cobrar.** La spec dice que anula el ticket y repone el stock. Eso funciona así. Pero si el error fue solo el método de pago (efectivo en vez de Yape), hay que volver a marcar todos los productos. Propongo que "Deshacer" anule la venta **y además devuelva los productos al ticket** para corregir y cobrar de nuevo. La anulación queda registrada igual.
- **Impresión en Android.** `window.print()` abre el diálogo de impresión de Android. Para una térmica de 58 mm hace falta un servicio de impresión instalado (por ejemplo, el de la marca de la impresora). La impresión directa sin diálogo es ESC/POS por Bluetooth (Fase 6). Si imprimes mucho, conviene adelantar esa parte.
