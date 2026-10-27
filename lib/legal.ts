// Orientación limitada a contratos municipales ordinarios, reglas 2026–2027.
// Nunca sustituye una clasificación aprobada ni evalúa todos los requisitos LCSP.
export function orientacion(e:Record<string,any>){
 const y=Number(String(e.fecha_referencia_legal).slice(0,4)),t=Number(e.id_tipo_contrato),v=Number(e.valor_estimado_sin_iva);
 if(y<2026||y>2027)return {sara:'Revisar fecha',opciones:'Fuera del periodo de reglas 2026–2027',revision:'Actualizar los umbrales para la fecha del expediente.'};
 if(t===6)return {sara:'Revisión manual',opciones:'Contrato mixto · art. 18',revision:'Determinar la prestación principal y el régimen aplicable antes de clasificar.'};
 const umbral=t===1||t===4||t===5?5404000:t===2&&e.anexo_iv?750000:216000;
 const sara=v>=umbral?'Alcanza umbral SARA':'Bajo umbral SARA';
 if(t===4||t===5)return {sara,opciones:'Concesión · revisión específica',revision:'Comprobar transferencia del riesgo operacional (arts. 14–15), VEC y duración. No aplicar art. 118 ni 159.'};
 const opciones:string[]=[];
 if(v<(t===1?40000:15000)&&e.duracion_meses<=12&&!e.prorrogas)opciones.push('Menor: candidato por cuantía y duración');
 if(v<(t===1?80000:60000)&&!e.intelectual&&Number(e.juicio_valor)===0)opciones.push('159.6: candidato por cuantía y criterios');
 if((t===1?v<=2000000:v<140000)&&Number(e.juicio_valor)<=(e.intelectual?45:25))opciones.push('159.1: candidato por cuantía y criterios');
 return {sara,opciones:opciones.join(' · ')||'Estudiar procedimiento ordinario',revision:`Verificar objeto, VEC total con prórrogas/opciones, lotes, ausencia de fraccionamiento, crédito y requisitos del procedimiento.${e.intelectual?' Prestación intelectual: excluida de 159.6; revisar criterios de calidad (art. 145.4).':''}`};
}
