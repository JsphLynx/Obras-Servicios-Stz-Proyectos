# Migraciones incrementales

Estos archivos se conservan como parte del código del piloto. Requieren un esquema municipal previo y no son una exportación completa de la base 1.0. Los prefijos repetidos reflejan fases históricas; no son un instalador ordenado que deba ejecutarse a ciegas.

El modelo actual incluye 104 tablas distintas en la unión de ejemplos y prácticas. El catálogo de `docs/database/` documenta tablas, columnas y claves, pero no contiene todas las funciones, vistas, triggers, roles ni datos sintéticos necesarios para reconstruir el entorno.

Para provisionar una nueva instancia, prepara una exportación de esquema autorizada, revisa diferencias y permisos, configura los identificadores de rama y valida en una base desechable. No se distribuye un volcado de datos del piloto.
