import { loadTracksIndex, saveTracksIndex } from '../utils.js';

// Handles metadata + thumbnail only. Video is uploaded separately via PUT /api/video/:id.
export async function onRequestPost({ request, env }) {
  let formData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }

  const title = (formData.get('title') || '').trim();
  const artist = (formData.get('artist') || '').trim();
  const videoExt = sanitizeExt(formData.get('videoExt') || '.mp4');
  const thumbFile = formData.get('thumbnail');

  if (!title) return Response.json({ error: 'Title is required' }, { status: 400 });
  if (!artist) return Response.json({ error: 'Artist is required' }, { status: 400 });

  const id = crypto.randomUUID();
  const videoKey = `videos/${id}${videoExt}`;

  let thumbnailKey = null;
  let thumbnailUrl = null;

  if (thumbFile && typeof thumbFile !== 'string' && thumbFile.size > 0) {
    const key = `thumbnails/${id}.jpg`;
    try {
      await env.TRACKS_R2.put(key, thumbFile.stream(), {
        httpMetadata: { contentType: thumbFile.type || 'image/jpeg' }
      });
      thumbnailKey = key;
      thumbnailUrl = `${env.R2_PUBLIC_URL}/${key}`;
    } catch {}
  }

  const track = { id, title, artist, videoKey, thumbnailKey, thumbnailUrl, uploadedAt: new Date().toISOString() };
  const tracks = await loadTracksIndex(env.TRACKS_KV);
  tracks.unshift(track);
  await saveTracksIndex(env.TRACKS_KV, tracks);

  return Response.json({ success: true, id }, { status: 201 });
}

function sanitizeExt(ext) {
  const match = String(ext).match(/^\.[a-zA-Z0-9]{1,10}$/);
  return match ? match[0].toLowerCase() : '.mp4';
}
