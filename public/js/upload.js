const form = document.getElementById('uploadForm');
const videoFileInput = document.getElementById('videoFile');
const thumbFileInput = document.getElementById('thumbFile');
const videoDropZone = document.getElementById('videoDropZone');
const thumbDropZone = document.getElementById('thumbDropZone');
const videoFileSelected = document.getElementById('videoFileSelected');
const videoFileName = document.getElementById('videoFileName');
const thumbPreview = document.getElementById('thumbPreview');
const thumbCanvas = document.getElementById('thumbCanvas');
const thumbVideo = document.getElementById('thumbVideo');
const uploadProgress = document.getElementById('uploadProgress');
const progressBar = document.getElementById('progressBar');
const progressText = document.getElementById('progressText');
const alertSuccess = document.getElementById('alertSuccess');
const alertError = document.getElementById('alertError');
const submitBtn = document.getElementById('submitBtn');

let thumbBlob = null;
let manualThumbObjectUrl = null;

[videoDropZone, thumbDropZone].forEach(zone => {
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragover'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragover'));
  zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('dragover'); });
});

videoFileInput.addEventListener('change', () => {
  const file = videoFileInput.files[0];
  if (!file) return;

  videoFileName.textContent = file.name;
  videoFileSelected.classList.add('show');

  const objectUrl = URL.createObjectURL(file);
  thumbVideo.src = objectUrl;
  thumbVideo.addEventListener('loadedmetadata', () => {
    thumbVideo.currentTime = Math.min(1, thumbVideo.duration * 0.1);
  }, { once: true });
  thumbVideo.addEventListener('seeked', captureFrame, { once: true });
});

function captureFrame() {
  try {
    const w = thumbVideo.videoWidth || 640;
    const h = thumbVideo.videoHeight || 360;
    thumbCanvas.width = w;
    thumbCanvas.height = h;
    thumbCanvas.getContext('2d').drawImage(thumbVideo, 0, 0, w, h);
    thumbPreview.classList.add('show');
    thumbCanvas.toBlob(blob => { thumbBlob = blob; }, 'image/jpeg', 0.85);
    URL.revokeObjectURL(thumbVideo.src);
  } catch {
    // Auto-thumbnail unavailable (e.g. unsupported codec) — ignore
  }
}

thumbFileInput.addEventListener('change', () => {
  const file = thumbFileInput.files[0];
  if (!file) return;

  thumbBlob = file;
  thumbPreview.classList.add('show');
  thumbCanvas.style.display = 'none';

  if (manualThumbObjectUrl) URL.revokeObjectURL(manualThumbObjectUrl);
  manualThumbObjectUrl = URL.createObjectURL(file);

  let img = thumbPreview.querySelector('img.manual-thumb');
  if (!img) {
    img = document.createElement('img');
    img.className = 'manual-thumb';
    img.style.cssText = 'width:100%;max-height:200px;object-fit:cover;display:block;';
    thumbPreview.appendChild(img);
  }
  img.src = manualThumbObjectUrl;
});

form.addEventListener('submit', async e => {
  e.preventDefault();
  clearAlerts();

  const title = document.getElementById('songTitle').value.trim();
  const artist = document.getElementById('artistName').value.trim();
  const videoFile = videoFileInput.files[0];

  if (!title) { showError('Please enter a song title.'); return; }
  if (!artist) { showError('Please enter an artist name.'); return; }
  if (!videoFile) { showError('Please select a video file.'); return; }

  setUploading(true, 'Saving track info...');

  try {
    // Step 1: upload metadata + thumbnail (small request)
    const meta = new FormData();
    meta.append('title', title);
    meta.append('artist', artist);
    meta.append('videoExt', getExtension(videoFile.name));
    if (thumbBlob) meta.append('thumbnail', thumbBlob, 'thumbnail.jpg');

    const metaRes = await fetch('/api/upload', { method: 'POST', body: meta });
    if (!metaRes.ok) {
      const d = await metaRes.json().catch(() => ({}));
      throw new Error(d.error || `Server error (${metaRes.status})`);
    }
    const { id } = await metaRes.json();

    // Step 2: stream video directly to R2 — no size limit
    await uploadVideo(videoFile, id);

    showSuccess(`Track uploaded! <a href="/player.html?id=${id}" style="color:var(--cyan-light);text-decoration:underline;">Play it now</a>`);
    form.reset();
    videoFileSelected.classList.remove('show');
    thumbPreview.classList.remove('show');
    thumbBlob = null;
    progressBar.style.width = '0%';
  } catch (err) {
    showError(err.message || 'Upload failed. Please try again.');
  } finally {
    setUploading(false);
  }
});

function uploadVideo(file, id) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', `/api/video/${encodeURIComponent(id)}`);
    xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');

    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        progressBar.style.width = `${pct}%`;
        progressText.textContent = pct < 100
          ? `Uploading video... ${pct}% (${(e.loaded / 1024 / 1024).toFixed(0)} / ${(e.total / 1024 / 1024).toFixed(0)} MB)`
          : 'Finishing up...';
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        const d = (() => { try { return JSON.parse(xhr.responseText); } catch { return {}; } })();
        reject(new Error(d.error || `Video upload failed (${xhr.status})`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('Network error during video upload')));
    xhr.addEventListener('abort', () => reject(new Error('Video upload was cancelled')));
    xhr.send(file);
  });
}

function getExtension(filename) {
  const match = filename.match(/\.[a-zA-Z0-9]+$/);
  return match ? match[0].toLowerCase() : '.mp4';
}

function setUploading(uploading, label = 'Uploading...') {
  submitBtn.disabled = uploading;
  submitBtn.textContent = uploading ? label : 'Upload Track';
  uploadProgress.classList.toggle('show', uploading);
  if (uploading) { progressBar.style.width = '0%'; progressText.textContent = label; }
}

function showSuccess(html) { alertSuccess.innerHTML = html; alertSuccess.classList.add('show'); }
function showError(msg) { alertError.textContent = msg; alertError.classList.add('show'); }
function clearAlerts() { alertSuccess.classList.remove('show'); alertError.classList.remove('show'); }
