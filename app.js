// FWEA-I Clean Audio Editor (Final)
// If you embed this in Wix, also add the parent listener snippet
// so the parent can hide its own payment overlay when we send messages.

console.log("✅ FWEA-I Final Clean Audio Editor Loading…");

const CONFIG = {
  workerURL: "https://omni-clean-5.fweago-flavaz.workers.dev",
  stripePublishableKey: "pk_live_51RW06LjZ1q764pCr02p7yLia0VqBGUkfRC7QmS0WhFNAwFZceyujBVsVDoqS9hF5",
};

let appState = {
  currentSection: "upload",
  sessionId: null,
  audioFile: null,
  isAdmin: false
};

// ───────────────────────────────
// Section control
// ───────────────────────────────
function forceInitialState() {
  try {
    document.querySelectorAll(".section").forEach(sec => sec.style.display = "none");
    const uploadSection = document.getElementById("upload-section");
    if (uploadSection) uploadSection.style.display = "block";
    console.log("🎧 Defaulted to upload screen");
  } catch (err) { console.error(err); }
}

// ───────────────────────────────
// Host overlay suppression
// ───────────────────────────────
function suppressHostOverlays() {
  try {
    const KILL_TEXT_RE = /(processing\\s*payment|securely\\s*process\\s*your\\s*payment|payment\\s*processing)/i;
    const SELECTORS = [
      "[role='dialog']", ".modal", ".overlay", ".lightbox", ".wix-overlay", "[data-modal]",
      "#paymentProcessing", "#processingPaymentModal", ".processing-payment-overlay", ".payment-modal"
    ];

    const hideFrom = (root) => {
      try {
        root.querySelectorAll(SELECTORS.join(",")).forEach((el) => {
          const txt = (el.textContent || "").toLowerCase();
          if (KILL_TEXT_RE.test(txt)) {
            el.classList.add("hidden");
            el.setAttribute("aria-hidden", "true");
            el.style.display = "none";
            el.style.pointerEvents = "none";
          }
        });
      } catch (_) {}
    };
    hideFrom(document);

    new MutationObserver(m => {
      m.forEach(x => x.addedNodes?.forEach(n => n.nodeType === 1 && hideFrom(n)));
    }).observe(document.documentElement, { childList: true, subtree: true });
  } catch (_) {}
}

// ───────────────────────────────
// Admin gate suppression
// ───────────────────────────────
function suppressAdminGate() {
  try {
    const HIDE = (root) => {
      root.querySelectorAll("#adminModal, .admin-modal, [data-admin-modal], .admin-gate, .admin-overlay")
        .forEach(el => {
          el.classList.add("hidden");
          el.setAttribute("aria-hidden","true");
          el.style.display="none";
          el.style.pointerEvents="none";
        });
      root.querySelectorAll("[role='dialog'], .modal, .overlay").forEach(el => {
        const txt = (el.textContent || "").toLowerCase();
        if (/(^|\\b)admin\\s+access\\b/.test(txt)) {
          el.classList.add("hidden");
          el.setAttribute("aria-hidden","true");
          el.style.display="none";
          el.style.pointerEvents="none";
        }
      });
    };
    HIDE(document);
    try { window.showAdminModal = () => {}; } catch(_) {}
    try { window.requireAdmin = () => false; } catch(_) {}
    new MutationObserver(m => {
      m.forEach(x => x.addedNodes?.forEach(n => n.nodeType===1 && HIDE(n)));
    }).observe(document.documentElement, { childList:true, subtree:true });
  } catch(_) {}
}

// ───────────────────────────────
// Tell parent Wix page to hide overlays
// ───────────────────────────────
function requestParentHideOverlays() {
  try {
    let ticks = 0;
    const send = () => {
      try { window.parent?.postMessage({ type: "FWEA_HIDE_PAYMENT_OVERLAYS" }, "*"); } catch(_) {}
      if (++ticks > 12) clearInterval(iv);
    };
    send();
    const iv = setInterval(send, 500);
  } catch (_) {}
}

// ───────────────────────────────
// Stripe checkout handling
// ───────────────────────────────
async function handlePaymentRedirect(priceId) {
  try {
    const stripe = Stripe(CONFIG.stripePublishableKey);
    const response = await fetch(`${CONFIG.workerURL}/create-checkout-session`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceId })
    });
    const data = await response.json();
    if (!data.sessionId) throw new Error("Stripe session creation failed.");
    await stripe.redirectToCheckout({ sessionId: data.sessionId });
  } catch (err) {
    console.error("Payment redirect failed", err);
  }
}

// ───────────────────────────────
// Upload logic
// ───────────────────────────────
function setupUpload() {
  const fileInput = document.getElementById("fileInput");
  const uploadBtn = document.getElementById("uploadBtn");

  if (uploadBtn && fileInput) {
    uploadBtn.addEventListener("click", async () => {
      const file = fileInput.files[0];
      if (!file) return alert("Upload an audio file first.");
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`${CONFIG.workerURL}/process`, { method: "POST", body: form });
      const out = await res.json();
      if (out.previewUrl) {
        document.getElementById("preview").src = out.previewUrl;
        console.log("🎵 Preview ready:", out.previewUrl);
      }
    });
  }
}

// ───────────────────────────────
// Boot sequence
// ───────────────────────────────
document.addEventListener("DOMContentLoaded", function () {
  suppressAdminGate();      // 🚫 Never show admin modal
  requestParentHideOverlays(); // 🧠 Tell parent to hide overlays
  suppressHostOverlays();   // 🧱 Hide any within this document
  forceInitialState();      // 🎧 Start at upload screen
  setupUpload();            // ⬆️ Enable upload logic
  console.log("🔥 FWEA-I Portal Ready");
});

// ───────────────────────────────
// Hotkey for manual admin open (Ctrl+Alt+A)
// ───────────────────────────────
document.addEventListener("keydown", (e) => {
  if (e.ctrlKey && e.altKey && e.key.toLowerCase() === "a") {
    const el = document.querySelector("#adminModal, .admin-modal, [data-admin-modal]");
    if (el) {
      el.style.display = "";
      el.classList.remove("hidden");
      el.removeAttribute("aria-hidden");
      el.style.pointerEvents = "";
      alert("Admin modal manually opened (developer hotkey)");
    }
  }
});
