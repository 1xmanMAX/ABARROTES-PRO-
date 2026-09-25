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
| Análisis económico: equilibrio, Pareto ABC, BCG, GMROI | **Hecha, esperando tu OK** |
| 4. Consignación: entregar y liquidar | **Hecha, esperando tu OK** |
| 5. Caja, compras, gastos, estadísticas, inicio | **Hecha, esperando tu OK** |
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

## Análisis económico (en Rentabilidad)

Cada indicador tiene su gráfico y un botón "¿Qué es?" con la explicación simple.

1. **Punto de equilibrio** (análisis costo-volumen-utilidad):
   - Ventas de equilibrio = gastos ÷ razón de margen de contribución.
   - Margen de contribución = (venta − costo de la mercadería) ÷ venta.
   - Los gastos incluyen los gastos fijos repartidos y los gastos registrados.
   - Muestra cuánto hay que vender al día para no perder, cuánto se vende en promedio y el **margen de seguridad**: cuánto pueden bajar las ventas antes de perder.
   - Gráfico: medidor (venta promedio frente a la marca de equilibrio).
2. **Pareto / clasificación ABC** (regla 80/20):
   - Clase A: los productos que juntos dejan el 80 % de la ganancia. Clase B: el siguiente 15 %. Clase C: el resto.
   - La clase se decide por dónde empieza cada producto en el acumulado.
   - Gráfico: barras ordenadas. La clase A va en verde y el resto en gris, con la letra siempre escrita. No usa doble eje.
3. **Matriz BCG** (Boston Consulting Group), **adaptada**:
   - En la matriz original, el eje horizontal es la participación de mercado frente al competidor más grande y el vertical es el crecimiento del mercado. Un puesto no tiene esos datos, así que se usan los propios:
     - Horizontal: la parte de la ganancia que deja el producto (alta si deja más que el promedio, 1 ÷ n.º de productos).
     - Vertical: el crecimiento de sus ventas frente al periodo anterior de igual largo.
   - Cuadrantes: Estrella, Vaca lechera, Interrogante y Perro.
   - Solo en 7 o 30 días (hace falta un periodo anterior). Un producto sin ventas antes cuenta como "nuevo" y va arriba.
   - Gráfico: puntos en 4 cuadrantes; tocar un punto muestra el detalle.
4. **GMROI y rotación de inventario** (comercio minorista):
   - GMROI = margen bruto anualizado ÷ stock a costo.
   - Rotación = costo de lo vendido anualizado ÷ stock a costo.
   - Menos de 1 en GMROI se marca como "rinde poco".
   - **Aproximación:** se usa el stock actual en lugar del stock promedio, porque la app todavía no guarda el stock de cada día.
   - Tabla por producto y resumen del negocio.
5. **En la lista de productos**, cada producto muestra su clase ABC y su cuadrante BCG. Al tocarlo se ven también el GMROI y la rotación.

## Ambigüedades y cómo las resolví (Fase 4)

1. **Entregar:** se eligen productos con + y − o tocando la cantidad. No hay que ir a la cuadrícula de Vender, porque en una entrega se llevan cantidades grandes de pocos productos. Solo se puede entregar lo que está libre: el stock menos lo que ya está en tickets abiertos.
2. **Precio pactado:**
   - Por defecto es el último precio pactado con ese vendedor; si no hay, el "precio para vendedores" del producto; si no hay, el precio de venta. Se cambia tocando el precio.
   - **Cada entrega recuerda el precio pactado** para la próxima. Esto no está en la spec; si prefieres que no lo recuerde, lo quito.
3. **Fecha de liquidación:** Mañana, en 3 días (por defecto) o en 7 días. Las vencidas se marcan en la ficha del vendedor.
4. **Liquidar** cierra todo lo pendiente de las entregas elegidas: lo que no se devuelve cuenta como vendido. No quedan entregas "a medias".
5. **La venta del vendedor:**
   - Se registra como una venta al fiado a su nombre ("Liquidación · Juan"), con el precio pactado y el costo que tenía el producto al entregarlo.
   - Cuenta en ganancias, rentabilidad y predicción.
   - No se anula desde Historial, porque devolvería stock que ya se contó.
6. **Comprobante:**
   - En la liquidación, "Debía" es el total a pagar (lo vendido más la deuda anterior), "Monto" es lo que paga y "Saldo pendiente" lo que queda, como en el mockup.
   - El sello dice PAGADO si pagó algo y FIADO si no pagó nada.
   - La entrega tiene sello RECIBIDO y no muestra saldos, porque no genera deuda.
7. **Historial de la persona:** incluye las entregas ("Recibió mercadería") con su comprobante.

## Ambigüedades y cómo las resolví (Fase 5)

1. **Saldo de caja:** es la suma de todos los movimientos en efectivo no anulados, desde siempre: saldo inicial + ventas + cobros + pagos de vendedores + aportes − compras − gastos − retiros ± ajustes de cierre. Yape/Plin se muestra aparte.
2. **Saldo inicial:** el botón aparece solo mientras no se haya registrado uno. Después, para poner plata se usa "Aporte".
3. **Retiros:** no dejan sacar más efectivo del que hay en caja. No cuentan como gasto, así que no bajan la ganancia.
4. **Cierre del día:** uno por día. Guarda lo esperado, lo contado y la diferencia. Si sobra o falta, registra un "Ajuste de cierre" para que la caja quede igual a lo contado.
5. **Compras:** suman al stock, restan de la caja (efectivo o Yape) y, por defecto, actualizan el costo del producto. La ganancia de ventas pasadas no cambia, porque cada venta guardó su costo.
6. **Anular movimientos:** gastos, retiros, aportes y saldo inicial se anulan en Caja con motivo. Las ventas, cobros y compras no se anulan desde ahí.
7. **Inicio:** agrega efectivo en caja, por cobrar (fiado y deudas de vendedores), mercadería con vendedores, stock bajo y entregas vencidas, además de lo que ya mostraba.
8. **Más estadísticas** (en Rentabilidad): ventas por hora del día, productos que se compran juntos (lo que usa "Siguiente probable"), deudores principales y rendimiento por vendedor (vendido y devuelto).

## Propuestas (no implementadas; necesito tu decisión)

- **"Deshacer" después de cobrar.** La spec dice que anula el ticket y repone el stock. Eso funciona así. Pero si el error fue solo el método de pago (efectivo en vez de Yape), hay que volver a marcar todos los productos. Propongo que "Deshacer" anule la venta **y además devuelva los productos al ticket** para corregir y cobrar de nuevo. La anulación queda registrada igual.
- **Impresión en Android.** `window.print()` abre el diálogo de impresión de Android. Para una térmica de 58 mm hace falta un servicio de impresión instalado (por ejemplo, el de la marca de la impresora). La impresión directa sin diálogo es ESC/POS por Bluetooth (Fase 6). Si imprimes mucho, conviene adelantar esa parte.
