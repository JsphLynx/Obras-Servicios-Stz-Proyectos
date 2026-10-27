# Seguridad y tratamiento de datos

Este repositorio es una edición pública de un piloto de demostración. No incluye credenciales, destinos de bases privadas, identidades de participantes ni evidencias brutas de sesiones.

## Límites de confianza

La aplicación obtiene la identidad desde encabezados establecidos por la infraestructura autenticada de Sites. **No debe exponerse directamente en Internet con esos encabezados controlables por el cliente.** Un traslado a otro proveedor requiere una capa autenticada equivalente o adaptar y validar el sistema de identidad. El rol de negocio se comprueba en el servidor y los datos se consultan mediante conexiones restringidas.

Los ejemplos y las prácticas usan conexiones distintas, guardas de entorno y controles de escritura. Las prácticas son compartidas: no hay separación individual de filas entre editores. Utiliza únicamente información sintética en esta versión.

Los adjuntos se sirven mediante rutas autorizadas y almacenamiento privado. No introduzcas expedientes reales, documentos personales ni datos municipales sensibles en la demostración.

## Configuración local

`.env*`, `.dev.vars*`, `.openai/hosting.json`, volcados y resultados privados de pruebas se excluyen de Git. Las plantillas contienen campos vacíos. Configura secretos solo en el entorno de ejecución; nunca en el código cliente o en un issue.

## Comunicación de incidencias

Para una posible vulnerabilidad, utiliza un canal privado acordado con el responsable del repositorio antes de compartir detalles reproducibles. Los issues públicos se reservan para mejoras o errores sin información sensible. No se promete un programa de recompensas ni un plazo de respuesta.

La aceptación 1.0 no equivale a una auditoría de seguridad ni a autorización para tratar datos reales.
