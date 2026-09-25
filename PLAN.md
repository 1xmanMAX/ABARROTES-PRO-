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
| 1. Base: BD, inventario, vender, tickets en espera, cobrar (efectivo/Yape), recibo, PWA offline | Hecha y aprobada |
| 2. Predicción "Siguiente probable" y orden por popularidad | Hecha y aprobada |
| Ajustes de venta rápida: rebaja por regateo, lista al cobrar, avisos de precio | **Hecha, esperando tu OK** |
| 3. Clientes/vendedores, código personal, fiado, cobro de deudas, comprobante | **Hecha, esperando tu OK** |
| Ganancias de hoy y rentabilidad (parte de la Fase 5) | **Hecha, esperando tu OK** |
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

## Ambigüedades y cómo las resolví (Fase 2)

1. **Reordenar al abrir la app.** SPEC §2.2 (a) dice que se reordena al abrir, pero la regla principal es que el orden no cambie mientras un ticket tenga productos. Si al abrir hay un cliente en espera con productos, se mantiene el orden guardado y se reordena después.
2. **Inicio del día.** Se reordena la primera vez después de medianoche en que ningún ticket tiene productos: al cobrar o al volver a la app si quedó abierta de noche.
3. **Anular una venta** también resta su aporte a la predicción, para que un error no infle las sugerencias.
4. **Ventas por hora** (`byHour`) son conteos simples, sin decaimiento, como dice DATA_MODEL §4.1. La popularidad y los pares sí decaen (vida media de 30 días).
5. **Sin historial no se sugiere nada.** La fila queda con espacios vacíos del mismo alto, para que la cuadrícula no se mueva cuando aparezcan las sugerencias.
6. **Texto de la sugerencia:** "+ nombre del producto" completo (por ejemplo "+ Aceite caja ×12"), en hasta 2 líneas. Con varias presentaciones del mismo producto, el nombre base sería ambiguo.
7. **Ventas de la Fase 1:** al actualizar, la migración de la BD (versión 2) reconstruye las estadísticas desde las ventas ya registradas. No se pierde nada.
8. **Datos de ejemplo:** el botón ahora carga los 10 productos y 300 ventas de los 30 días anteriores (nunca de hoy), con los pares frecuentes de DATA_MODEL §7. El stock final de cada producto no cambia.
9. **Espacio en pantalla:** con la fila de sugerencias, en un teléfono de 390×844 entran 11 productos y "Buscar" (4 filas).

## Venta rápida y sin errores (pedido del dueño)

1. **Rebaja por regateo:** botones de −S/ 1 a −S/ 5 en Cobrar, un toque. Es una rebaja **por ticket** (el total baja de S/ 1 a S/ 5). Solo aparece si el ticket tiene productos marcados "Admite rebaja por regateo" en Inventario. El máximo se cambia en Ajustes (No, S/ 1… S/ 5). La rebaja se reparte entre esos productos en céntimos exactos, para que la ganancia por producto sea real. Si prefieres que la rebaja sea **por unidad** (por ejemplo S/ 1 por saco), dímelo y lo cambio.
2. **Lista al cobrar:** Cobrar muestra cada producto con su cantidad en grande, para leérsela al cliente antes de cobrar y no cobrar de menos.
3. **Cambios de precio peligrosos:** poner un precio por debajo del costo, o bajarlo más que el máximo de rebaja por unidad, pide un segundo toque.
4. **Avisos que no tapan botones:** los mensajes de abajo ya no bloquean los toques sobre los botones; solo su "Deshacer" responde.
5. **×10:** se queda como antes: se aplica al siguiente toque de producto.

## Ambigüedades y cómo las resolví (Fase 3)

1. **Código de dueño:** se crea al abrir la app por primera vez (también al actualizar desde una versión anterior). Se pide para: fiado sobre el límite, anular ventas de días anteriores, cambiar o desbloquear el código de una persona, y cambiar el propio código de dueño.
2. **Límite 0 = sin fiado:** a una persona con límite 0 se le puede fiar solo con el código de dueño.
3. **Bloqueos:** 3 fallos seguidos bloquean 5 minutos; al llegar a 6 fallos en 24 horas solo el dueño puede desbloquear (en la ficha de la persona).
4. **Después de un fiado o un cobro** se abre el comprobante sellado (FIADO / PAGADO) con n.º de operación, "Íntegro/Modificado", Imprimir y WhatsApp. "Listo" vuelve a Vender.
5. **Anular un fiado** repone el stock y quita la deuda (el cargo queda anulado, no borrado).
6. **Tiempo de firma:** verificar el código tarda cerca de medio segundo a propósito (PBKDF2), para que adivinar códigos sea lento. El teclado muestra "Verificando…".
7. **El sello del comprobante** va debajo de los montos para no taparlos (en el mockup está encima).
8. **Datos de ejemplo:** Rosa Mamani (cliente, límite S/ 1,000) y Juan Quispe (cliente y vendedor, límite S/ 800), los dos con el código 2580.
9. **Nota de seguridad:** 4 dígitos son 10 000 combinaciones. La protección viene del bloqueo por intentos y de que la firma ocurre delante del dueño. No protege contra alguien que copie el archivo de la base de datos. Nunca se guarda el código, solo su hash.

## Ganancias y rentabilidad (pedido del dueño, adelantado de la Fase 5)

1. **Ganancias de hoy** (menú): ganancia del día después de gastos, lo vendido, la ganancia bruta (venta − costo de lo vendido), los gastos, el n.º de ventas y las rebajas dadas. Incluye la comparación con ayer, los gastos del día y lo que más ganancia dejó.
2. **Rentabilidad** (menú), en 7 días, 30 días o todo:
   - Una frase clara de si el negocio es rentable, comparada con el periodo anterior.
   - Una tarjeta con lo vendido, la ganancia bruta, los gastos y la ganancia neta.
   - Un gráfico de ganancia neta por día (por mes si el periodo es largo).
   - La lista de productos con veredicto.
3. **Veredicto por producto** (uno por producto, en este orden):
   - **Sin costo:** no tiene costo en Inventario, así que su ganancia no es real.
   - **Pierde:** se vendió con ganancia 0 o negativa.
   - **Sin ventas:** tiene stock pero no se vendió; muestra la plata parada.
   - **Margen bajo:** deja menos del 5 %.
   - **Se mueve lento:** tiene stock para más de 60 días.
   - **Estrella:** está entre los que juntos dejan la mitad de la ganancia.
   - **Bien:** el resto.

   Al tocar un producto se ve el consejo, los días de stock y el capital en stock.
4. **Gastos:** se registran con un toque (transporte, estiba, bolsas, comida, servicios, otros), en efectivo o Yape, y se anulan con motivo si hubo error.
5. **Gastos fijos del mes** (Ajustes): alquiler del puesto, luz, ayudante… Se reparten por día (mes de 30 días) para que la ganancia de cada día sea real. No hay que registrarlos además como gasto.
6. **Retiros del dueño** no cuentan como gasto (llegan con Caja, Fase 5).
7. **Qué cuenta como venta:** ventas pagadas y fiadas; las anuladas no cuentan. La ganancia usa el costo que tenía el producto al momento de vender.
8. **Gráficos:** en el gráfico diario, ganar o perder se ve por la posición de la barra (arriba o abajo del cero) y por el signo del monto, no solo por el color (verde y rojo se confunden con daltonismo). Cada barra se puede tocar, y hay vista de tabla.

## Propuestas (no implementadas; necesito tu decisión)

- **"Deshacer" después de cobrar.** La spec dice que anula el ticket y repone el stock. Eso funciona así. Pero si el error fue solo el método de pago (efectivo en vez de Yape), hay que volver a marcar todos los productos. Propongo que "Deshacer" anule la venta **y además devuelva los productos al ticket** para corregir y cobrar de nuevo. La anulación queda registrada igual.
- **Impresión en Android.** `window.print()` abre el diálogo de impresión de Android. Para una térmica de 58 mm hace falta un servicio de impresión instalado (por ejemplo, el de la marca de la impresora). La impresión directa sin diálogo es ESC/POS por Bluetooth (Fase 6). Si imprimes mucho, conviene adelantar esa parte.
