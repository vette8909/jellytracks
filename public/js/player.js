const params = new URLSearchParams(location.search);
const trackId = params.get('id');

const playerLayout = document.getElementById('playerLayout');
const notFound = document.getElementById('notFound');
const videoPlayer = document.getElementById('videoPlayer');
const videoLoading = document.getElementById('videoLoading');
const videoTitle = document.getElementById('videoTitle');
const videoArtist = document.getElementById('videoArtist');
const videoDate = document.getElementById('videoDate');
const sidebarList = document.getElementById('sidebarList');
const sidebarSearch = document.getElementById('sidebarSearch');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const fullscreenBtn = document.getElementById('fullscreenBtn');
const deleteBtn = document.getElementById('deleteBtn');
const deleteModal = document.getElementById('deleteModal');
const deletePassword = document.getElementById('deletePassword');
const deleteCancelBtn = document.getElementById('deleteCancelBtn');
const deleteConfirmBtn = document.getElementById('deleteConfirmBtn');
const deleteError = document.getElementById('deleteError');

let currentTrack = null;
let sidebarSearchActive = false;

// Words treated as related for worship music suggestions
const WORSHIP_WORDS = new Set([
  'holy', 'spirit', 'ghost', 'god', 'lord', 'jesus', 'christ', 'savior',
  'king', 'father', 'heaven', 'praise', 'worship', 'hallelujah', 'glory',
  'grace', 'mercy', 'amen', 'forever', 'blessed', 'blessing', 'divine',
  'faithful', 'righteousness', 'redeemer', 'sanctuary', 'lifted', 'exalt',
]);

const STOP_WORDS = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with',
  'by','i','my','me','you','your','it','is','be','are','was','this',
]);

function titleWords(str) {
  return (str || '').toLowerCase().match(/\b[a-z]{3,}\b/g)?.filter(w => !STOP_WORDS.has(w)) ?? [];
}

// "grave" matches "graves" (substring) or within 1 edit for longer words
function wordSimilar(a, b) {
  if (a === b) return true;
  if (b.includes(a) || a.includes(b)) return true;
  const len = Math.max(a.length, b.length);
  const maxDist = Math.floor(len / 4);
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
      cur = a[i - 1] === b[j - 1] ? prev[j - 1] : 1 + Math.min(prev[j], cur, prev[j - 1]);
      prev[j - 1] = temp;
    }
    prev[b.length] = cur;
  }
  return prev[b.length];
}

function scoreTrack(candidate, current) {
  if (candidate.id === current.id) return -1;

  let score = 0;

  if (candidate.artist && current.artist &&
      candidate.artist.trim().toLowerCase() === current.artist.trim().toLowerCase()) {
    score += 100;
  }

  const curWords = titleWords(current.title);
  const canWords = titleWords(candidate.title);
  for (const cw of curWords) {
    if (canWords.some(tw => wordSimilar(cw, tw))) score += 15;
  }

  // Worship cluster: if both tracks mention any worship keyword, they're related
  const curHasWorship = curWords.some(w => WORSHIP_WORDS.has(w));
  const canHasWorship = canWords.some(w => WORSHIP_WORDS.has(w));
  if (curHasWorship && canHasWorship) score += 10;

  return score;
}

function getSuggestions(allTracks, current) {
  return allTracks
    .map(t => ({ track: t, score: scoreTrack(t, current) }))
    .filter(({ score }) => score >= 0)
    .sort((a, b) => b.score - a.score)
    .map(({ track }) => track);
}

function formatDate(iso) {
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  } catch { return ''; }
}

async function loadTrack() {
  if (!trackId) { showNotFound(); return; }

  try {
    const res = await fetch(`/api/track/${encodeURIComponent(trackId)}`);
    if (!res.ok) { showNotFound(); return; }
    currentTrack = await res.json();

    document.title = `${currentTrack.title} — JellyTracks`;
    videoTitle.textContent = currentTrack.title;
    videoArtist.textContent = currentTrack.artist || '';
    videoDate.textContent = currentTrack.uploadedAt ? formatDate(currentTrack.uploadedAt) : '';

    videoLoading.style.display = 'flex';
    videoPlayer.style.display = 'none';

    videoPlayer.src = currentTrack.videoUrl;
    videoPlayer.addEventListener('canplay', () => {
      videoLoading.style.display = 'none';
      videoPlayer.style.display = 'block';
    }, { once: true });
    videoPlayer.addEventListener('error', () => {
      videoLoading.innerHTML = '<p style="color:var(--text-muted);font-size:.9rem;">Could not load video</p>';
    }, { once: true });

    addToRecentlyPlayed(trackId);
    playerLayout.hidden = false;
    loadSidebar();
  } catch {
    showNotFound();
  }
}

async function loadSidebar(query = '') {
  sidebarSearchActive = query.length > 0;
  const url = query ? `/api/tracks?search=${encodeURIComponent(query)}` : '/api/tracks';
  try {
    const res = await fetch(url);
    const tracks = await res.json();
    if (sidebarSearchActive || !currentTrack) {
      renderSidebar(tracks);
    } else {
      renderSidebar(getSuggestions(tracks, currentTrack));
    }
  } catch {
    sidebarList.innerHTML = '<p style="color:var(--text-faint);font-size:.82rem;padding:10px 0;">Could not load tracks</p>';
  }
}

function renderSidebar(tracks) {
  if (tracks.length === 0) {
    sidebarList.innerHTML = '<p style="color:var(--text-faint);font-size:.82rem;padding:10px 0;">No tracks found</p>';
    return;
  }

  sidebarList.innerHTML = tracks.map(t => {
    const isActive = t.id === trackId;
    const thumb = t.thumbnailUrl
      ? `<img src="${escapeAttr(t.thumbnailUrl)}" alt="" loading="lazy">`
      : `<div class="sidebar-thumb-placeholder"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="2" width="20" height="20" rx="3"/><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" opacity="0.5" stroke="none"/></svg></div>`;

    return `
      <a href="/player.html?id=${escapeAttr(t.id)}" class="sidebar-item${isActive ? ' active' : ''}">
        <div class="sidebar-thumb">${thumb}</div>
        <div class="sidebar-info">
          <div class="sidebar-track-title">${escapeHTML(t.title)}</div>
          <div class="sidebar-track-artist">${escapeHTML(t.artist || '')}</div>
        </div>
      </a>`;
  }).join('');
}

function showNotFound() {
  notFound.hidden = false;
  playerLayout.hidden = true;
}

// Header search → go to home with query
searchInput.addEventListener('keydown', e => {
  if (e.key === 'Enter' && searchInput.value.trim()) {
    location.href = `/?search=${encodeURIComponent(searchInput.value.trim())}`;
  }
});
searchBtn.addEventListener('click', () => {
  if (searchInput.value.trim()) {
    location.href = `/?search=${encodeURIComponent(searchInput.value.trim())}`;
  }
});

// Sidebar search
let debounce = null;
sidebarSearch.addEventListener('input', () => {
  clearTimeout(debounce);
  debounce = setTimeout(() => loadSidebar(sidebarSearch.value.trim()), 300);
});

// Fullscreen
fullscreenBtn.addEventListener('click', () => {
  if (videoPlayer.requestFullscreen) videoPlayer.requestFullscreen();
  else if (videoPlayer.webkitRequestFullscreen) videoPlayer.webkitRequestFullscreen();
});

// Delete
deleteBtn.addEventListener('click', () => {
  deletePassword.value = '';
  deleteError.textContent = '';
  deleteError.classList.remove('show');
  deleteModal.classList.add('show');
  deletePassword.focus();
});

deleteCancelBtn.addEventListener('click', () => deleteModal.classList.remove('show'));

deleteModal.addEventListener('click', e => {
  if (e.target === deleteModal) deleteModal.classList.remove('show');
});

deleteConfirmBtn.addEventListener('click', async () => {
  const pwd = deletePassword.value;
  if (!pwd) {
    deleteError.textContent = 'Please enter the delete password.';
    deleteError.classList.add('show');
    return;
  }

  deleteConfirmBtn.disabled = true;
  deleteConfirmBtn.textContent = 'Deleting...';
  deleteError.classList.remove('show');

  try {
    const res = await fetch(`/api/track/${encodeURIComponent(trackId)}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password: pwd })
    });

    if (res.ok) {
      location.href = '/';
    } else {
      const data = await res.json().catch(() => ({}));
      deleteError.textContent = data.error || 'Incorrect password.';
      deleteError.classList.add('show');
      deleteConfirmBtn.disabled = false;
      deleteConfirmBtn.textContent = 'Delete Track';
    }
  } catch {
    deleteError.textContent = 'An error occurred. Please try again.';
    deleteError.classList.add('show');
    deleteConfirmBtn.disabled = false;
    deleteConfirmBtn.textContent = 'Delete Track';
  }
});

const urlParams = new URLSearchParams(location.search);
if (urlParams.has('search')) searchInput.value = urlParams.get('search');

loadTrack();
