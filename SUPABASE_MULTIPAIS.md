# Instalar las funciones

1. Ejecuta `resultados_multipais.sql` completo en SQL Editor. Crea `public.obtener_analisis_resultados_multipais` con seis argumentos; no reemplaza ni elimina la función anterior.
2. Ejecuta `migrar_clientes_historico_multipais.sql` completo. Crea la función administrativa de archivo; crearla no mueve datos.
3. Cambia el nodo HTTP de n8n a `/rest/v1/rpc/obtener_analisis_resultados_multipais`. Conserva el host y las credenciales del nodo existente. Usa el siguiente JSON Body en modo expresión:

```javascript
{{ {
  p_granularity: 'day',
  p_sede: 'ALL',
  p_source: 'ALL',
  p_fecha_desde: null,
  p_fecha_hasta: null,
  p_pais_sede: ($('resultados').item.json.query?.pais_sede ?? '').trim() || 'Colombia'
} }}
```

El frontend ya envía `pais_sede` en la consulta a `/resultadosdb`. La función toma Colombia cuando el argumento se omite, es NULL, vacío o solo espacios. El filtro se aplica antes del UNION ALL: también las sedes y canales de metaOptions pertenecen al país. Conserva la lógica original de fechas y métricas. Los registros con país NULL no se asignan implícitamente a Colombia.

## Consultas de comprobación de Resultados

```sql
select public.obtener_analisis_resultados_multipais();
select public.obtener_analisis_resultados_multipais(p_pais_sede => 'Colombia');
select public.obtener_analisis_resultados_multipais(p_pais_sede => 'Mexico');
select public.obtener_analisis_resultados_multipais(p_pais_sede => null);
select public.obtener_analisis_resultados_multipais(p_pais_sede => ' ');
```

Sin argumento, NULL y espacios deben coincidir con Colombia. Los nombres se comparan exactamente: usa `Mexico` si así está almacenado, no `México`.

## Ejecutar la migración

Desde SQL Editor con el propietario/administrador, o desde una tarea de servidor con los permisos necesarios:

```sql
select public.migrar_clientes_historico_multipais();
```

Esta llamada sí inserta en CLIENTES_2025 y elimina de CLIENTES. Devuelve el total archivado. Sustituye la llamada del job anterior por esta; no ejecutes el job antiguo y el nuevo a la vez.

Conserva tus reglas de antigüedad y lotes de 1000. Migra todos los países, copiando exactamente `pais_sede` y `ya_se_insistio`, incluso NULL. Los duplicados por row_number reciben ambos campos antes de borrar el origen. Si ese ID pertenece a otro contacto o a otro país, aborta sin confirmar la transacción. Los demás campos de duplicados conservan la versión ya archivada, igual que la lógica original.

Se asume que row_number identifica una sola fila en cada tabla, como en la función original. Si tus IDs se repiten por país, hay que usar una clave compuesta en las tablas y en todas las uniones. Ambas tablas deben tener las mismas columnas y tipos compatibles; los INSERT que compartiste ya incluyen los dos campos.

El lote usa bloqueos de filas y omite registros bloqueados por otros procesos; esos registros se recogerán en otra ejecución. Toda la llamada constituye una transacción, no un commit por lote. Los permisos/RLS siguen aplicando porque las funciones son SECURITY INVOKER. El filtro por país no sustituye la validación en n8n de los países autorizados del usuario.

Los scripts están preparados para instalar; no se han ejecutado en tu Supabase.
