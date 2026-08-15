/**
 * permissions.js
 * Responsabilidad: qué puede hacer cada rol — un único mapa, para no repetir
 * "if (role === 'admin' || role === 'manager')" desparramado por toda la app.
 *
 * IMPORTANTE — esto es solo la capa de experiencia (ocultar un botón que no
 * te sirve, no mostrarte un menú al que no vas a poder entrar). La barrera
 * de seguridad real son las políticas RLS en Supabase — cualquiera con las
 * herramientas del navegador puede saltarse un botón oculto, no una política
 * de base de datos. Ver franthina_schema_v030_roles.sql para lo que sí está
 * protegido del lado del servidor en esta versión.
 */
import { currentUser } from './currentUser.js';
import { APP_CONFIG } from './config.js';

const ROLE_PERMISSIONS = {
  admin:    { manageUsers: true,  manageSettings: true,  viewReports: true,  delete: true },
  manager:  { manageUsers: false, manageSettings: false, viewReports: true,  delete: true },
  employee: { manageUsers: false, manageSettings: false, viewReports: false, delete: false },
  pending:  { manageUsers: false, manageSettings: false, viewReports: false, delete: false },
};

/** @param {'manageUsers'|'manageSettings'|'viewReports'|'delete'} action */
export function can(action) {
  // Sin Supabase (modo local/demo) no hay roles ni sesión real — se
  // comporta como si fuera admin, igual que el resto de la app ya trata
  // ese modo (ver auth.js, storage/index.js). Este es el ÚNICO caso donde
  // se asume "sin restricciones": si hay sesión de Supabase pero por lo
  // que sea no se pudo leer el perfil, no se falla "abierto" — se trata
  // como el rol más restrictivo, no como admin.
  if (APP_CONFIG.storageAdapter !== 'supabase') return true;
  const role = currentUser.getCachedRole();
  return ROLE_PERMISSIONS[role]?.[action] ?? false;
}
