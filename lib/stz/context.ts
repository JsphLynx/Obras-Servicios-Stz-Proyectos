import {AsyncLocalStorage} from 'node:async_hooks';
export type Mode='examples'|'practice';
export type Role='ADMIN'|'EDITOR'|'LECTOR'|'PENDIENTE'|'BLOQUEADO';
export type Access={userId:string;email:string;role:Role;mode:Mode;canWrite:boolean};
export const requestContext=new AsyncLocalStorage<Access>();
export class AccessError extends Error {constructor(message:string,readonly status:number){super(message);}}
export function context(){const value=requestContext.getStore();if(!value)throw new AccessError('Sesión no autorizada',401);return value;}
export function checkWrite(){const c=context();if(!c.canWrite||c.mode!=='practice')throw new AccessError('Escritura no permitida. Usa Prácticas con un perfil editor o administrador.',403);return c;}
