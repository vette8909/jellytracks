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
let allTracks = [];

async function fetchTracks(query = '') {
  loadingSpinner.hidden = false;
  tracksGrid.hidden = true;
  emptyState.hidden = true;

  try {
    const url = query ? `/api/tracks?search=${encodeURIComponent(query)}` : '/api/tracks';
    const res = await fetch(url);
    if (!res.ok) throw new Error('Failed to load tracks');
    const tracks = await res.json();
    renderTracks(tracks, query);
  } catch (err) {
    loadingSpinner.hidden = true;
    emptyState.hidden = false;
    emptyMessage.textContent = 'Could not load tracks';
    emptyHint.textContent = 'Check your connection and try again';
  }
}

function renderTracks(tracks, query) {
  loadingSpinner.hidden = true;

  if (query) {
    heroSection.style.display = 'none';
    sectionTitle.textContent = `Results for "${query}"`;
  } else {
    heroSection.style.display = '';
    sectionTitle.textContent = 'All Tracks';
  }

  if (tracks.length === 0) {
    tracksGrid.hidden = true;
    emptyState.hidden = false;
    if (query) {
      emptyMessage.textContent = `No results for "${query}"`;
      emptyHint.textContent = 'Try a different song title or artist name';
    } else {
      emptyMessage.textContent = 'No tracks yet';
      emptyHint.textContent = 'Upload a track to get started';
    }
    trackCount.hidden = true;
    return;
  }

  trackCount.textContent = `${tracks.length} track${tracks.length !== 1 ? 's' : ''}`;
  trackCount.hidden = false;

  tracksGrid.innerHTML = tracks.map(track => cardHTML(track)).join('');
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
  fetchTracks(q);
}

searchInput.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(doSearch, 300);
});

searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter') { clearTimeout(debounceTimer); doSearch(); }
});

searchBtn.addEventListener('click', () => { clearTimeout(debounceTimer); doSearch(); });

// Pre-fill search if arriving from the player page search redirect
const urlParams = new URLSearchParams(location.search);
const initialQuery = urlParams.get('search') || '';
if (initialQuery) searchInput.value = initialQuery;
fetchTracks(initialQuery);
