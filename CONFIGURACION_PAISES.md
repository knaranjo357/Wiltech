# Configuración por país

La aplicación consulta GET `/wiltech/paises?pais_sede=Mexico` al iniciar la sesión y al cambiar el país de trabajo. Este GET debe permitir lectura a los usuarios autenticados del país: lo necesitan para aplicar módulos y ciudades.

Solo root ve «Configurar país». POST crea una configuración cuando no existe registro; PUT actualiza enviando `id_pais`, `pais_sede` y `configuracion` como objeto JSON. Ejemplo parcial (los módulos omitidos quedan desactivados cuando existe `modulos`):

```json
{
  "id_pais": 2,
  "pais_sede": "Mexico",
  "configuracion": {
    "version": 1,
    "modulos": { "crm": true, "agenda": true, "envios-colombia": false },
    "ciudades": []
  }
}
```

La pantalla guarda todos los módulos registrados. Las restricciones se aplican también a admin y root; root conserva siempre acceso a la configuración para reactivarlos. Con configuración null se habilitan los módulos existentes, excepto Envíos Colombia fuera de Colombia. Colombia propone Barrancabermeja, Barranquilla, Bogotá, Bucaramanga y Medellín; otros países comienzan sin ciudades hasta configurarlas.

En n8n, POST y PUT deben comprobar el rol root a partir de la identidad autenticada, además de validar los países autorizados. `jwtAuth` por sí solo no comprueba ese rol. Los endpoints de negocio también deben validar los permisos y el país en el servidor; ocultar páginas no bloquea llamadas directas. Estos cambios de servidor no se han ejecutado desde este proyecto.

## Diagramas

GET `/wiltech/diagnosticador/diagrama_diagnosticador` lleva `pais_sede`. La aplicación identifica los diagramas por `flow_name` (`diagnostico` o `reparacion`), conservando el ID de cada registro. Para México, los registros 3 y 4 se editan mediante PUT con sus IDs respectivos, `flow_name`, `pais_sede` y `configuracion`. Una configuración null se presenta vacía y editable, sin copiar datos de Colombia. Si falta una fila, se prepara un borrador local y solo se crea al publicar. Las respuestas de creación y actualización deben devolver la fila con ID, flow_name y pais_sede.

Verificación local: `npm test`, TypeScript y `npm run build`. No se modificaron datos en producción ni se probó una sesión real contra n8n.
