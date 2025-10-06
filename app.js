// app.js — FWEA-I Clean Audio Editor (externalized)
// -------------------------------------------------
// Assumes your HTML IDs/classes match the provided fwea-final-frontend.html

console.log('🎯 FWEA-I Final Clean Audio Editor Loading...');

const CONFIG = {
  workerUrl: 'https://omni-clean-5.fweago-flavaz.workers.dev',
  stripePublishableKey: 'pk_live_51RW06LJ2Iq1764pCr02p7yLia0VqBgUcRfG7Qm5OWFNAwFZcexIs9iBB3B9s22elcQzQjuAUMBxpeUhwcm8hsDf900NbCbF3Vw'
};

let appState = {
  currentSection: 'upload',
  sessionId: null,
  audioFile: null,
  processingData: null,
  userPlan: null
};

// DOM Elements
const elements = {
  // Sections
  uploadSection: document.getElementById('uploadSection'),
  processingSection: document.getElementById('processingSection'),
  resultsSection: document.getElementById('resultsSection'),
  paymentSection: document.getElementById('paymentSection'),
  downloadSection: document.getElementById('downloadSection'),

  // Upload
  dropZone: document.getElementById('dropZone'),
  browseBtn: document.getElementById('browseBtn'),
  fileInput: document.getElementById('fileInput'),

  // Processing
  progressFill: document.getElementById('progressFill'),
  progressText: document.getElementById('progressText'),

  // Results
  wordsDetected: document.getElementById('wordsDetected'),
  cleaningAccuracy: document.getElementById('cleaningAccuracy'),
  processingTime: document.getElementById('processingTime'),
  audioPreview: document.getElementById('audioPreview'),

  // Download
  downloadClean: document.getElementById('downloadClean'),
  downloadVocals: document.getElementById('downloadVocals'),
  downloadInstrumental: document.getElementById('downloadInstrumental'),
  downloadLyrics: document.getElementById('downloadLyrics'),
  premiumFeatures: document.getElementById('premiumFeatures'),
  processAnother: document.getElementById('processAnother'),

  // Modal
  modal: document.getElementById('modal'),
  modalTitle: document.getElementById('modalTitle'),
  modalMessage: document.getElementById('modalMessage'),
  modalClose: document.getElementById('modalClose')
};

// App init
document.addEventListener('DOMContentLoaded', function() {
  console.log('🚀 Initializing FWEA-I Final Clean Audio Editor...');
  setupEventListeners();
  handleURLParameters();
  checkStripeReturn();   // Reveal downloads after Stripe returns with ?success=true
  pingHealthFooter();    // Optional: shows Online/Offline in footer if present
});

// -------------------- Event Wiring --------------------

function setupEventListeners() {
  // Upload handlers
  elements.dropZone.addEventListener('click', () => elements.fileInput.click());
  elements.browseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    elements.fileInput.click();
  });
  elements.fileInput.addEventListener('change', handleFileSelect);

  // Drag and drop
  elements.dropZone.addEventListener('dragover', handleDragOver);
  elements.dropZone.addEventListener('dragleave', handleDragLeave);
  elements.dropZone.addEventListener('drop', handleFileDrop);

  // Payment buttons
  document.querySelectorAll('.btn[data-plan]').forEach(btn => {
    btn.addEventListener('click', handlePayment);
  });

  // Download buttons (optional elements exist depending on plan)
  elements.downloadClean?.addEventListener('click', () => handleDownload('clean'));
  elements.downloadVocals?.addEventListener('click', () => handleDownload('vocals'));
  elements.downloadInstrumental?.addEventListener('click', () => handleDownload('instrumental'));
  elements.downloadLyrics?.addEventListener('click', () => handleDownload('lyrics'));
  elements.processAnother?.addEventListener('click', resetApp);

  // Modal
  elements.modalClose?.addEventListener('click', () => hideModal());
}

// -------------------- File Handling --------------------

function handleDragOver(e) {
  e.preventDefault();
  elements.dropZone.classList.add('drag-over');
}
function handleDragLeave(e) {
  e.preventDefault();
  elements.dropZone.classList.remove('drag-over');
}
function handleFileDrop(e) {
  e.preventDefault();
  elements.dropZone.classList.remove('drag-over');
  const files = e.dataTransfer.files;
  if (files.length > 0) processFile(files[0]);
}
function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) processFile(file);
}

async function processFile(file) {
  if (!validateFile(file)) return;

  appState.audioFile = file;
  showSection('processing');

  try {
    // Upload
    setProgress(5, 'Uploading...');
    const uploadResult = await uploadFile(file);
    appState.sessionId = uploadResult.sessionId;

    // Start processing
    setProgress(20, 'Uploaded. Starting analysis...');
    await startProcessing();

    // Poll status
    await pollStatus(appState.sessionId);

  } catch (error) {
    console.error(error);
    showModal('Upload/Processing Error', error.message || 'Something went wrong during processing.');
    showSection('upload');
  }
}

function validateFile(file) {
  const allowed = ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg'];
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  if (!allowed.includes(ext)) {
    showModal('Unsupported Format', `.${ext} is not supported. Try: ${allowed.join(', ')}`);
    return false;
  }
  const maxBytes = 100 * 1024 * 1024;
  if (file.size > maxBytes) {
    showModal('File Too Large', 'Maximum size is 100MB.');
    return false;
  }
  return true;
}

async function uploadFile(file) {
  const fd = new FormData();
  fd.append('audio', file);
  const res = await fetch(`${CONFIG.workerUrl}/upload`, { method: 'POST', body: fd });
  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.error || 'Upload failed');
  }
  return data;
}

async function startProcessing() {
  if (!appState.sessionId) throw new Error('Missing session id');
  setProgress(30, 'Sending to processor...');
  await fetch(`${CONFIG.workerUrl}/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessionId: appState.sessionId })
  });
}

async function pollStatus(sessionId) {
  let done = false, tries = 0;
  while (!done && tries < 180) {
    await new Promise(r => setTimeout(r, 1000));
    const r = await fetch(`${CONFIG.workerUrl}/status?session=${encodeURIComponent(sessionId)}`);
    const j = await r.json();
    if (j.success && (j.status === 'completed' || j.processingResult)) {
      setProgress(100, 'Completed');
      appState.processingData = j.processingResult || j.processing || null;
      showResults(j);
      done = true;
      break;
    } else {
      tries++;
      setProgress(Math.min(95, 30 + tries / 2), 'Processing...');
    }
  }
  if (!done) {
    showModal('Timeout', 'Processing is taking longer than expected. You can wait a bit and refresh status.');
    showSection('results'); // allow user to try again or pay later
  }
}

// -------------------- UI Helpers --------------------

function setProgress(pct, text) {
  if (elements.progressFill) elements.progressFill.style.width = `${pct}%`;
  if (elements.progressText) elements.progressText.textContent = text || '';
}

function showSection(name) {
  appState.currentSection = name;
  const map = {
    upload: [elements.uploadSection],
    processing: [elements.processingSection],
    results: [elements.resultsSection, elements.paymentSection],
    download: [elements.downloadSection]
  };
  [elements.uploadSection, elements.processingSection, elements.resultsSection, elements.paymentSection, elements.downloadSection]
    .forEach(el => el?.classList.add('hidden'));
  (map[name] || []).forEach(el => el?.classList.remove('hidden'));
}

function showResults(j) {
  // reveal results + payment
  elements.resultsSection?.classList.remove('hidden');
  elements.paymentSection?.classList.remove('hidden');

  // Stats
  const detected = j.processingResult?.profanity_detection?.total_detected
                ?? j.processing?.detectedWords
                ?? 0;
  const acc = j.processingResult?.cleaning_results?.cleaning_accuracy
           ?? j.processing?.cleaningAccuracy
           ?? 0;
  const ptime = j.processingResult?.processing_time
             ?? j.processing?.processingTime
             ?? 0;

  if (elements.wordsDetected) elements.wordsDetected.textContent = detected;
  if (elements.cleaningAccuracy) {
    const percent = acc > 1 ? Math.round(acc) : Math.round(acc * 100);
    elements.cleaningAccuracy.textContent = `${percent}%`;
  }
  if (elements.processingTime) elements.processingTime.textContent = `${Math.round(ptime)}s`;

  // Preview
  if (elements.audioPreview && appState.sessionId) {
    elements.audioPreview.src = `${CONFIG.workerUrl}/preview?session=${encodeURIComponent(appState.sessionId)}`;
  }
}

// -------------------- Payments --------------------

// We don’t use Stripe.js here; Worker returns a Checkout URL and we redirect.
async function handlePayment(e) {
  e.preventDefault();
  const btn = e.currentTarget;
  const plan = btn.getAttribute('data-plan') || btn.dataset.plan || btn.parentElement.getAttribute('data-plan');

  if (!appState.sessionId) {
    showModal('Upload Required', 'Please upload and process an audio file before purchasing.');
    return;
  }

  try {
    btn.disabled = true;
    btn.textContent = 'Preparing Checkout...';

    const res = await fetch(`${CONFIG.workerUrl}/create-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: appState.sessionId, plan })
    });

    const data = await res.json();
    if (!res.ok || !data.success || !data.checkoutUrl) {
      throw new Error(data.error || 'Unable to create payment session');
    }

    window.location.assign(data.checkoutUrl);
  } catch (err) {
    console.error('Payment error:', err);
    showModal('Payment Error', `Payment failed: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.textContent = `Choose ${plan === 'single' ? 'Single Song' : plan === 'day' ? 'Day Pass' : 'Monthly Pro'}`;
  }
}

function checkStripeReturn() {
  const params = new URLSearchParams(window.location.search);
  if (params.get('success') === 'true') {
    try {
      elements.resultsSection?.classList.remove('hidden');
      elements.paymentSection?.classList.add('hidden');
      elements.downloadSection?.classList.remove('hidden');
    } catch (_) {}
  }
}

// -------------------- Downloads --------------------

async function handleDownload(type) {
  if (!appState.sessionId) {
    showModal('Missing Session', 'Please upload and process a file first.');
    return;
  }

  try {
    let url;
    if (type === 'lyrics') {
      url = `${CONFIG.workerUrl}/download-lyrics?session=${encodeURIComponent(appState.sessionId)}`;
    } else {
      url = `${CONFIG.workerUrl}/download?session=${encodeURIComponent(appState.sessionId)}&type=${encodeURIComponent(type)}`;
    }

    // Start download via navigating the browser to the download URL
    window.location.assign(url);
  } catch (err) {
    console.error('Download error:', err);
    showModal('Download Error', err.message || 'Unable to download this file.');
  }
}

// -------------------- Misc Helpers --------------------

function handleURLParameters() {
  const params = new URLSearchParams(window.location.search);
  const sid = params.get('fwea_session') || params.get('session');
  if (sid) {
    appState.sessionId = sid;
    // Optionally poll instantly when a session is provided in the URL
    // pollStatus(sid).catch(() => {});
  }
}

function showModal(title, message) {
  if (!elements.modal) { alert(message); return; }
  elements.modalTitle.textContent = title;
  elements.modalMessage.textContent = message;
  elements.modal.classList.remove('hidden');
}
function hideModal() {
  elements.modal?.classList.add('hidden');
}

function resetApp() {
  appState = {
    currentSection: 'upload',
    sessionId: null,
    audioFile: null,
    processingData: null,
    userPlan: null
  };
  elements.fileInput.value = '';
  showSection('upload');
  elements.audioPreview && (elements.audioPreview.src = '');
  setProgress(0, 'Initializing...');
}

// Optional: footer status (if your HTML has a <footer>)
async function pingHealthFooter() {
  try {
    const footer = document.querySelector('footer');
    if (!footer) return;
    const r = await fetch(`${CONFIG.workerUrl}/health`);
    const j = await r.json();
    footer.innerHTML = `© 2025 FWEA-I Precision Audio Processing. All rights reserved.<br/>Server Status: <span style="color:${j.backend_reachable?'#4ADE80':'#EF4444'}">${j.backend_reachable?'Online':'Offline'}</span>`;
  } catch (_) {}
}
