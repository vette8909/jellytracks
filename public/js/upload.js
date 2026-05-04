const MAX_UPLOAD_BYTES = 100 * 1024 * 1024;

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
    // Auto-thumbnail not available (cross-origin, etc.) — ignore
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
  if (videoFile.size > MAX_UPLOAD_BYTES) {
    showError(`File is too large (${(videoFile.size / 1024 / 1024).toFixed(0)} MB). Maximum size is 100 MB. Please compress the video first.`);
    return;
  }

  const formData = new FormData();
  formData.append('title', title);
  formData.append('artist', artist);
  formData.append('video', videoFile);
  if (thumbBlob) formData.append('thumbnail', thumbBlob, 'thumbnail.jpg');

  setUploading(true);

  try {
    const result = await uploadWithProgress(formData);

    if (result.ok) {
      const data = await result.json();
      showSuccess(`Track uploaded successfully! <a href="/player.html?id=${data.id}" style="color:var(--cyan-light);text-decoration:underline;">Play it now</a>`);
      form.reset();
      videoFileSelected.classList.remove('show');
      thumbPreview.classList.remove('show');
      thumbBlob = null;
      progressBar.style.width = '0%';
    } else {
      const data = await result.json().catch(() => ({}));
      showError(data.error || `Upload failed (HTTP ${result.status}). Please try again.`);
    }
  } catch (err) {
    showError(`Upload failed: ${err.message || 'network error'}. File size: ${(videoFile.size / 1024 / 1024).toFixed(1)} MB.`);
  } finally {
    setUploading(false);
  }
});

function uploadWithProgress(formData) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', '/api/upload');

    xhr.upload.addEventListener('progress', e => {
      if (e.lengthComputable) {
        const pct = Math.round((e.loaded / e.total) * 100);
        progressBar.style.width = `${pct}%`;
        progressText.textContent = pct < 100 ? `Uploading... ${pct}%` : 'Processing...';
      }
    });

    xhr.addEventListener('load', () => {
      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        json: () => Promise.resolve(JSON.parse(xhr.responseText))
      });
    });

    xhr.addEventListener('error', () => reject(new Error(`Network error (status ${xhr.status})`)));
    xhr.addEventListener('abort', () => reject(new Error('Upload was aborted')));
    xhr.addEventListener('timeout', () => reject(new Error('Upload timed out')));
    xhr.send(formData);
  });
}

function setUploading(uploading) {
  submitBtn.disabled = uploading;
  submitBtn.textContent = uploading ? 'Uploading...' : 'Upload Track';
  uploadProgress.classList.toggle('show', uploading);
  if (uploading) progressBar.style.width = '0%';
}

function showSuccess(html) { alertSuccess.innerHTML = html; alertSuccess.classList.add('show'); }
function showError(msg) { alertError.textContent = msg; alertError.classList.add('show'); }
function clearAlerts() { alertSuccess.classList.remove('show'); alertError.classList.remove('show'); }
