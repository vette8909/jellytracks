import { loadTracksIndex } from '../utils.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const search = url.searchParams.get('search')?.trim().toLowerCase() || '';

  let tracks = await loadTracksIndex(env.TRACKS_KV);

  if (search) {
    tracks = tracks.filter(t =>
      t.title.toLowerCase().includes(search) ||
      (t.artist || '').toLowerCase().includes(search)
    );
  }

  return Response.json(tracks, { headers: { 'Cache-Control': 'no-store' } });
}
