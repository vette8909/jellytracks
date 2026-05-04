export async function onRequestPost({ request, env }) {
  let formData;
  try {
    formData = await request.formData();
  } catch {
    return Response.json({ error: 'Invalid request' }, { status: 400 });
  }

  const title = (formData.get('title') || '').trim();
  const artist = (formData.get('artist') || '').trim();
  const videoFile = formData.get('video');
  const thumbFile = formData.get('thumbnail');

  if (!title) return Response.json({ error: 'Title is required' }, { status: 400 });
  if (!artist) return Response.json({ error: 'Artist is required' }, { status: 400 });
  if (!videoFile || typeof videoFile === 'string') {
    return Response.json({ error: 'Video file is required' }, { status: 400 });
  }

  const id = crypto.randomUUID();
  const videoExt = getExtension(videoFile.name || 'video.mp4');
  const videoKey = `videos/${id}${videoExt}`;

  try {
    await env.TRACKS_R2.put(videoKey, videoFile.stream(), {
      httpMetadata: { contentType: videoFile.type || 'video/mp4' }
    });
  } catch (err) {
    return Response.json({ error: 'Failed to store video' }, { status: 500 });
  }

  let thumbnailUrl = null;
  if (thumbFile && typeof thumbFile !== 'string' && thumbFile.size > 0) {
    const thumbKey = `thumbnails/${id}.jpg`;
    try {
      await env.TRACKS_R2.put(thumbKey, thumbFile.stream(), {
        httpMetadata: { contentType: thumbFile.type || 'image/jpeg' }
      });
      thumbnailUrl = `${env.R2_PUBLIC_URL}/${thumbKey}`;
    } catch {
      // Non-fatal: track still uploads without thumbnail
    }
  }

  const track = {
    id,
    title,
    artist,
    videoKey,
    thumbnailUrl,
    uploadedAt: new Date().toISOString()
  };

  const raw = await env.TRACKS_KV.get('tracks_index');
  const tracks = raw ? JSON.parse(raw) : [];
  tracks.unshift(track);
  await env.TRACKS_KV.put('tracks_index', JSON.stringify(tracks));

  return Response.json({ success: true, id }, { status: 201 });
}

function getExtension(filename) {
  const match = filename.match(/\.[a-zA-Z0-9]+$/);
  return match ? match[0].toLowerCase() : '.mp4';
}
