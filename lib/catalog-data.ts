import {all,type Row} from './stz/db';
export type Catalogos=Record<string,Row[]>;
const tables={origenes:'origen_proyecto',estados:'estado_proyecto',departamentos:'departamento',tiposActuacion:'tipo_actuacion',estadosActuacion:'estado_actuacion',tiposElemento:'tipo_elemento',tiposContrato:'tipo_contrato',tiposGasto:'tipo_gasto'};
export async function loadCatalogos():Promise<Catalogos>{
 const rows=await all(Object.entries(tables).map(([key,table])=>`SELECT '${key}' name,to_jsonb(c) item FROM catalogo.${table} c WHERE activo`).join(' UNION ALL '));
 return Object.fromEntries(Object.keys(tables).map(key=>[key,rows.filter(r=>r.name===key).map(r=>r.item)]));
}
