/**
 * auditLog.js
 * Responsabilidad: registrar quién hizo qué y cuándo, para acciones
 * importantes o irreversibles (eliminar un registro, cambiar un precio,
 * cancelar un pedido). Solo tiene efecto con Supabase — con localStorage
 * no hay "quién" que registrar (un solo dispositivo, sin usuarios reales).
 *
 * A propósito NUNCA rompe la acción que está registrando: si guardar el
 * log falla (sin conexión, etc.), la acción principal (borrar el producto,
 * confirmar la venta) ya se hizo y no debe revertirse ni mostrar error por
 * esto — el registro de auditoría es una mejora de trazabilidad, no un
 * requisito para que la operación real se complete.
 */
import { supabase } from './supabaseClient.js';
import { auth } from './auth.js';
import { APP_CONFIG } from './config.js';

/**
 * @param {{ action: string, entity: string, entityId?: string, details?: string }} entry
 *   action: verbo corto en español, ej. "Eliminó", "Modificó precio", "Canceló"
 *   entity: qué tipo de registro, ej. "producto", "pedido"
 *   entityId: id del registro afectado (opcional)
 *   details: texto libre con el detalle (ej. "$8.500 → $9.500"), opcional
 */
export async function logAction({ action, entity, entityId = null, details = '' }) {
  if (APP_CONFIG.storageAdapter !== 'supabase') return;
  try {
    const session = auth.getCachedSession();
    await supabase.from('system_logs').insert({
      data: {
        userEmail: session?.user?.email ?? 'desconocido',
        action,
        entity,
        entityId,
        details,
      },
    });
  } catch {
    // Nunca interrumpe la acción principal — ver comentario del archivo.
  }
}

/** Últimas acciones registradas, más nuevas primero — usado por la pestaña
 *  "Auditoría" de Reportes. Sin Supabase no hay nada que listar. */
export async function listRecentLogs(limit = 200) {
  if (APP_CONFIG.storageAdapter !== 'supabase') return [];
  const { data, error } = await supabase
    .from('system_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data.map((row) => ({ id: row.id, createdAt: row.created_at, ...row.data }));
}
