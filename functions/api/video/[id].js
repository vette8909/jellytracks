import { loadTracksIndex } from '../../utils.js';

// Receives raw video body and streams it directly into R2 — no multipart parsing, no size limit.
export async function onRequestPut({ request, env, params }) {
  const tracks = await loadTracksIndex(env.TRACKS_KV);
  const track = tracks.find(t => t.id === params.id);
  if (!track) return Response.json({ error: 'Track not found' }, { status: 404 });

  try {
    await env.TRACKS_R2.put(track.videoKey, request.body, {
      httpMetadata: { contentType: request.headers.get('Content-Type') || 'video/mp4' }
    });
  } catch {
    return Response.json({ error: 'Failed to store video' }, { status: 500 });
  }

  return Response.json({ success: true });
}
