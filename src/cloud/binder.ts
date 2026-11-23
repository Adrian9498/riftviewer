// Carpeta pública en Supabase (tabla public_binders): publicar la tuya, quitarla y leer la de cualquiera.
import type { BinderData } from '../collection/binder';
import { newSlug, parseBinder } from '../collection/binder';
import { supabase } from './client';

export interface PublicBinder { slug: string; title: string; data: BinderData; updatedAt: string }

/** Tu carpeta publicada, o null. */
export async function myBinder(uid: string): Promise<{ slug: string; title: string; updatedAt: string } | null> {
  const sb = supabase(); if (!sb) return null;
  const { data, error } = await sb.from('public_binders').select('slug, title, updated_at').eq('user_id', uid).maybeSingle();
  if (error) throw error;
  return data ? { slug: data.slug, title: data.title, updatedAt: data.updated_at } : null;
}

/** Publica (o actualiza) tu carpeta. Devuelve el slug del enlace. */
export async function publishBinder(uid: string, title: string, data: BinderData): Promise<string> {
  const sb = supabase(); if (!sb) throw new Error('La nube no está configurada');
  const old = await myBinder(uid);
  const row = { title: title.trim().slice(0, 60), data, updated_at: new Date().toISOString() };
  if (old) {
    const { error } = await sb.from('public_binders').update(row).eq('slug', old.slug);
    if (error) throw error;
    return old.slug;
  }
  const slug = newSlug();
  const { error } = await sb.from('public_binders').insert({ slug, user_id: uid, ...row });
  if (error) throw error;
  return slug;
}

/** Quita tu carpeta: el enlace deja de funcionar. */
export async function unpublishBinder(uid: string): Promise<void> {
  const sb = supabase(); if (!sb) return;
  const { error } = await sb.from('public_binders').delete().eq('user_id', uid);
  if (error) throw error;
}

/** La carpeta de un enlace, o null si no existe. */
export async function fetchBinder(slug: string): Promise<PublicBinder | null> {
  const sb = supabase(); if (!sb || !/^[a-z0-9]{8,16}$/.test(slug)) return null;
  const { data, error } = await sb.from('public_binders').select('slug, title, data, updated_at').eq('slug', slug).maybeSingle();
  if (error) throw error;
  const d = data && parseBinder(data.data);
  return d ? { slug: data!.slug, title: data!.title || '', data: d, updatedAt: data!.updated_at } : null;
}

/** Enlace público de una carpeta. */
export const binderUrl = (slug: string, origin = 'https://riftviewer.com') => `${origin}/carpeta/#${slug}`;
