const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const tracksGrid = document.getElementById('tracksGrid');
const emptyState = document.getElementById('emptyState');
const emptyMessage = document.getElementById('emptyMessage');
const emptyHint = document.getElementById('emptyHint');
const loadingSpinner = document.getElementById('loadingSpinner');
const sectionTitle = document.getElementById('sectionTitle');
const trackCount = document.getElementById('trackCount');
const heroSection = document.getElementById('heroSection');

let debounceTimer = null;

async function loadHome() {
  loadingSpinner.hidden = false;
  tracksGrid.hidden = true;
  emptyState.hidden = true;
  heroSection.style.display = '';
  sectionTitle.textContent = 'Recently Performed';

  const ids = getRecentlyPlayed();
  if (ids.length === 0) {
    loadingSpinner.hidden = true;
    emptyState.hidden = false;
    emptyMessage.textContent = 'No recently performed tracks';
    emptyHint.textContent = 'Tracks you play will appear here';
    trackCount.hidden = true;
    return;
  }

  try {
    const res = await fetch('/api/tracks');
    if (!res.ok) throw new Error();
    const all = await res.json();
    const recent = ids.map(id => all.find(t => t.id === id)).filter(Boolean).slice(0, 12);
    renderTracks(recent, '');
  } catch {
    loadingSpinner.hidden = true;
    emptyState.hidden = false;
    emptyMessage.textContent = 'Could not load tracks';
    emptyHint.textContent = 'Check your connection and try again';
  }
}

async function fetchTracks(query) {
  loadingSpinner.hidden = false;
  tracksGrid.hidden = true;
  emptyState.hidden = true;
  heroSection.style.display = 'none';
  sectionTitle.textContent = `Results for "${query}"`;

  try {
    const res = await fetch(`/api/tracks?search=${encodeURIComponent(query)}`);
    if (!res.ok) throw new Error('Failed to load tracks');
    const tracks = await res.json();
    renderTracks(tracks, query);
  } catch {
    loadingSpinner.hidden = true;
    emptyState.hidden = false;
    emptyMessage.textContent = 'Could not load tracks';
    emptyHint.textContent = 'Check your connection and try again';
  }
}

function renderTracks(tracks, query) {
  loadingSpinner.hidden = true;

  if (tracks.length === 0) {
    tracksGrid.hidden = true;
    emptyState.hidden = false;
    if (query) {
      emptyMessage.textContent = `No results for "${query}"`;
      emptyHint.textContent = 'Try a different song title or artist name';
    } else {
      emptyMessage.textContent = 'No recently performed tracks';
      emptyHint.textContent = 'Tracks you play will appear here';
    }
    trackCount.hidden = true;
    return;
  }

  trackCount.textContent = `${tracks.length} track${tracks.length !== 1 ? 's' : ''}`;
  trackCount.hidden = query ? false : true;
  tracksGrid.innerHTML = tracks.map(cardHTML).join('');
  tracksGrid.hidden = false;
  emptyState.hidden = true;
}

function cardHTML(track) {
  const thumbContent = track.thumbnailUrl
    ? `<img src="${escapeAttr(track.thumbnailUrl)}" alt="" loading="lazy">`
    : `<div class="card-thumb-placeholder">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
          <rect x="2" y="2" width="20" height="20" rx="3"/>
          <polygon points="10 8 16 12 10 16 10 8" fill="currentColor" opacity="0.5" stroke="none"/>
        </svg>
       </div>`;

  const date = track.uploadedAt ? formatDate(track.uploadedAt) : '';

  return `
    <a href="/player.html?id=${escapeAttr(track.id)}" class="track-card">
      <div class="card-thumbnail">
        ${thumbContent}
        <div class="play-overlay">
          <svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
        </div>
      </div>
      <div class="card-info">
        <div class="card-title">${escapeHTML(track.title)}</div>
        <div class="card-artist">${escapeHTML(track.artist || '')}</div>
        <div class="card-date">${escapeHTML(date)}</div>
      </div>
    </a>`;
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return ''; }
}

function doSearch() {
  const q = searchInput.value.trim();
  if (q) {
    fetchTracks(q);
  } else {
    loadHome();
  }
}

searchInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(doSearch, 300);
});

searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { clearTimeout(debounceTimer); doSearch(); }
});

searchBtn.addEventListener('click', () => { clearTimeout(debounceTimer); doSearch(); });

const initialQuery = new URLSearchParams(location.search).get('search') || '';
if (initialQuery) {
  searchInput.value = initialQuery;
  fetchTracks(initialQuery);
} else {
  loadHome();
}
