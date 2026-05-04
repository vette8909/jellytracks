function escapeHTML(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function escapeAttr(str) {
  return String(str).replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

function getRecentlyPlayed() {
  const match = document.cookie.split('; ').find(c => c.startsWith('recently_played='));
  if (!match) return [];
  try { return JSON.parse(decodeURIComponent(match.slice('recently_played='.length))); }
  catch { return []; }
}

function addToRecentlyPlayed(id) {
  const ids = getRecentlyPlayed();
  const next = [id, ...ids.filter(i => i !== id)].slice(0, 20);
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString();
  document.cookie = `recently_played=${encodeURIComponent(JSON.stringify(next))}; expires=${expires}; path=/; SameSite=Lax`;
}
