import { loadTracksIndex } from '../utils.js';

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const search = url.searchParams.get('search')?.trim() || '';

  let tracks = await loadTracksIndex(env.TRACKS_KV);

  if (search) {
    tracks = tracks.filter(t => fuzzyMatch(search, `${t.title} ${t.artist || ''}`));
  }

  return Response.json(tracks, { headers: { 'Cache-Control': 'no-store' } });
}

// Every word in `query` must fuzzy-match at least one word in `text`.
// Words ≤3 chars require exact substring; longer words allow 1 typo per 4 chars.
function fuzzyMatch(query, text) {
  const qWords = query.toLowerCase().split(/\s+/).filter(Boolean);
  const tText = text.toLowerCase();

  // Fast path: exact substring
  if (tText.includes(query.toLowerCase())) return true;

  const tWords = tText.split(/\s+/).filter(Boolean);
  return qWords.every(qw => tWords.some(tw => wordMatch(qw, tw)));
}

function wordMatch(a, b) {
  if (b.includes(a) || a.includes(b)) return true;
  const maxDist = Math.floor(Math.max(a.length, b.length) / 4);
  if (maxDist === 0) return false;
  return editDistance(a, b) <= maxDist;
}

function editDistance(a, b) {
  if (Math.abs(a.length - b.length) > Math.max(a.length, b.length) / 2) return 99;
  const prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let cur = i;
    for (let j = 1; j <= b.length; j++) {
      const temp = cur;
      cur = a[i - 1] === b[j - 1]
        ? prev[j - 1]
        : 1 + Math.min(prev[j], cur, prev[j - 1]);
      prev[j - 1] = temp;
    }
    prev[b.length] = cur;
  }
  return prev[b.length];
}
