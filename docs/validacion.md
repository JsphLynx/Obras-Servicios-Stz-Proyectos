# Validación y aceptación de la versión 1.0

**Aceptada el 25/10/2026 por el usuario promotor para demostración y prácticas.** Resumen público derivado del acta y los informes del piloto. Se omiten identidades, destinos privados y registros brutos de sesiones.

| Criterio | Evidencia registrada | Alcance de la conclusión |
|---|---|---|
| 1. Diez ejemplos protegidos | Revisión del 23/10: 365 comprobaciones de coherencia. Comparación del 25/10: 475 filas en 37 tablas, cero ausencias y cero modificaciones. | Casos de referencia sintéticos conservados durante los ensayos. |
| 2. Prácticas aisladas | Altas y modificaciones persistidas en una rama distinta; comprobación posterior de originales. | Aislamiento respecto a ejemplos; las prácticas son compartidas entre usuarios autorizados. |
| 3. Manuales | Guía y diez fichas revisadas el 23/10, accesibles desde la aplicación. Dos PDF editados después como material de aprendizaje. | Documentación de referencia; las prácticas pueden tener cifras distintas. |
| 4. Permisos | Segunda cuenta real: PENDIENTE → LECTOR → EDITOR → BLOQUEADO. Creación y edición contrastadas con auditoría. | Lectura, escritura autorizada y rechazo posterior al bloqueo. |
| 5. Formularios y recorridos | Pruebas de interfaz y confirmación de persistencia: contratación operativa, ejecución, mantenimiento, facturas, pagos, borradores, archivos y CSV. | Recorridos disponibles en el piloto y datos sintéticos preparados. |

## Cómo se contrastó

Los ensayos con sesiones reales se combinaron con lecturas de Neon y auditoría. Los intentos de edición que no persistieron se descartaron y se repitieron. Las conclusiones se apoyan en los valores guardados, no solo en un mensaje visual de éxito.

En el circuito financiero se comprobó medición → certificación → factura → pago parcial → saldo final, incluido el rechazo de sobrepago. Una rectificación con devolución dejó facturado neto 96,80 €, pagado neto 96,80 € y pendiente 0 €.

Se ensayaron contrato compartido, subsanación de recepción, edición de plan preventivo, cierre y reapertura de correctivo y retirada de líneas en borradores. La adjudicación necesaria para un ensayo contractual se preparó como fixture SQL; no demuestra un formulario administrativo completo de adjudicación.

La subida y descarga real de un documento quedó confirmada por el usuario y por respuesta HTTP 200. No se recalculó de forma independiente la huella del archivo descargado en su PC. El CSV se descargó desde el botón de la aplicación con sesión real, se leyó y se contrastó; no se reconstruyó a partir de una tabla.

La revocación del editor se comprobó con su sesión abierta: las siguientes solicitudes quedaron bloqueadas. Eso no implica borrar información descargada previamente. La cuenta de ensayo terminó bloqueada; el administrador conservó su perfil.

## Pruebas automatizadas y límites

Se reutilizaron 17 pruebas integrales, 4 de acceso/documentos y 12 adicionales de rutas, con identidad QA simulada y almacenamiento simulado donde lo declara el harness. Complementan las sesiones reales; no las sustituyen. Las 31 pruebas SQL iniciales son históricas y no se presentan como la validación final.

Los informes originales y sus evidencias se conservan en el proyecto privado. Este resumen público no contiene todas las capturas, identificadores o registros; no constituye una auditoría externa ni una certificación de seguridad.

Los tests incorporados al repositorio permiten revisar el método. No se ejecutan automáticamente contra las bases del piloto. Las verificaciones de la copia pública se registran por separado en [pruebas](pruebas.md).

## Aceptación

> Sí, Confirmo que acepto los resultados y damos por terminada la versión 1.0 para demostración y prácticas.

Confirmación del usuario, 25/10/2026. La aceptación municipal para datos reales pertenece a otra etapa.
