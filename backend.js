// Application Data
const CONFIG = {
    hetznerBackendUrl: "https://178.156.190.229:8000",
    cloudflareAccountId: "94ad1fffaa41132c2ff517ce46f76692",
    supportedFormats: ["mp3", "wav", "m4a", "aac", "flac"],
    maxFileSize: 100000000, // 100MB
    previewDuration: 30,
    paymentTiers: [
        { name: "Single Song", price: "$2.99", description: "Clean one song" },
        { name: "Day Pass", price: "$9.99", description: "Unlimited cleans for 24 hours" },
        { name: "Monthly Pro", price: "$29.99", description: "Unlimited monthly access" }
    ],
    languagesSupported: [
        "English", "Spanish", "French", "Portuguese", "Italian", 
        "German", "Russian", "Arabic", "Chinese", "Japanese", "Korean"
    ],
    profanityExamples: {
        english: ["damn", "hell", "shit", "fuck", "bitch"],
        spanish: ["mierda", "joder", "cabrón"],
        french: ["merde", "putain", "connard"],
        portuguese: ["merda", "porra", "caralho"]
    },
    adminPassword: "fwea.ip"
};

// Application State
let appState = {
    currentFile: null,
    isAdmin: false,
    processingStep: 0,
    audioPreview: null,
    mutedSections: [],
    processedAudioUrl: null,
    previewTimeout: null
};

// DOM Elements - Initialize after DOM loads
let elements = {};

function initializeElements() {
    elements = {
        dropZone: document.getElementById('dropZone'),
        fileInput: document.getElementById('fileInput'),
        browseBtn: document.getElementById('browseBtn'),
        uploadSection: document.getElementById('uploadSection'),
        uploadProgress: document.getElementById('uploadProgress'),
        fileName: document.getElementById('fileName'),
        fileSize: document.getElementById('fileSize'),
        progressFill: document.getElementById('progressFill'),
        progressText: document.getElementById('progressText'),
        processingSection: document.getElementById('processingSection'),
        transcriptionPreview: document.getElementById('transcriptionPreview'),
        detectedLanguage: document.getElementById('detectedLanguage'),
        explicitCount: document.getElementById('explicitCount'),
        transcriptText: document.getElementById('transcriptText'),
        previewSection: document.getElementById('previewSection'),
        audioPlayer: document.getElementById('audioPlayer'),
        waveform: document.getElementById('waveform'),
        mutedSections: document.getElementById('mutedSections'),
        currentTime: document.getElementById('currentTime'),
        totalTime: document.getElementById('totalTime'),
        mutedCount: document.getElementById('mutedCount'),
        cleanPercentage: document.getElementById('cleanPercentage'),
        successSection: document.getElementById('successSection'),
        downloadBtn: document.getElementById('downloadBtn'),
        errorSection: document.getElementById('errorSection'),
        errorMessage: document.getElementById('errorMessage'),
        retryBtn: document.getElementById('retryBtn'),
        paywallModal: document.getElementById('paywallModal'),
        modalClose: document.getElementById('modalClose'),
        adminUnlock: document.getElementById('adminUnlock'),
        adminModal: document.getElementById('adminModal'),
        adminModalClose: document.getElementById('adminModalClose'),
        adminPassword: document.getElementById('adminPassword'),
        adminSubmit: document.getElementById('adminSubmit')
    };
}

// Utility Functions
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function showSection(sectionId) {
    // Hide all sections
    document.querySelectorAll('.upload-section, .processing-section, .preview-section, .success-section, .error-section').forEach(section => {
        section.classList.add('hidden');
    });
    // Show target section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.remove('hidden');
    }
}

function showError(message) {
    if (elements.errorMessage) {
        elements.errorMessage.textContent = message;
        showSection('errorSection');
    }
}

function resetApp() {
    appState.currentFile = null;
    appState.processingStep = 0;
    appState.audioPreview = null;
    appState.mutedSections = [];
    appState.processedAudioUrl = null;
    
    if (appState.previewTimeout) {
        clearTimeout(appState.previewTimeout);
    }
    
    if (elements.uploadProgress) {
        elements.uploadProgress.classList.add('hidden');
    }
    if (elements.transcriptionPreview) {
        elements.transcriptionPreview.classList.add('hidden');
    }
    showSection('uploadSection');
    
    // Reset progress
    if (elements.progressFill && elements.progressText) {
        elements.progressFill.style.width = '0%';
        elements.progressText.textContent = '0%';
    }
}

// File Handling
function validateFile(file) {
    const fileExtension = file.name.split('.').pop().toLowerCase();
    
    if (!CONFIG.supportedFormats.includes(fileExtension)) {
        throw new Error(`Unsupported file format. Please use: ${CONFIG.supportedFormats.join(', ').toUpperCase()}`);
    }
    
    if (file.size > CONFIG.maxFileSize) {
        throw new Error(`File size exceeds ${formatFileSize(CONFIG.maxFileSize)} limit.`);
    }
    
    return true;
}

function handleFileSelect(file) {
    try {
        validateFile(file);
        appState.currentFile = file;
        
        if (elements.fileName && elements.fileSize) {
            elements.fileName.textContent = file.name;
            elements.fileSize.textContent = formatFileSize(file.size);
        }
        if (elements.uploadProgress) {
            elements.uploadProgress.classList.remove('hidden');
        }
        
        // Start upload simulation
        simulateUpload();
    } catch (error) {
        showError(error.message);
    }
}

function simulateUpload() {
    let progress = 0;
    const uploadInterval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress >= 100) {
            progress = 100;
            clearInterval(uploadInterval);
            setTimeout(() => startProcessing(), 500);
        }
        
        if (elements.progressFill && elements.progressText) {
            elements.progressFill.style.width = progress + '%';
            elements.progressText.textContent = Math.round(progress) + '%';
        }
    }, 200);
}

// Processing Simulation
function startProcessing() {
    showSection('processingSection');
    appState.processingStep = 1;
    updateProcessingStep(1);
    
    // Step 1: Analyzing audio
    setTimeout(() => {
        updateProcessingStep(2);
        setTimeout(() => {
            updateProcessingStep(3);
            setTimeout(() => {
                updateProcessingStep(4);
                setTimeout(() => {
                    completeProcessing();
                }, 2000);
            }, 2000);
        }, 3000);
    }, 2000);
}

function updateProcessingStep(step) {
    appState.processingStep = step;
    
    // Update step indicators
    for (let i = 1; i <= 4; i++) {
        const stepElement = document.getElementById(`step${i}`);
        if (stepElement) {
            stepElement.classList.remove('active', 'completed');
            
            if (i < step) {
                stepElement.classList.add('completed');
            } else if (i === step) {
                stepElement.classList.add('active');
            }
        }
    }
    
    // Show transcription preview at step 3
    if (step >= 3) {
        showTranscriptionPreview();
    }
}

function showTranscriptionPreview() {
    if (elements.transcriptionPreview) {
        elements.transcriptionPreview.classList.remove('hidden');
    }
    
    // Simulate language detection
    const detectedLang = CONFIG.languagesSupported[Math.floor(Math.random() * CONFIG.languagesSupported.length)];
    if (elements.detectedLanguage) {
        elements.detectedLanguage.textContent = detectedLang;
    }
    
    // Generate fake transcript with explicit content
    const sampleText = generateSampleTranscript(detectedLang.toLowerCase());
    const explicitWords = findExplicitContent(sampleText, detectedLang.toLowerCase());
    
    if (elements.explicitCount) {
        elements.explicitCount.textContent = `${explicitWords.length} instances`;
    }
    if (elements.transcriptText) {
        elements.transcriptText.innerHTML = highlightExplicitContent(sampleText, explicitWords);
    }
    
    // Store muted sections for preview
    appState.mutedSections = generateMutedSections(explicitWords.length);
}

function generateSampleTranscript(language) {
    const transcripts = {
        english: "Yeah, I'm walking down the street, feeling so damn good, nothing can stop me now, this is my fucking time to shine, bitch please don't mess with me today",
        spanish: "Caminando por la calle, me siento muy bien, mierda no me pueden parar, este es mi momento de brillar",
        french: "Je marche dans la rue, je me sens si bien, putain rien ne peut m'arrêter maintenant, c'est mon moment",
        portuguese: "Caminhando pela rua, me sentindo muito bem, merda nada pode me parar agora, este é meu momento"
    };
    
    return transcripts[language] || transcripts.english;
}

function findExplicitContent(text, language) {
    const profanity = CONFIG.profanityExamples[language] || CONFIG.profanityExamples.english;
    const words = [];
    
    profanity.forEach(word => {
        if (text.toLowerCase().includes(word)) {
            words.push(word);
        }
    });
    
    return words;
}

function highlightExplicitContent(text, explicitWords) {
    let highlightedText = text;
    explicitWords.forEach(word => {
        const regex = new RegExp(word, 'gi');
        highlightedText = highlightedText.replace(regex, `<span class="explicit-word">${word}</span>`);
    });
    return highlightedText;
}

function generateMutedSections(explicitCount) {
    const sections = [];
    for (let i = 0; i < explicitCount; i++) {
        sections.push({
            start: Math.random() * 25, // Random position in first 25 seconds
            duration: 1 + Math.random() * 2 // 1-3 second duration
        });
    }
    return sections.sort((a, b) => a.start - b.start);
}

function completeProcessing() {
    // Generate audio preview (simulate with original file)
    const audioUrl = URL.createObjectURL(appState.currentFile);
    if (elements.audioPlayer) {
        elements.audioPlayer.src = audioUrl;
    }
    appState.audioPreview = audioUrl;
    
    // Update stats
    if (elements.mutedCount) {
        elements.mutedCount.textContent = appState.mutedSections.length;
    }
    const cleanPercent = Math.max(85, 100 - (appState.mutedSections.length * 3));
    if (elements.cleanPercentage) {
        elements.cleanPercentage.textContent = cleanPercent + '%';
    }
    
    // Render muted sections on waveform
    renderMutedSections();
    
    showSection('previewSection');
    
    // Start preview timeout (30 seconds)
    if (!appState.isAdmin) {
        appState.previewTimeout = setTimeout(() => {
            if (elements.audioPlayer) {
                elements.audioPlayer.pause();
            }
            showPaywall();
        }, CONFIG.previewDuration * 1000);
    }
}

function renderMutedSections() {
    if (!elements.mutedSections) return;
    
    elements.mutedSections.innerHTML = '';
    
    appState.mutedSections.forEach(section => {
        const div = document.createElement('div');
        div.className = 'muted-section';
        div.style.left = (section.start / CONFIG.previewDuration * 100) + '%';
        div.style.width = (section.duration / CONFIG.previewDuration * 100) + '%';
        elements.mutedSections.appendChild(div);
    });
}

// Audio Player Functions
function setupAudioPlayer() {
    if (!elements.audioPlayer) return;
    
    elements.audioPlayer.addEventListener('timeupdate', () => {
        const currentTime = elements.audioPlayer.currentTime;
        if (elements.currentTime) {
            elements.currentTime.textContent = formatTime(currentTime);
        }
        
        // Mute during explicit sections
        let shouldMute = false;
        appState.mutedSections.forEach(section => {
            if (currentTime >= section.start && currentTime <= section.start + section.duration) {
                shouldMute = true;
            }
        });
        
        elements.audioPlayer.muted = shouldMute;
    });
    
    elements.audioPlayer.addEventListener('loadedmetadata', () => {
        const duration = Math.min(elements.audioPlayer.duration, CONFIG.previewDuration);
        if (elements.totalTime) {
            elements.totalTime.textContent = formatTime(duration);
        }
    });
}

// Paywall Functions
function showPaywall() {
    if (elements.paywallModal) {
        elements.paywallModal.classList.remove('hidden');
    }
}

function hidePaywall() {
    if (elements.paywallModal) {
        elements.paywallModal.classList.add('hidden');
    }
}

function processPurchase(tier) {
    // Simulate payment processing
    const loadingText = 'Processing payment...';
    const tierButtons = document.querySelectorAll('.tier-btn');
    
    tierButtons.forEach(btn => {
        if (btn.dataset.tier === tier) {
            btn.textContent = loadingText;
            btn.disabled = true;
        }
    });
    
    setTimeout(() => {
        hidePaywall();
        unlockFullVersion();
    }, 2000);
}

function unlockFullVersion() {
    if (appState.previewTimeout) {
        clearTimeout(appState.previewTimeout);
    }
    
    // Remove time limit from audio
    if (elements.audioPlayer) {
        elements.audioPlayer.currentTime = 0;
    }
    
    // Generate download URL (simulate processed file)
    appState.processedAudioUrl = appState.audioPreview; // In real app, this would be the cleaned version
    
    showSection('successSection');
}

// Admin Functions
function showAdminModal() {
    if (elements.adminModal) {
        elements.adminModal.classList.remove('hidden');
        if (elements.adminPassword) {
            elements.adminPassword.focus();
        }
    }
}

function hideAdminModal() {
    if (elements.adminModal) {
        elements.adminModal.classList.add('hidden');
        if (elements.adminPassword) {
            elements.adminPassword.value = '';
        }
    }
}

function processAdminUnlock() {
    if (!elements.adminPassword) return;
    
    const password = elements.adminPassword.value;
    
    if (password === CONFIG.adminPassword) {
        appState.isAdmin = true;
        hideAdminModal();
        
        if (elements.paywallModal && !elements.paywallModal.classList.contains('hidden')) {
            hidePaywall();
        }
        
        unlockFullVersion();
    } else {
        elements.adminPassword.style.borderColor = 'var(--color-error)';
        elements.adminPassword.placeholder = 'Incorrect password';
        elements.adminPassword.value = '';
        
        setTimeout(() => {
            elements.adminPassword.style.borderColor = '';
            elements.adminPassword.placeholder = 'Enter admin password';
        }, 2000);
    }
}

// Download Function
function downloadCleanedAudio() {
    if (appState.processedAudioUrl) {
        const a = document.createElement('a');
        a.href = appState.processedAudioUrl;
        a.download = `cleaned_${appState.currentFile.name}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    }
}

// Event Listeners
function setupEventListeners() {
    if (!elements.dropZone) return;
    
    // File upload events
    elements.dropZone.addEventListener('click', (e) => {
        e.preventDefault();
        if (elements.fileInput) {
            elements.fileInput.click();
        }
    });
    
    if (elements.browseBtn) {
        elements.browseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (elements.fileInput) {
                elements.fileInput.click();
            }
        });
    }
    
    if (elements.fileInput) {
        elements.fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                handleFileSelect(e.target.files[0]);
            }
        });
    }
    
    // Drag and drop events
    elements.dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        elements.dropZone.classList.add('drag-over');
    });
    
    elements.dropZone.addEventListener('dragleave', () => {
        elements.dropZone.classList.remove('drag-over');
    });
    
    elements.dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        elements.dropZone.classList.remove('drag-over');
        
        if (e.dataTransfer.files.length > 0) {
            handleFileSelect(e.dataTransfer.files[0]);
        }
    });
    
    // Modal events
    if (elements.modalClose) {
        elements.modalClose.addEventListener('click', hidePaywall);
    }
    
    if (elements.adminModalClose) {
        elements.adminModalClose.addEventListener('click', hideAdminModal);
    }
    
    // Click outside modal to close
    if (elements.paywallModal) {
        elements.paywallModal.addEventListener('click', (e) => {
            if (e.target === elements.paywallModal) {
                hidePaywall();
            }
        });
    }
    
    if (elements.adminModal) {
        elements.adminModal.addEventListener('click', (e) => {
            if (e.target === elements.adminModal) {
                hideAdminModal();
            }
        });
    }
    
    // Payment tier buttons
    document.querySelectorAll('.tier-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            processPurchase(btn.dataset.tier);
        });
    });
    
    // Admin unlock
    if (elements.adminUnlock) {
        elements.adminUnlock.addEventListener('click', (e) => {
            e.preventDefault();
            showAdminModal();
        });
    }
    
    if (elements.adminSubmit) {
        elements.adminSubmit.addEventListener('click', processAdminUnlock);
    }
    
    if (elements.adminPassword) {
        elements.adminPassword.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                processAdminUnlock();
            }
        });
    }
    
    // Download button
    if (elements.downloadBtn) {
        elements.downloadBtn.addEventListener('click', downloadCleanedAudio);
    }
    
    // Retry button
    if (elements.retryBtn) {
        elements.retryBtn.addEventListener('click', resetApp);
    }
    
    // Setup audio player
    setupAudioPlayer();
}

// Keyboard shortcuts
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // ESC to close modals
        if (e.key === 'Escape') {
            if (elements.paywallModal && !elements.paywallModal.classList.contains('hidden')) {
                hidePaywall();
            }
            if (elements.adminModal && !elements.adminModal.classList.contains('hidden')) {
                hideAdminModal();
            }
        }
        
        // Space to play/pause audio
        if (e.key === ' ' && elements.audioPlayer && elements.audioPlayer.src) {
            e.preventDefault();
            if (elements.audioPlayer.paused) {
                elements.audioPlayer.play();
            } else {
                elements.audioPlayer.pause();
            }
        }
    });
}

// Initialize Application
function initializeApp() {
    // Initialize DOM elements first
    initializeElements();
    
    // Setup event listeners and shortcuts
    setupEventListeners();
    setupKeyboardShortcuts();
    
    // Show upload section initially
    showSection('uploadSection');
    
    console.log('FWEA-I Omnilingual Clean Version Editor initialized');
}

// Start the application when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// Error handling for uncaught errors
window.addEventListener('error', (e) => {
    console.error('Application error:', e.error);
    showError('An unexpected error occurred. Please refresh the page and try again.');
});

// Service worker registration (for offline functionality)
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // In a real app, you would register a service worker here
        console.log('Service worker support detected');
    });
}
