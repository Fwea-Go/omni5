// app.js — FWEA-I Clean Audio Editor (final)
// -----------------------------------------
// If you embed this in Wix, also add the parent listener snippet I gave you earlier
// so the parent can hide its own payment overlay when we postMessage.

console.log('🎯 FWEA-I Final Clean Audio Editor Loading...');

const CONFIG = {
  workerUrl: 'https://omni-clean-5.fweago-flavaz.workers.dev',
  stripePublishableKey:
    'pk_live_51RW06LJ2Iq1764pCr02p7yLia0VqBgUcRfG7Qm5OWFNAwFZcexIs9iBB3B9s22elcQzQjuAUMBxpeUhwcm8hsDf900NbCbF3Vw'
};

let appState = {
  currentSection: 'upload',
  sessionId: null,
  audioFile: null,
  processingData: null,
  userPlan: null
};

// --- DOM ---
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

// --- Boot ---
document.addEventListener('DOMContentLoaded', function () {
  // Ask the parent (Wix) to hide its overlays during boot
  requestParentHideOverlays();
  // Hide any in-frame overlays and force the first screen to Upload
  suppressHostOverlays();
  forceInitialState();

  console.log('🚀 Initializing FWEA-I Final Clean Audio Editor...');
  setupEventListeners();
  handleURLParameters();
  checkStripeReturn(); // if coming back from Stripe with ?success=true
  pingHealthFooter();  // optional footer status if page has <footer>
});

// ---------- Overlay control (host/Wix) ----------

function requestParentHideOverlays() {
  try {
    // Fire messages for ~6s to beat host overlay init
    let ticks = 0;
    const send = () => {
      try {
        window.parent?.postMessage({ type: 'FWEA_HIDE_PAYMENT_OVERLAYS' }, '*');
      } catch (_) {}
      if (++ticks > 12) clearInterval(iv);
    };
    send();
    const iv = setInterval(send, 500);
  } catch (_) {}
}

function suppressHostOverlays() {
  try {
    const KILL_TEXT_RE =
      /(processing\s*payment|securely\s*process\s*your\s*payment|payment\s*processing)/i;
    const SELECTORS = [
      '[role="dialog"]',
      '.modal',
      '.overlay',
      '.lightbox',
      '.wix-overlay',
      '[data-modal]',
      '#paymentProcessing',
      '#processingPaymentModal',
      '.processing-payment-overlay',
      '.payment-modal'
    ];

    const hideFrom = (root) => {
      try {
        // Target common overlay containers by selector + matching text
        root.querySelectorAll(SELECTORS.join(',')).forEach((el) => {
          const txt = (el.textContent || '').toLowerCase();
          if (KILL_TEXT_RE.test(txt)) {
            el.classList.add('hidden');
            el.setAttribute('aria-hidden', 'true');
            el.style.display = 'none';
            el.style.pointerEvents = 'none';
          }
        });

        // Catch-all for full-screen fixed overlays with matching text
        root.querySelectorAll('*').forEach((el) => {
          if (!el || el.nodeType !== 1) return;
          const s = getComputedStyle(el);
          if ((s.position === 'fixed' || s.position === 'sticky') && parseInt(s.zIndex) > 1000) {
            const txt = (el.textContent || '').toLowerCase();
            if (KILL_TEXT_RE.test(txt)) {
              el.classList.add('hidden');
              el.setAttribute('aria-hidden', 'true');
              el.style.display = 'none';
              el.style.pointerEvents = 'none';
            }
          }
        });
      } catch (_) {}
    };

    hideFrom(document);

    // Watch for late-injected overlays
    const mo = new MutationObserver((muts) => {
      for (const m of muts) {
        m.addedNodes?.forEach((node) => {
          if (node && node.nodeType === 1) hideFrom(node);
        });
      }
    });
    mo.observe(document.documentElement, { childList: true, subtree: true });

    // Same-origin parent clean (best-effort)
    try {
      if (window.parent && window.parent !== window && window.parent.document) {
        hideFrom(window.parent.document);
      }
    } catch (_) {}
  } catch (_) {}
}

function forceInitialState() {
  try {
    // Show Upload, hide others
    elements.uploadSection?.classList.remove('hidden');
    elements.processingSection?.classList.add('hidden');
    elements.resultsSection?.classList.add('hidden');
    elements.paymentSection?.classList.add('hidden');
    elements.downloadSection?.classList.add('hidden');

    // Hide our modal if leftover
    elements.modal?.classList.add('hidden');

    // Kill obvious in-frame payment overlays by selector
    [
      '#paymentModal',
      '.payment-modal',
      '#processingPaymentModal',
      '.processing-payment-overlay',
      '#paymentProcessing',
      '.paymentProcessing',
      '#processingOverlay',
      '.overlay-backdrop'
    ].forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        el.classList.add('hidden');
        el.setAttribute('aria-hidden', 'true');
        el.style.display = 'none';
      });
    });
  } catch (_) {}
}

// ---------- Event wiring ----------

function setupEventListeners() {
  // Upload
  elements.dropZone.addEventListener('click', () => elements.fileInput.click());
  elements.browseBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    elements.fileInput.click();
  });
  elements.fileInput.addEventListener('change', handleFileSelect);

  // Drag & drop
  elements.dropZone.addEventListener('dragover', handleDragOver);
  elements.dropZone.addEventListener('dragleave', handleDragLeave);
  elements.dropZone.addEventListener('drop', handleFileDrop);

  // Payments
  document.querySelectorAll('.btn[data-plan]').forEach((btn) => {
    btn.addEventListener('click', handlePayment);
  });

  // Downloads
  elements.downloadClean?.addEventListener('click', () => handleDownload('clean'));
  elements.downloadVocals?.addEventListener('click', () => handleDownload('vocals'));
  elements.downloadInstrumental?.addEventListener('click', () => handleDownload('instrumental'));
  elements.downloadLyrics?.addEventListener('click', () => handleDownload('lyrics'));
  elements.processAnother?.addEventListener('click', resetApp);

  // Modal
  elements.modalClose?.addEventListener('click', () => hideModal());
}

// ---------- File handling ----------

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
  if (!res.ok || !data.success) throw new Error(data.error || 'Upload failed');
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
  let done = false,
    tries = 0;
  while (!done && tries < 180) {
    await new Promise((r) => setTimeout(r, 1000));
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
    showSection('results'); // allow user to see/pay later
  }
}

// ---------- UI helpers ----------

function setProgress(pct, text) {
  if (elements.progressFill) elements.progressFill.style.width = `${pct}%`;
  if (elements.progressText) elements.progressText.textContent = text || '';
}

function showSection(name) {
  appState.currentSection = name;
  const list = [
    elements.uploadSection,
    elements.processingSection,
    elements.resultsSection,
    elements.paymentSection,
    elements.downloadSection
  ];
  list.forEach((el) => el?.classList.add('hidden'));
  const map = {
    upload: [elements.uploadSection],
    processing: [elements.processingSection],
    results: [elements.resultsSection, elements.paymentSection],
    download: [elements.downloadSection]
  };
  (map[name] || []).forEach((el) => el?.classList.remove('hidden'));
}

function showResults(j) {
  elements.resultsSection?.classList.remove('hidden');
  elements.paymentSection?.classList.remove('hidden');

  const detected =
    j.processingResult?.profanity_detection?.total_detected ??
    j.processing?.detectedWords ??
    0;
  const acc =
    j.processingResult?.cleaning_results?.cleaning_accuracy ??
    j.processing?.cleaningAccuracy ??
    0;
  const ptime =
    j.processingResult?.processing_time ?? j.processing?.processingTime ?? 0;

  if (elements.wordsDetected) elements.wordsDetected.textContent = detected;
  if (elements.cleaningAccuracy) {
    const percent = acc > 1 ? Math.round(acc) : Math.round(acc * 100);
    elements.cleaningAccuracy.textContent = `${percent}%`;
  }
  if (elements.processingTime) elements.processingTime.textContent = `${Math.round(ptime)}s`;

  if (elements.audioPreview && appState.sessionId) {
    elements.audioPreview.src = `${CONFIG.workerUrl}/preview?session=${encodeURIComponent(
      appState.sessionId
    )}`;
  }
}

function showModal(title, message) {
  if (!elements.modal) {
    alert(message);
    return;
  }
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
  if (elements.fileInput) elements.fileInput.value = '';
  showSection('upload');
  if (elements.audioPreview) elements.audioPreview.src = '';
  setProgress(0, 'Initializing...');
}

// ---------- Payments ----------
// We don’t use Stripe.js in the iframe; the Worker returns a Checkout URL and we redirect.

async function handlePayment(e) {
  e.preventDefault();
  const btn = e.currentTarget;
  const plan =
    btn.getAttribute('data-plan') ||
    btn.dataset.plan ||
    btn.parentElement.getAttribute('data-plan');

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
    btn.textContent = `Choose ${
      plan === 'single' ? 'Single Song' : plan === 'day' ? 'Day Pass' : 'Monthly Pro'
    }`;
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

// ---------- Downloads ----------

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
      url = `${CONFIG.workerUrl}/download?session=${encodeURIComponent(
        appState.sessionId
      )}&type=${encodeURIComponent(type)}`;
    }
    window.location.assign(url);
  } catch (err) {
    console.error('Download error:', err);
    showModal('Download Error', err.message || 'Unable to download this file.');
  }
}

// ---------- Misc ----------

function handleURLParameters() {
  const params = new URLSearchParams(window.location.search);
  const sid = params.get('fwea_session') || params.get('session');
  if (sid) {
    appState.sessionId = sid;
    // Optional: auto-poll if session is passed in
    // pollStatus(sid).catch(() => {});
  }
}

async function pingHealthFooter() {
  try {
    const footer = document.querySelector('footer');
    if (!footer) return;
    const r = await fetch(`${CONFIG.workerUrl}/health`);
    const j = await r.json();
    footer.innerHTML = `© 2025 FWEA-I Precision Audio Processing. All rights reserved.<br/>Server Status: <span style="color:${
      j.backend_reachable ? '#4ADE80' : '#EF4444'
    }">${j.backend_reachable ? 'Online' : 'Offline'}</span>`;
  } catch (_) {}
}
