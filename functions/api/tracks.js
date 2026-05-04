export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const search = url.searchParams.get('search')?.trim().toLowerCase() || '';

  const raw = await env.TRACKS_KV.get('tracks_index');
  let tracks = raw ? JSON.parse(raw) : [];

  if (search) {
    tracks = tracks.filter(t =>
      t.title.toLowerCase().includes(search) ||
      (t.artist || '').toLowerCase().includes(search)
    );
  }

  return Response.json(tracks, {
    headers: { 'Cache-Control': 'no-store' }
  });
}
