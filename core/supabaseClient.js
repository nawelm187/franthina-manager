/**
 * supabaseClient.js
 * Responsabilidad: única instancia del cliente de Supabase para toda la app.
 * Ningún otro archivo debe llamar a createClient() — todos usan este cliente
 * compartido (así la sesión de autenticación es una sola, consistente en
 * toda la aplicación, en vez de una por cada lugar que la necesite).
 */
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
import { SUPABASE_CONFIG } from './config.js';

export const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.publishableKey);
