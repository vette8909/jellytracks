export async function loadTracksIndex(kv) {
  const raw = await kv.get('tracks_index');
  return raw ? JSON.parse(raw) : [];
}

export async function saveTracksIndex(kv, tracks) {
  await kv.put('tracks_index', JSON.stringify(tracks));
}
