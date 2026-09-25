# Mi Bodega — paquete para Claude Code

## Qué hay aquí

```
PROMPT.md                 ← el mensaje que pegas en Claude Code
CLAUDE.md                 ← reglas del proyecto (Claude Code lo lee automáticamente)
docs/SPEC.md              ← qué debe hacer la app, pantalla por pantalla, por fases
docs/DATA_MODEL.md        ← tablas, relaciones, reglas y algoritmos (predicción, código/firma)
docs/DESIGN.md            ← colores, tipografía y guía de los mockups
design/mockups-v2/        ← las 6 pantallas aprobadas de la versión 2
design/mockups-v1/        ← Inicio, Inventario, Estadísticas y Caja (v1)
design/prototipo-v1/      ← el prototipo anterior en un solo HTML (referencia de comportamiento)
```

## Cómo usarlo

1. Descomprime esta carpeta y ábrela en la terminal.
2. Ejecuta `claude` (Claude Code) dentro de la carpeta.
3. Pega el contenido de `PROMPT.md` (lo que está debajo de la línea).
4. Claude Code te va a devolver un plan y preguntas. Revísalo y responde "OK" o pide cambios.
5. Construirá la app por fases (SPEC §0). Al final de cada fase te dirá qué probar en tu teléfono.

## Para probar en tu teléfono

- Con `npm run dev`, Claude Code te dará una dirección tipo `http://192.168.x.x:5173`. Ábrela en el Chrome del teléfono, conectado al mismo Wi-Fi.
- Para instalarla como app: menú de Chrome → "Agregar a pantalla principal".

## Decisiones que ya están tomadas (puedes cambiarlas antes de empezar)

- Es una **PWA** (se instala desde Chrome) y no una app de Play Store. Se construye más rápido, funciona sin internet y se actualiza sola.
- **Un solo teléfono** en v1, sin nube. La sincronización queda para la Fase 6.
- El código de firma tiene **4 dígitos**, con bloqueo después de 3 intentos fallidos.
- Moneda en soles, impresora de 58 mm por defecto.
