# Prompt para Claude Code

Copia todo lo que está debajo de la línea y pégalo como primer mensaje en Claude Code, abierto dentro de esta carpeta.

---

Vas a construir **Mi Bodega**, una app de punto de venta para un puesto de abarrotes **por mayor** en un mercado muy concurrido en Perú. La usa una sola persona (el dueño) en su teléfono Android, de pie, atendiendo a varios clientes a la vez. La prioridad número uno es **vender rápido sin equivocarse**. Todo lo demás es secundario.

## Lee primero, en este orden

1. `CLAUDE.md`: reglas del proyecto, stack y convenciones. Son obligatorias.
2. `docs/SPEC.md`: especificación funcional completa, pantalla por pantalla, con criterios de aceptación.
3. `docs/DATA_MODEL.md`: entidades, campos, relaciones, invariantes y los algoritmos (predicción, código/firma, saldos).
4. `docs/DESIGN.md`: sistema visual (colores, tipografía, tamaños táctiles) y cómo leer los mockups.
5. `design/mockups-v2/*.dc.html`: los mockups aprobados de la versión 2. Son la referencia visual principal. Léelos como marcado HTML; no son componentes para copiar tal cual.
6. `design/prototipo-v1/mi-bodega-v1.html`: prototipo anterior en un solo archivo. Sirve de referencia de comportamiento (inventario, compras, caja, estadísticas). **No reutilices su arquitectura.**

## Cómo quiero que trabajes

- **Antes de escribir código**, dame un plan corto: estructura de carpetas, librerías exactas con versión y el orden de las fases de `docs/SPEC.md` §0. Enumera cualquier ambigüedad que encuentres en la spec y cómo propones resolverla. Espera mi OK.
- Construye **por fases** (SPEC §0). Al terminar cada fase: tests en verde, la app corre con `npm run dev`, y me das un resumen de qué probar a mano en el teléfono. No avances a la siguiente fase sin mi confirmación.
- Todo el texto de la interfaz va en **español de Perú**. El código (variables, funciones, tablas) va en inglés.
- Si una decisión de la spec te parece mala para la velocidad de venta o la seguridad del dinero, **dilo y propón una alternativa** en vez de implementarla en silencio.
- No agregues funciones que no estén en la spec sin preguntar.

## Lo que no se negocia

- Offline primero: la app debe funcionar completa sin internet.
- El dinero se maneja en **céntimos enteros**, nunca en decimales flotantes.
- Cada operación que toca stock, dinero o deudas es **atómica** (una sola transacción de base de datos).
- Nada se borra: se anula con motivo, y queda el rastro.
- El fiado, la entrega a vendedores y el cobro de deudas **exigen el código de la persona**. Sin código válido, la operación no se guarda.
- La cuadrícula de venta **no cambia de orden mientras se atiende a un cliente**. La predicción va en su propia fila (SPEC §2.3).

Empieza leyendo los archivos y dándome el plan.
