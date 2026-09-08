# Contrato multipaís

La aplicación interpreta `pais_sede` del login como lista de permisos (CSV, arreglo JSON o texto `[Colombia,Mexico]`). Conserva los nombres exactos y elige el primer país al iniciar sesión. Solo root puede ver el selector y cambiar entre los países autorizados. Para los demás usuarios, únicamente el primer país asignado es operativo; se ignoran selecciones previas de otros países y se rechazan cambios a ellos.

En Usuarios, los actores sin root no ven la lista de países ni el permiso root. Los permisos de módulos deshabilitados en la configuración del país se ocultan en la tabla y en los formularios. Antes de guardar, se vuelve a consultar esa configuración para rechazar nuevas asignaciones deshabilitadas. Los permisos anteriores ocultos se conservan al editar otros datos, pero no habilitan acceso a módulos desactivados.

Las peticiones operativas envían un único `pais_sede` en query y, cuando hay escritura, también en el cuerpo JSON o formulario. Incluye prompts, reparaciones, envíos y archivos. WhatsApp usa `GET /wiltech/wppconnect?id_instancia=1&pais_sede=Colombia` (instancias 1 a 15).

En creación y modificación de usuarios, `query.pais_sede` es el país activo, mientras que `body.pais_sede` contiene los países autorizados del usuario destino, separados por comas. Solo root puede cambiar esa lista o asignar root. Un administrador crea usuarios en el país activo y conserva la lista existente al editar. Root hereda las funciones de admin.

## Cambios necesarios en n8n

El flujo compartido lista todos los usuarios y modifica por ID; el JWT de sesión mostrado contiene solo email. Las restricciones del frontend no protegen el acceso directo a estos endpoints. Antes de considerar completo el aislamiento del backend:

- Validar el JWT en listado, creación, modificación y cambio de contraseña. Los webhooks de modificación compartidos no incluyen `authentication`.
- Consultar el usuario autenticado por el email verificado del JWT y comprobar sus roles y países actuales en la base de datos.
- Rechazar países ausentes o no autorizados; no usar Colombia como fallback de autorización.
- Para actores sin root, limitar las operaciones al primer país asignado, aunque su registro histórico contenga varios países.
- Consultar la configuración vigente del país y rechazar nuevas asignaciones de permisos correspondientes a módulos deshabilitados. Mapear el permiso `envios` al módulo `envios-colombia`; comprobar los demás permisos por su módulo correspondiente.
- Filtrar usuarios por pertenencia del país activo en su lista, no por igualdad de toda la cadena CSV. Devolver `pais_sede` en cada fila.
- Validar el país del registro destino al consultar y modificar recursos, incluidos prompts, reparaciones y envíos.
- Solo root puede asignar root o modificar países. Validar que los países asignados estén entre los disponibles para el actor. Un administrador no puede modificar ni cambiar contraseñas de usuarios root.
- Al editar un usuario sin root, comparar y conservar su lista de países previa. No confiar en roles o permisos enviados por el navegador.

Estos cambios de n8n no se han desplegado desde este repositorio. Las pruebas locales verifican el contrato de las peticiones y los controles del frontend, no la autorización del servidor.
