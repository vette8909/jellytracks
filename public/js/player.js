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

let allTracks = [];


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
    const track = await res.json();

    document.title = `${track.title} — JellyTracks`;
    videoTitle.textContent = track.title;
    videoArtist.textContent = track.artist || '';
    videoDate.textContent = track.uploadedAt ? formatDate(track.uploadedAt) : '';

    videoLoading.style.display = 'flex';
    videoPlayer.style.display = 'none';

    videoPlayer.src = track.videoUrl;
    videoPlayer.addEventListener('canplay', () => {
      videoLoading.style.display = 'none';
      videoPlayer.style.display = 'block';
    }, { once: true });
    videoPlayer.addEventListener('error', () => {
      videoLoading.innerHTML = '<p style="color:var(--text-muted);font-size:.9rem;">Could not load video</p>';
    }, { once: true });

    playerLayout.hidden = false;
    loadSidebar();
  } catch {
    showNotFound();
  }
}

async function loadSidebar(query = '') {
  const url = query ? `/api/tracks?search=${encodeURIComponent(query)}` : '/api/tracks';
  try {
    const res = await fetch(url);
    allTracks = await res.json();
    renderSidebar(allTracks);
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

// Handle search-on-arrival from home page redirect (player search bar)
const urlParams = new URLSearchParams(location.search);
if (urlParams.has('search')) {
  searchInput.value = urlParams.get('search');
}

loadTrack();
