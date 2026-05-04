export async function onRequest({ request, env, params }) {
  const id = params.id;

  if (request.method === 'GET') {
    const raw = await env.TRACKS_KV.get('tracks_index');
    const tracks = raw ? JSON.parse(raw) : [];
    const track = tracks.find(t => t.id === id);

    if (!track) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

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

    const raw = await env.TRACKS_KV.get('tracks_index');
    const tracks = raw ? JSON.parse(raw) : [];
    const idx = tracks.findIndex(t => t.id === id);

    if (idx === -1) {
      return Response.json({ error: 'Not found' }, { status: 404 });
    }

    const [removed] = tracks.splice(idx, 1);
    await env.TRACKS_KV.put('tracks_index', JSON.stringify(tracks));

    // Delete files from R2 (best-effort)
    if (removed.videoKey) {
      await env.TRACKS_R2.delete(removed.videoKey).catch(() => {});
    }
    if (removed.thumbnailUrl) {
      const thumbKey = `thumbnails/${id}.jpg`;
      await env.TRACKS_R2.delete(thumbKey).catch(() => {});
    }

    return Response.json({ success: true });
  }

  return Response.json({ error: 'Method not allowed' }, { status: 405 });
}
