export function mode(){return typeof window!=='undefined'&&new URLSearchParams(window.location.search).get('environment')==='practice'?'practice':'examples';}
export function apiFetch(url:string,init:RequestInit={}){const headers=new Headers(init.headers);headers.set('x-stz-environment',mode());return fetch(url,{...init,headers,cache:'no-store'});}
export function documentUrl(id:number){return '/api/documents?id='+id+'&environment='+mode();}
