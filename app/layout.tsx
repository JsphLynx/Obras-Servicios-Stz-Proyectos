import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Obras y Servicios · Santurtzi',description:'Formularios y consultas de obras y mantenimiento de Santurtzi. Versión consolidada de Obras y Servicios, con ejemplos importados identificados.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="es"><body>{children}</body></html>;}
