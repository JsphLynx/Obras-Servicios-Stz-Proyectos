# Procedencia de la edición pública

Edición preparada el **27/10/2026** para el repositorio `JsphLynx/Obras-Servicios-Stz-Proyectos`.

## Base de trabajo

Instantánea del proyecto Sites `Obras y Servicios | Proyectos | Piloto`, commit de origen `a54b151488131fc2ca06477abd0ed96beb35fcb3`. Es una referencia de trazabilidad del proyecto privado, no un commit descargable de este repositorio. La aceptación funcional es del 25/10/2026; la actualización documental posterior no alteró el alcance.

El usuario definió los objetivos, revisó los casos y aceptó la versión. El desarrollo y la documentación se realizaron con asistencia de IA, Sites, Neon y herramientas de pruebas de navegador. Este portfolio permite revisar el resultado y las decisiones, sin atribuir una implementación enteramente manual ni una implantación municipal.

## Adaptaciones para publicar

- Nombre y versión del paquete: `obras-servicios-stz-piloto`, `1.0.0`.
- Configuración real de hosting sustituida por una plantilla.
- Identificadores de rama de `lib/stz/db.ts` extraídos a variables obligatorias. Se conserva la verificación del entorno en PostgreSQL.
- Eliminada la excepción del origen privado en tres rutas; se conserva la exigencia del mismo origen.
- Destinos de tests QA convertidos en una lista explícita configurable; se exigen tres hosts distintos y el rol de conexión restringido.
- Incorporadas pruebas unitarias sin acceso de red para importes, parámetros, autorización y selección de entorno.
- Sustituidos informes privados por resúmenes públicos. Los PDF omiten el enlace privado y las instrucciones de acceso se ajustan a una demostración autorizada.
- Incorporados el modelo relacional, catálogo de metadatos, documentación de arquitectura y límites de ejecución.

Estas adaptaciones no se han desplegado sobre el piloto privado. Las comprobaciones de esta copia se indican en [pruebas](pruebas.md); los resultados históricos de sesiones reales corresponden al piloto aceptado.

## Derechos y componentes de terceros

Se conservan los avisos originales en `build/sites-vite-plugin.LICENSE` y `vendor/shadcn-tailwind-4.13.0.LICENSE.md`; las dependencias mantienen sus propias licencias. Este repositorio no añade una licencia global de código abierto ni concede derechos que no se hayan acordado expresamente. Su publicación como portfolio no equivale a una licencia MIT.
