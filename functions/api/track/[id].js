import { loadTracksIndex, saveTracksIndex } from '../../utils.js';

export async function onRequest({ request, env, params }) {
  const id = params.id;

  if (request.method === 'GET') {
    const tracks = await loadTracksIndex(env.TRACKS_KV);
    const track = tracks.find(t => t.id === id);
    if (!track) return Response.json({ error: 'Not found' }, { status: 404 });

    const videoUrl = `${env.R2_PUBLIC_URL}/${track.videoKey}`;
    return Response.json({ ...track, videoUrl }, { headers: { 'Cache-Control': 'no-store' } });
  }

  if (request.method === 'DELETE') {
    let body;
    try {
      body = await request.json();
    } catch {
      return Response.json({ error: 'Invalid request body' }, { status: 400 });
    }

    if (!body.password || body.password !== env.DELETE_PASSWORD) {
      return Response.json({ error: 'Incorrect password' }, { status: 401 });
    }

    const tracks = await loadTracksIndex(env.TRACKS_KV);
    const idx = tracks.findIndex(t => t.id === id);
    if (idx === -1) return Response.json({ error: 'Not found' }, { status: 404 });

    const [removed] = tracks.splice(idx, 1);
    await saveTracksIndex(env.TRACKS_KV, tracks);

    await Promise.all([
      removed.videoKey ? env.TRACKS_R2.delete(removed.videoKey).catch(() => {}) : Promise.resolve(),
      removed.thumbnailKey ? env.TRACKS_R2.delete(removed.thumbnailKey).catch(() => {}) : Promise.resolve()
    ]);

    return Response.json({ success: true });
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 });
}
