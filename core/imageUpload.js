/**
 * imageUpload.js
 * Responsabilidad: convertir un archivo elegido por la persona (foto desde
 * el celular/compu) en una URL usable como imageUrl de un producto.
 *
 * En modo Supabase, sube el archivo de verdad a Storage y devuelve la URL
 * pública. En modo local (sin Supabase) no hay ningún backend de archivos
 * que ofrecer — se convierte la imagen a una data URL (el archivo
 * "embebido" como texto) y se guarda directo en el producto, igual que
 * cualquier otra URL pegada a mano. Funciona para imágenes chicas; por eso
 * el límite de tamaño es mucho más chico en ese modo.
 *
 * Antes de subir, la imagen se redimensiona y comprime en el navegador
 * (Canvas). Una cámara de celular normal saca fotos de 8-15 MB — sin esto,
 * la mayoría de las fotos reales rebotarían contra el límite de tamaño
 * antes de llegar a subirse. Comprimida a ~1600px de lado más largo queda
 * de sobra para verse bien en la tienda, y baja a unos cientos de KB.
 */
import { storage } from './storage/index.js';

const MAX_SIZE_CLOUD = 5 * 1024 * 1024;   // 5 MB — límite final, después de comprimir
const MAX_SIZE_LOCAL = 1.5 * 1024 * 1024; // localStorage tiene mucho menos espacio total disponible
const MAX_DIMENSION = 1600;               // px, lado más largo
const JPEG_QUALITY = 0.82;
const SKIP_COMPRESSION_UNDER = 400 * 1024; // ya viene liviana — no hace falta reprocesarla

/**
 * @param {File} file
 * @returns {Promise<string>} la URL para guardar como imageUrl del producto
 */
export async function uploadProductImage(file) {
  if (!file.type.startsWith('image/')) {
    throw new Error('El archivo tiene que ser una imagen (JPG, PNG, WEBP...).');
  }

  const processed = await compressImageIfNeeded(file);

  if (storage.supportsFileUploads()) {
    if (processed.size > MAX_SIZE_CLOUD) {
      throw new Error(`La imagen sigue pesando demasiado incluso comprimida (máximo ${formatMb(MAX_SIZE_CLOUD)}). Probá con otra foto.`);
    }
    return storage.uploadProductImage(processed);
  }

  if (processed.size > MAX_SIZE_LOCAL) {
    throw new Error(`En modo local, la imagen no puede pesar más de ${formatMb(MAX_SIZE_LOCAL)} incluso comprimida. Probá con otra foto, o conectá Supabase para subir imágenes más grandes.`);
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
    reader.readAsDataURL(processed);
  });
}

/**
 * Redimensiona (máximo 1600px de lado) y recomprime como JPEG vía Canvas.
 * Si algo del proceso falla (formato raro, navegador viejo sin soporte),
 * se sube el archivo original tal cual en vez de romper la subida entera
 * por un problema en un paso que solo existe para optimizar.
 */
async function compressImageIfNeeded(file) {
  if (file.size <= SKIP_COMPRESSION_UNDER) return file;
  try {
    const bitmap = await loadImage(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY));
    if (!blob || blob.size >= file.size) return file; // la compresión no ayudó — usar el original
    const newName = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], newName, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen.')); };
    img.src = url;
  });
}

function formatMb(bytes) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
