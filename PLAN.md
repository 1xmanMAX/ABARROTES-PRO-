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
| 6a. Copia de seguridad cifrada + recordatorio semanal | **Hecha, esperando tu OK** |
| 6b. ESC/POS Bluetooth (opcional) | pendiente |
| 6c. Sincronización por Wi-Fi PC ⇄ celulares | **Hecha, esperando tu OK** |
| 6d. Grupo de aparatos con Nexo (celular ⇄ celular ⇄ PC, sin servidor) | **Hecha, falta probar en celulares reales** |

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

## Copia de seguridad (Fase 6a)

1. **Crear copia:**
   - Pide el código de dueño y arma un archivo `.json` cifrado (AES-GCM 256; clave con PBKDF2-SHA256, 600 000 iteraciones y sal aleatoria) con **todas** las tablas, fotos incluidas.
   - En el APK se abre el menú Compartir de Android (WhatsApp, Drive, correo). En Chrome se comparte o se descarga.
2. **Restaurar:**
   - Se elige el archivo y la app muestra su fecha y contenido (productos, ventas, personas).
   - Hay que confirmar que se **reemplazan todos los datos**, escribir el código de dueño actual y luego el código con el que se hizo la copia.
   - Se restaura en una sola transacción y la app se reinicia.
   - El código de dueño pasa a ser el de la copia.
   - Si el archivo es de una versión más nueva de la app, lo rechaza.
3. **Recordatorio semanal:** si hay datos y pasaron más de 7 días (o nunca se hizo), aparece un aviso en el Menú y en Inicio.

## Misma funcionalidad en PC y Android

1. **Pantallas anchas (PC, tablet):**
   - La cuadrícula de Vender usa tantas columnas como entren (tiles de hasta 150 px), así se ven todos los productos y "Buscar". En el teléfono siguen siendo 3 columnas.
   - Las demás pantallas se centran en un ancho cómodo.
   - Toda la app se centra en máximo 1000 px.
2. **Teclado físico:** los teclados de la app (montos, cantidades, códigos) también responden a las teclas 0–9, punto o coma, Retroceso y Enter (= Firmar en los códigos). Solo responde el teclado que está al frente, y nunca mientras se escribe en un campo de texto.
3. **Imprimir dentro del APK:**
   - Un plugin nativo (`PrinterPlugin.java`) recibe el HTML del recibo con sus estilos y lo manda al sistema de impresión de Android, el mismo que usa Chrome.
   - En el navegador se sigue usando el diálogo del navegador.
   - **No probado en un teléfono real:** solo se verificó que compila.
4. **Versión web publicada:** GitHub Pages en `https://1xmanmax.github.io/ABARROTES-PRO-/`. Hay que activarlo una vez (Settings → Pages → Source: GitHub Actions) y se publica desde `main`.
5. **Diferencias que quedan, por la naturaleza de cada plataforma:**
   - la PC no vibra;
   - la copia de seguridad se comparte en Android y se descarga en la PC;
   - la PC instalada con `pcinstalar-windows.ps1` y los celulares se sincronizan por Wi-Fi; la versión de GitHub Pages tiene sus propios datos (se pasan con la copia de seguridad).

## Sincronización por Wi-Fi (pedido del dueño)

Copiada de Canvas de Citas, que ya funciona bien en la PC y el celular del dueño.

1. **Quién guarda qué:** la PC es la casa de los datos. `pc/mi-bodega.exe` (arranca con Windows, unos 6 MB) guarda un JSON por tabla en `%LOCALAPPDATA%MiBodegadatos`, una base por aparato en `.sincro/` y un respaldo diario (30 días). La app de la PC es un aparato más: se sincroniza con su propio servidor por `127.0.0.1`.
2. **Vincular:** la PC muestra un QR con `mibodega-sync://IP:47482/#clave`. El APK lo escanea con el escáner de Google Play Services (`VinculoPlugin.java`, sin permiso de cámara) o se pega el código. Si la PC cambia de IP, el celular la busca en su red /24.
3. **Seguridad:** todo viaja cifrado con AES-256-GCM y la clave del QR, con la hora adentro (se rechaza lo que tenga más de 5 minutos de diferencia). El servidor solo entrega la app a la misma PC, y el firewall solo abre el puerto a la red local.
4. **Cuándo:** al abrir la app, cada 5 minutos (cada minuto en la PC), al volver a la app y unos segundos después de cada cambio (10 s en el celular, 3 s en la PC). Al mostrar el QR, la PC se sincroniza en el acto.
5. **Cómo se juntan los datos:** fusión a tres vías por registro y por campo contra la última base. Si ambos cambiaron lo mismo, gana el aparato que sincroniza; las fechas de modificación se quedan con la más reciente. **Nada se borra** al sincronizar: si un registro falta en un lado, se conserva el del otro, así que un celular reinstalado nunca borra datos de la PC.
6. **Stock, saldos y entregas no se fusionan, se recalculan:** son cachés de los movimientos de stock, la cuenta corriente y las liquidaciones. Así, si se vendió en el celular y en la PC a la vez, el stock descuenta las dos ventas. Hay un test que comprueba que el recálculo da lo mismo que guarda la app tras todo tipo de operaciones.
7. **Lo que no viaja:** las pestañas abiertas (cada aparato atiende a sus clientes), la caché de predicción (se reconstruye al recibir ventas), y de Ajustes el tema, el orden de la cuadrícula y la fecha de la última copia.
8. **Primera vez:** sin base, en lo que difiera gana la PC. Un celular nuevo puede vincularse desde la primera pantalla y recibe el código de dueño de la PC, en vez de crear otro.
9. **Si se cerró la caja el mismo día en dos aparatos,** vale el primer cierre.
10. **Correlativo de tickets:** cada aparato numera sus tickets del día, así que puede haber dos #0001 el mismo día (uno de cada aparato). Si te molesta, se puede agregar una letra por aparato.
11. **APK:** la app sigue en `https://localhost` (cambiar el esquema borraría los datos del teléfono) y llama a la PC por http con `allowMixedContent`; los datos van cifrados por la app.

## Visibilidad y velocidad de atención (pedido del dueño)

1. **Tiles sin foto:** se quitó la letra grande de fondo (casi todos decían "A" y tapaba el nombre). Ahora el nombre va grande arriba (hasta 3 líneas) y el precio abajo, sobre un velo oscuro que asegura el contraste.
2. **Lo que ya está en el ticket** se ve de un vistazo: borde dorado grueso y la cantidad grande en la esquina.
3. **Cobrar:** la lista de lo que lleva el cliente ya no se encoge a línea y media; la pantalla se desplaza entera.
4. **Contraste:** "Siguiente probable" con borde continuo (el punteado se perdía en modo oscuro), "Deshacer" desactivado más visible y pestañas de clientes con borde más marcado.
5. **PC:** la app usa hasta 1440 px. En Vender, el ticket queda fijo a la derecha. Escribir una letra abre Buscar con esa letra, y Enter agrega el primer resultado con stock.
6. **Arreglos:** las hojas ya no le quitaban el foco al campo de Buscar (en la PC había que hacer clic para escribir). `ui/Toast.tsx` pasó a `ui/ToastHost.tsx`: en Windows chocaba con `ui/toast.ts` y la app no compilaba.

## Rápido, confiable y fácil de ver (pedido del dueño, 2026-10-03)

Basado en el estudio de `docs/ESTUDIO-UX.md` (puntos de venta, niños, baja visión y color).

1. **Paleta nueva** (`styles/tokens.css`): todo texto ≥ 7:1 (AAA), porque al sol el contraste cae a menos de la mitad. Entra dinero en azul y sale dinero / fiado en naranja oscuro (seguros para daltónicos), siempre con signo o palabra. El dorado ya no lleva texto blanco (2.6:1); lleva tinta oscura.
2. **Letra:** Atkinson Hyperlegible Next y Mono (Braille Institute), incluidas en el paquete. Todo el texto pasó a `rem` (respeta la letra del sistema) con mínimo de 14 px. Ajuste propio: Normal 1 · Grande 1.15 · Muy grande 1.3.
3. **Tiles:** el texto ya no va sobre la foto ni sobre degradados (con arroz o azúcar el blanco quedaba en 1.4:1). Franja de color arriba, nombre y precio sobre fondo liso, precio en una línea (`cqi`). Sin stock dice **Agotado** en vez de apagarse. Con letra muy grande, 2 columnas.
4. **Modo Sol** (`data-contrast='sol'`): blanco y negro puros, bordes de 3 px. También con `prefers-contrast: more`.
5. **Cobro:** contar billetes tocándolos; vuelto dibujado en billetes y monedas (método codicioso, óptimo con las denominaciones del sol; las de 1 y 5 céntimos ya no circulan, el resto se muestra aparte); aviso contra Yape falso en el botón ("Sí llegó · Cobrar", sin toques extra).
6. **Pantalla de vuelto:** solo cuando hay vuelto en efectivo; se queda hasta "Listo" (el error más común con apuro es dar mal el vuelto). Sin vuelto sigue el aviso con Deshacer (ahora 6 s). La venta típica sigue en 5 toques.
7. **Cobro doble:** ya estaba protegido (el ticket deja de estar abierto dentro de la transacción); se agregó un test de dos cobros simultáneos.
8. **Modo ayudante:** ajuste de este aparato; solo vender (efectivo y Yape), sin precios, rebajas ni fiado, menú cerrado; salir pide el código de dueño. Las ventas quedan con `byHelper: true`.
9. **Voz:** `@capacitor-community/text-to-speech` en el APK (el WebView de Android no trae `speechSynthesis`) y Web Speech en la PC. Los montos se dicen en palabras ("475 soles con 50 céntimos"). Nunca lee códigos.
10. **Búsqueda tolerante:** 1 letra distinta (2 en términos largos) al comienzo de cada palabra.
11. **Ajustes de accesibilidad no se sincronizan** (`SYNC_SETTINGS` no los incluye): el teléfono del niño puede estar en modo ayudante y la PC no.

Pendiente de probar en el teléfono real: la voz con el modo avión, y que un niño cobre S/ 37 con un billete de S/ 50 sin ayuda.

## Grupo de aparatos con Nexo (pedido del dueño, 2026-10-04)

Nexo es la biblioteca de sincronización P2P del dueño ([THE-WORLD-NEX](https://github.com/1xmanMAX/THE-WORLD-NEX), fijada en `95caa90`). Decisión del dueño: **Nexo + respaldo**. El vínculo anterior por QR con la PC sigue funcionando debajo.

1. **Arquitectura: una "copia local" por aparato.**
   - Es la misma copia principal que ya tenía la PC (`pc/src/carpeta.rs` + `servidor.rs`).
   - La app web se sincroniza con su copia por `/sync/v2`, como antes, con la fusión a 3 vías y el recálculo de cachés ya probados.
   - Nexo, dentro de esa copia, la sincroniza **registro por registro** con los demás aparatos del grupo.
   - Así casi no cambió la app: el cliente de sincronización es el mismo.
2. **PC:** `mi-bodega.exe` abre Nexo junto al servidor (`iniciar_nexo`). Rutas nuevas: `/sync/nexo/estado` y `/sync/nexo/orden` (crear, unirse, expulsar, renovar, salir, sincronizar), cifradas con la misma clave.
3. **Android:** la misma copia y Nexo, compilados como biblioteca nativa (`pc/movil`, `libmibodega_movil.so`) y arrancados por `NodoPlugin.java`.
   - La copia escucha solo en `127.0.0.1` con un puerto libre.
   - Para encontrar a los demás usa **NsdManager** (`NsdPuente.java`, adaptado del `DescubrimientoNsd.kt` de Nexo) con MulticastLock. El mDNS en Rust no es confiable en celulares.
   - En la compilación automática de GitHub, Gradle compila la biblioteca (tarea `compilarNexo`, `app/android/compilar-nexo.sh`, solo con `CI=true`) con `cargo ndk` para `arm64-v8a` y `armeabi-v7a` (unos 9 MB cada una). No hay `x86_64`: solo sirve para emuladores.
4. **La copia principal ahora vive en memoria** (`Carpeta`): se lee una vez del disco.
   - La etiqueta de concurrencia es "arranque + generación", no un hash de los archivos.
   - Lo que llega por Nexo se guarda al disco en tandas, cada segundo.
   - Nexo escribe tomando el mismo candado que `/sync/v2/escribir`. Un guardado de la app nunca pisa lo que llegó en medio: la app recibe 409 y reintenta.
5. **Avisos a Nexo:** después de cada guardado de la app se calculan los registros que cambiaron (`nodo::diferencias`) y se avisan uno por uno. Con más de 2000 cambios se usa `revisar()`.
6. **Fusión en Nexo:** `Fusion3`, campo por campo. Si dos aparatos cambian el mismo campo, gana `updatedAt` mayor. Los cachés (stock, saldos) los vuelve a calcular la app al sincronizar, así que los aparatos convergen.
7. **La app nota lo nuevo en segundos:** cada 4 s mira la etiqueta de su copia (`refreshNexo`). Si cambió desde su último guardado, sincroniza. Con copia local, también sincroniza 2 s después de cada venta.
8. **Bases separadas** por destino (`'base'` para el vínculo QR y `'base-nodo'` para la copia del celular), para que no se mezclen.
9. **Firewall de Windows:** el instalador agrega una regla UDP (Nexo: QUIC 47500 y mDNS), además de la TCP 47482. Lo compilado de Rust va a `%LOCALAPPDATA%\MiBodega\compilacion` (más de 1 GB con Nexo).
10. **Pruebas:**
    - Rust: dos aparatos en grupo por la API real, con fusión de cambios simultáneos y expulsión, más un código equivocado.
    - E2E: dos instancias de `nodo_prueba` y dos navegadores. Uno crea el grupo, el otro se une con el código en minúsculas, recibe los productos y ve la venta del primero.

**Pendiente de probar en celulares reales:**
- que NSD encuentre a la PC y a otro celular en tu Wi-Fi;
- que la venta llegue en segundos;
- que "Sacar" un celular lo deje fuera.

Si el router aísla a los aparatos (red de invitados), no se encuentran. Hay "unirse por dirección", pero las sincronizaciones siguientes también necesitan que se encuentren.

**Límite conocido:** en Android, Nexo corre mientras el proceso de la app vive. Con la app cerrada del todo no sincroniza; lo hace al abrirla. La sincronización en segundo plano con WorkManager queda para después.

## Propuestas (no implementadas; necesito tu decisión)

- **Clave de la copia más larga:** la spec pide cifrar con el código de dueño, que tiene 4 dígitos (10 000 combinaciones). Dentro de la app hay bloqueo por intentos, pero quien robe el archivo puede probar las combinaciones en su computadora. Las 600 000 iteraciones lo vuelven lento (del orden de horas), no imposible. Propongo una **clave de copia aparte, de 6 o más caracteres**, que se pida solo al crear y restaurar copias. El riesgo es que, si el dueño la olvida, no puede restaurar.

- **"Deshacer" después de cobrar.** La spec dice que anula el ticket y repone el stock. Eso funciona así. Pero si el error fue solo el método de pago (efectivo en vez de Yape), hay que volver a marcar todos los productos. Propongo que "Deshacer" anule la venta **y además devuelva los productos al ticket** para corregir y cobrar de nuevo. La anulación queda registrada igual.
- **Impresión en Android.** `window.print()` abre el diálogo de impresión de Android. Para una térmica de 58 mm hace falta un servicio de impresión instalado (por ejemplo, el de la marca de la impresora). La impresión directa sin diálogo es ESC/POS por Bluetooth (Fase 6). Si imprimes mucho, conviene adelantar esa parte.
