# Pruebas de la edición pública

Verificación local del **27/10/2026**, separada de la aceptación histórica del piloto.

| Comprobación | Resultado |
|---|---|
| `pnpm test:unit` / `node --test tests/unit.test.mjs` | 9 pruebas correctas, sin acceso de red ni datos externos. |
| `pnpm typecheck` / `tsc --noEmit` | Correcto, sin errores de TypeScript. |
| `pnpm build` / `node scripts/run-framework.mjs build` | Correcto: cinco fases de Vinext/Vite y seis rutas generadas. |
| PDF | Dos documentos, 10 y 14 páginas; revisión visual y comprobación de ausencia del enlace privado. |

Entorno de comprobación: Node.js 24.22.1, dependencias ya instaladas del mismo proyecto y lockfile, configuración de hosting local de ejemplo y sin conexiones a las bases del piloto. No se afirma una instalación desde cero verificada en todos los sistemas operativos.

## Pruebas unitarias sin infraestructura

Se comprueban precisión de céntimos y milésimas, rechazo de valores inválidos y desbordamientos, parámetros SQL fuera de texto entrecomillado, falta de sesión, prohibición de escritura para lectura o ejemplos, selección de conexión y guarda por entorno, rechazo cuando falta el identificador de rama, rechazo de conexiones coincidentes y coherencia del actor de auditoría.

Los mocks de estos tests no demuestran la disponibilidad de Neon ni sustituyen la validación del esquema. Se usan para detectar regresiones de lógica y de las adaptaciones públicas.

## Escenarios de integración conservados

| Archivo | Alcance |
|---|---|
| `tests/integral.test.mjs` | Recorrido operativo y controles HTTP con Neon real, identidad y bucket simulados. |
| `tests/access-documents.test.mjs` | Acceso y documentos mediante el harness QA. |
| `tests/remaining-flows.test.mjs` | Escenarios adicionales de rutas y operaciones. |
| `tests/demo-review-readonly.test.mjs` | Lectura de los ejemplos, manuales y contenidos sintéticos. |
| `tests/postgres.test.mjs` | Controles PostgreSQL de una fase previa sobre fixtures preparados. |

No se ejecutaron estos escenarios contra servicios externos al publicar el repositorio. Requieren bases QA preparadas, fixtures, perfiles de prueba y las funciones del esquema. Algunos modifican datos y no son aptos para ejecutarse contra datos reales.

El harness exige `QA_EXAMPLES_HOST`, `QA_PRACTICE_HOST` y `QA_AUTH_HOST`, distintos entre sí, y las conexiones correspondientes con rol `stz_runtime`. También requiere `STZ_EXAMPLES_BRANCH_ID` y `STZ_PRACTICE_BRANCH_ID`. Los valores se suministran mediante el mecanismo de entrada del runner; no deben publicarse en una línea de comando, log o issue.

`pnpm test:unit` solo ejecuta la suite sin infraestructura. No añadas las suites de integración a un `node --test` genérico sin preparar sus requisitos.

## Lo que estas comprobaciones no acreditan

No son una nueva prueba con sesiones reales, una auditoría de seguridad, una restauración desde copia ni una verificación en Azure. Las evidencias funcionales del piloto aceptado están resumidas en [validacion.md](validacion.md).
