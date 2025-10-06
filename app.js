// Enhanced FWEA-I Omnilingual Clean Version Editor with Vocal Isolation
// Configuration and Application State

console.log('🎵 FWEA-I Loading...');

const CONFIG = {
    // Server configuration
    hetzner: {
        baseUrl: "https://178.156.190.229:8000",
        endpoints: {
            upload: "/preview",
            process: "/clean",
            download: "/download",
            status: "/status",
            separate: "/separate"
        }
    },
    
    // Cloudflare configuration
    cloudflare: {
        accountId: "94ad1fffaa41132c2ff517ce46f76692",
        whisperModel: "@cf/openai/whisper",
        aiGateway: "https://gateway.ai.cloudflare.com/v1/94ad1fffaa41132c2ff517ce46f76692/audio-clean/workers-ai",
        worker_url: "https://omni-clean-5.fweago-flavaz.workers.dev"
    },
    
    // Stripe configuration
    stripe: {
        publishableKey: "pk_live_51RW06LJ2Iq1764pCr02p7yLia0VqBgUcRfG7Qm5OWFNAwFZcexIs9iBB3B9s22elcQzQjuAUMBxpeUhwcm8hsDf900NbCbF3Vw",
        pricing: {
            single: {
                name: "Single Song",
                price: "$2.99",
                priceId: "price_1SF2ZGJ2Iq1764pCKiLND2oR"
            },
            day: {
                name: "Day Pass",
                price: "$9.99",
                priceId: "price_1S4NsTJ2Iq1764pCCbru0Aao"
            },
            monthly: {
                name: "Monthly Pro",
                price: "$29.99",
                priceId: "price_1SF2fxJ2Iq1764pCe77B6Cuo"
            }
        }
    },
    
    // Audio configuration with vocal isolation
    audio: {
        supportedFormats: ["mp3", "wav", "m4a", "aac", "flac", "ogg"],
        maxFileSize: 104857600, // 100MB
        previewDuration: 30,
        chunkSize: 1048576, // 1MB
        sampleRate: 44100,
        vocalIsolation: {
            enabled: true,
            model: "spleeter_2stems",
            quality: "high"
        },
        echoFill: {
            enabled: true,
            delay: 0.25, // 1/4 second
            decay: 0.4,
            preWordCapture: 0.5
        }
    },
    
    // Language support
    languages: [
        "English", "Spanish", "French", "Portuguese", "Italian", "German", 
        "Russian", "Arabic", "Chinese (Mandarin)", "Japanese", "Korean", 
        "Hindi", "Dutch", "Swedish", "Norwegian", "Polish", "Turkish",
        "Auto-detect"
    ],
    
    // Admin configuration
    admin: {
        password: "admin2024"
    }
};

// Application State Management
class AppState {
    constructor() {
        console.log('🔧 Initializing AppState...');
        this.reset();
        this.stripe = null;
        this.initializeStripe();
    }
    
    async initializeStripe() {
        try {
            if (window.Stripe) {
                this.stripe = Stripe(CONFIG.stripe.publishableKey);
                console.log('✅ Stripe initialized successfully');
            } else {
                console.warn('⚠️ Stripe not available');
            }
        } catch (error) {
            console.error('❌ Failed to initialize Stripe:', error);
        }
    }
    
    reset() {
        console.log('🔄 Resetting application state...');
        this.currentFile = null;
        this.isAdmin = false;
        this.processingStep = 0;
        this.processingProgress = 0;
        this.audioPreview = null;
        this.vocalTrack = null;
        this.instrumentalTrack = null;
        this.mutedSections = [];
        this.echoFills = [];
        this.processedAudioUrl = null;
        this.previewTimeout = null;
        this.uploadStartTime = null;
        this.processingStartTime = null;
        this.transcriptionData = null;
        this.languageDetection = null;
        this.explicitContent = [];
        this.serverOnline = true;
        this.vocalIsolationData = null;
    }
}

// Global state instance
const appState = new AppState();

// DOM Elements Manager with Enhanced Error Handling
class DOMManager {
    constructor() {
        console.log('🔧 Initializing DOMManager...');
        this.elements = {};
        this.initialized = false;
        
        // Initialize immediately if DOM is ready, otherwise wait
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            setTimeout(() => this.initialize(), 100); // Small delay to ensure all elements are rendered
        }
    }
    
    initialize() {
        try {
            console.log('🏗️ Setting up DOM elements...');
            
            const elementIds = [
                'dropZone', 'fileInput', 'browseBtn', 'uploadSection', 'uploadProgress',
                'fileName', 'fileSize', 'uploadSpeed', 'uploadEta', 'progressFill', 'progressText',
                'processingSection', 'processingRing', 'processingPercentage', 'etaDisplay',
                'transcriptionPreview', 'detectedLanguage', 'languageConfidence', 'explicitCount',
                'transcriptText', 'previewSection', 'audioPlayer', 'waveform', 'mutedSections',
                'playhead', 'currentTime', 'totalTime', 'vocalMutedCount', 'echoFillCount',
                'instrumentalPreserved', 'processingTime', 'previewTimeout', 'timeoutFill', 'timeoutCountdown',
                'successSection', 'finalVocalsCleaned', 'finalInstrumentalPreserved', 'downloadBtn',
                'processAnotherBtn', 'returnHomeBtn', 'errorSection', 'errorMessage', 'retryBtn',
                'contactSupportBtn', 'skeletonLoader', 'serverStatus', 'adminUnlock',
                'paywallModal', 'paywallOverlay', 'modalClose', 'adminModal', 'adminOverlay', 
                'adminModalClose', 'adminPassword', 'adminSubmit', 'paymentModal',
                'vocalTrack', 'instrumentalTrack', 'echoFills', 'particlesContainer'
            ];
            
            let foundElements = 0;
            elementIds.forEach(id => {
                const element = document.getElementById(id);
                if (element) {
                    this.elements[id] = element;
                    foundElements++;
                } else {
                    console.warn(`⚠️ Element not found: ${id}`);
                }
            });
            
            // Get step elements
            for (let i = 1; i <= 4; i++) {
                const stepElement = document.getElementById(`step${i}`);
                if (stepElement) {
                    this.elements[`step${i}`] = stepElement;
                    foundElements++;
                }
            }
            
            // Get tier buttons
            this.elements.tierButtons = document.querySelectorAll('.tier-btn');
            
            console.log(`✅ DOM Manager initialized with ${foundElements} elements found`);
            this.initialized = true;
            
            // Setup immediate event handlers
            this.setupImmediateHandlers();
            
        } catch (error) {
            console.error('❌ Failed to initialize DOM Manager:', error);
        }
    }
    
    setupImmediateHandlers() {
        try {
            console.log('⚡ Setting up immediate handlers...');
            
            // Critical fix: Setup browse button immediately
            const browseBtn = this.get('browseBtn');
            const fileInput = this.get('fileInput');
            
            if (browseBtn && fileInput) {
                browseBtn.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🖱️ Browse button clicked - triggering file input');
                    fileInput.click();
                };
                console.log('✅ Browse button handler attached');
            } else {
                console.error('❌ Critical elements missing for browse functionality');
            }
            
            // Critical fix: Setup admin button immediately
            const adminUnlock = this.get('adminUnlock');
            if (adminUnlock) {
                adminUnlock.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('👨‍💼 Admin button clicked - showing modal');
                    this.show('adminModal');
                    const passwordInput = this.get('adminPassword');
                    if (passwordInput) {
                        passwordInput.focus();
                        passwordInput.value = '';
                    }
                };
                console.log('✅ Admin button handler attached');
            } else {
                console.error('❌ Admin button not found');
            }
            
        } catch (error) {
            console.error('❌ Failed to setup immediate handlers:', error);
        }
    }
    
    get(elementId) {
        const element = this.elements[elementId];
        if (!element && this.initialized) {
            console.warn(`⚠️ Element '${elementId}' not found in DOM`);
        }
        return element;
    }
    
    show(elementId) {
        const element = this.get(elementId);
        if (element) {
            element.classList.remove('hidden');
            console.log(`👁️ Showing element: ${elementId}`);
        }
    }
    
    hide(elementId) {
        const element = this.get(elementId);
        if (element) {
            element.classList.add('hidden');
            console.log(`🙈 Hiding element: ${elementId}`);
        }
    }
    
    showSection(sectionId) {
        console.log(`📋 Switching to section: ${sectionId}`);
        // Hide all main sections
        ['uploadSection', 'processingSection', 'previewSection', 'successSection', 'errorSection'].forEach(id => {
            this.hide(id);
        });
        // Show target section
        this.show(sectionId);
    }
}

// Utility Functions
class Utils {
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    static formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
    
    static formatSpeed(bytesPerSecond) {
        return this.formatFileSize(bytesPerSecond) + '/s';
    }
    
    static calculateETA(totalBytes, uploadedBytes, speed) {
        if (speed <= 0) return 'Calculating...';
        const remainingBytes = totalBytes - uploadedBytes;
        const eta = Math.ceil(remainingBytes / speed);
        return `${eta}s remaining`;
    }
    
    static generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }
    
    static async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    static logError(context, error) {
        console.error(`❌ Error in ${context}:`, error);
    }

    static logSuccess(message) {
        console.log(`✅ ${message}`);
    }
}

// Enhanced Particle Animation Manager
class ParticleManager {
    static initialize() {
        try {
            console.log('✨ Initializing particle animation...');
            const particlesContainer = dom.get('particlesContainer');
            
            if (!particlesContainer) {
                console.warn('⚠️ Particles container not found');
                return;
            }
            
            // Clear existing particles and create new ones
            particlesContainer.innerHTML = '';
            
            for (let i = 0; i < 8; i++) {
                const particle = document.createElement('div');
                particle.className = 'particle';
                particle.style.left = Math.random() * 100 + '%';
                particle.style.animationDelay = Math.random() * 6 + 's';
                particle.style.animationDuration = (6 + Math.random() * 4) + 's';
                particlesContainer.appendChild(particle);
            }
            
            console.log('✅ Particle animation initialized with 8 particles');
        } catch (error) {
            Utils.logError('ParticleManager.initialize', error);
        }
    }
}

// Enhanced File Handling Manager
class FileManager {
    static validateFile(file) {
        console.log('🔍 Validating file:', file.name, Utils.formatFileSize(file.size));
        
        if (!file) {
            throw new Error('No file selected');
        }
        
        const fileExtension = file.name.split('.').pop().toLowerCase();
        
        if (!CONFIG.audio.supportedFormats.includes(fileExtension)) {
            throw new Error(`Unsupported file format. Please use: ${CONFIG.audio.supportedFormats.join(', ').toUpperCase()}`);
        }
        
        if (file.size > CONFIG.audio.maxFileSize) {
            throw new Error(`File size exceeds ${Utils.formatFileSize(CONFIG.audio.maxFileSize)} limit.`);
        }
        
        if (file.size === 0) {
            throw new Error('File appears to be empty. Please select a valid audio file.');
        }
        
        console.log('✅ File validation passed');
        return true;
    }
    
    static async handleFileSelect(file) {
        try {
            console.log('📁 Handling file selection...');
            
            this.validateFile(file);
            appState.currentFile = file;
            appState.uploadStartTime = Date.now();
            
            console.log('📊 File info:', {
                name: file.name,
                size: Utils.formatFileSize(file.size),
                type: file.type
            });
            
            // Update UI with file info
            this.updateFileInfo(file);
            dom.show('uploadProgress');
            
            // Start enhanced upload simulation
            await this.simulateUpload();
            
        } catch (error) {
            Utils.logError('FileManager.handleFileSelect', error);
            ErrorManager.showError(error.message);
        }
    }

    static updateFileInfo(file) {
        const fileName = dom.get('fileName');
        const fileSize = dom.get('fileSize');
        
        if (fileName) fileName.textContent = file.name;
        if (fileSize) fileSize.textContent = Utils.formatFileSize(file.size);
    }
    
    static async simulateUpload() {
        console.log('⬆️ Starting upload simulation...');
        
        let progress = 0;
        let uploadedBytes = 0;
        const totalBytes = appState.currentFile.size;
        const startTime = Date.now();
        
        return new Promise((resolve) => {
            const uploadInterval = setInterval(() => {
                try {
                    // Simulate realistic upload progress
                    const increment = Math.random() * 8 + 2; // 2-10% increments
                    progress = Math.min(progress + increment, 100);
                    uploadedBytes = Math.floor((progress / 100) * totalBytes);
                    
                    // Calculate upload speed and ETA
                    const elapsed = (Date.now() - startTime) / 1000;
                    const speed = uploadedBytes / elapsed;
                    const eta = Utils.calculateETA(totalBytes, uploadedBytes, speed);
                    
                    // Update UI
                    this.updateUploadProgress(progress, speed, eta);
                    
                    if (progress >= 100) {
                        clearInterval(uploadInterval);
                        console.log('✅ Upload simulation completed');
                        setTimeout(() => {
                            ProcessingManager.startProcessing();
                            resolve();
                        }, 500);
                    }
                } catch (error) {
                    clearInterval(uploadInterval);
                    Utils.logError('FileManager.simulateUpload', error);
                    ErrorManager.showError('Upload failed. Please try again.');
                }
            }, 300);
        });
    }

    static updateUploadProgress(progress, speed, eta) {
        const progressFill = dom.get('progressFill');
        const progressText = dom.get('progressText');
        const uploadSpeed = dom.get('uploadSpeed');
        const uploadEta = dom.get('uploadEta');

        if (progressFill) progressFill.style.width = progress + '%';
        if (progressText) progressText.textContent = Math.round(progress) + '%';
        if (uploadSpeed) uploadSpeed.textContent = Utils.formatSpeed(speed);
        if (uploadEta) uploadEta.textContent = eta;
    }
}

// Enhanced Processing Manager with Vocal Isolation
class ProcessingManager {
    static async startProcessing() {
        try {
            console.log('🎛️ Starting vocal isolation and audio processing...');
            dom.showSection('processingSection');
            appState.processingStep = 1;
            appState.processingStartTime = Date.now();
            
            // Run processing steps with vocal isolation
            await this.runVocalIsolationSteps();
        } catch (error) {
            Utils.logError('ProcessingManager.startProcessing', error);
            ErrorManager.showError('Processing failed. Please try again.');
        }
    }
    
    static async runVocalIsolationSteps() {
        const steps = [
            { name: "Separating vocals from instrumentals", duration: 3000, icon: "🎼" },
            { name: "Transcribing vocal track with Whisper AI", duration: 3500, icon: "🗣️" },
            { name: "Detecting explicit content with timestamps", duration: 2500, icon: "🔍" },
            { name: "Creating echo fill & merging tracks", duration: 4000, icon: "✨" }
        ];
        
        for (let i = 0; i < steps.length; i++) {
            const step = i + 1;
            console.log(`🔄 Processing step ${step}: ${steps[i].name}`);
            
            await this.updateProcessingStep(step, steps[i]);
            
            // Show transcription preview at step 3
            if (step === 3) {
                await this.showVocalAnalysisPreview();
            }
            
            // Simulate processing with progress animation
            await this.animateStepProgress(steps[i].duration, step);
            
            // Mark step as completed
            this.markStepCompleted(step);
        }
        
        await this.completeVocalProcessing();
    }
    
    static async updateProcessingStep(step, stepInfo) {
        appState.processingStep = step;
        console.log(`📊 Processing step ${step}: ${stepInfo.name}`);
        
        // Update step indicators
        for (let i = 1; i <= 4; i++) {
            const stepElement = dom.get(`step${i}`);
            if (stepElement) {
                stepElement.classList.remove('active', 'completed');
                
                if (i < step) {
                    stepElement.classList.add('completed');
                } else if (i === step) {
                    stepElement.classList.add('active');
                }
            }
        }
        
        // Update ETA display
        const remaining = (4 - step + 1) * 2.5;
        const etaDisplay = dom.get('etaDisplay');
        if (etaDisplay) {
            etaDisplay.textContent = `Processing vocals... ${remaining.toFixed(0)}s remaining`;
        }
    }

    static markStepCompleted(step) {
        const stepElement = dom.get(`step${step}`);
        if (stepElement) {
            stepElement.classList.remove('active');
            stepElement.classList.add('completed');
        }
    }
    
    static async animateStepProgress(duration, step) {
        const startProgress = ((step - 1) / 4) * 100;
        const endProgress = (step / 4) * 100;
        
        return new Promise(resolve => {
            let progress = startProgress;
            const increment = (endProgress - startProgress) / (duration / 50);
            
            const progressInterval = setInterval(() => {
                try {
                    progress = Math.min(progress + increment, endProgress);
                    
                    // Update ring progress
                    const processingRing = dom.get('processingRing');
                    if (processingRing) {
                        const degrees = (progress / 100) * 360;
                        processingRing.style.background = 
                            `conic-gradient(var(--theme-primary) ${degrees}deg, rgba(0, 245, 212, 0.1) ${degrees}deg)`;
                    }
                    
                    // Update percentage
                    const processingPercentage = dom.get('processingPercentage');
                    if (processingPercentage) {
                        processingPercentage.textContent = Math.round(progress) + '%';
                    }
                    
                    if (progress >= endProgress) {
                        clearInterval(progressInterval);
                        resolve();
                    }
                } catch (error) {
                    clearInterval(progressInterval);
                    Utils.logError('ProcessingManager.animateStepProgress', error);
                    resolve();
                }
            }, 50);
        });
    }
    
    static async showVocalAnalysisPreview() {
        try {
            console.log('🎤 Showing vocal analysis preview...');
            dom.show('transcriptionPreview');
            
            // Simulate language detection
            const detectedLang = CONFIG.languages[Math.floor(Math.random() * (CONFIG.languages.length - 1))];
            const confidence = Math.floor(Math.random() * 15 + 85); // 85-100%
            
            appState.languageDetection = { language: detectedLang, confidence };
            
            // Update language info
            this.updateLanguageDetection(detectedLang, confidence);
            
            // Generate realistic vocal transcript
            const transcript = await this.generateVocalTranscript(detectedLang);
            const explicitContent = this.detectExplicitContent(transcript);
            
            appState.transcriptionData = transcript;
            appState.explicitContent = explicitContent;
            
            // Update explicit content count
            this.updateExplicitContentInfo(explicitContent);
            
            // Display highlighted transcript
            this.displayTranscript(transcript, explicitContent);
            
            // Generate processing data for vocal isolation
            this.generateVocalProcessingData(explicitContent.length);
            
        } catch (error) {
            Utils.logError('ProcessingManager.showVocalAnalysisPreview', error);
        }
    }

    static updateLanguageDetection(language, confidence) {
        const detectedLanguage = dom.get('detectedLanguage');
        const languageConfidence = dom.get('languageConfidence');

        if (detectedLanguage) detectedLanguage.textContent = language;
        if (languageConfidence) languageConfidence.textContent = confidence + '%';
    }

    static updateExplicitContentInfo(explicitContent) {
        const explicitCount = dom.get('explicitCount');
        if (explicitCount) {
            explicitCount.textContent = `${explicitContent.length} instances in vocal track`;
        }
    }

    static displayTranscript(transcript, explicitContent) {
        const transcriptText = dom.get('transcriptText');
        if (transcriptText) {
            transcriptText.innerHTML = this.highlightExplicitContent(transcript, explicitContent);
        }
    }
    
    static async generateVocalTranscript(language) {
        // Realistic vocal transcript generation based on language
        const transcripts = {
            "English": "Walking down the street feeling good, this damn song is playing, nothing can fucking stop me now, shit this beat is fire, bitch please don't kill my vibe today",
            "Spanish": "Caminando por la calle sintiéndome bien, esta mierda de canción está sonando, nadie me puede parar ahora, este puto ritmo es fuego",
            "French": "Je marche dans la rue, je me sens bien, cette putain de chanson joue, rien ne peut m'arrêter maintenant, ce rythme est de la merde",
            "Portuguese": "Caminhando pela rua me sentindo bem, esta merda de música está tocando, nada pode me parar agora, este porra de ritmo é fogo"
        };
        
        return transcripts[language] || transcripts["English"];
    }
    
    static detectExplicitContent(text) {
        const profanityPatterns = {
            "English": ["damn", "fucking", "shit", "bitch", "fuck"],
            "Spanish": ["mierda", "puto", "joder"],
            "French": ["putain", "merde", "connard"],
            "Portuguese": ["merda", "porra", "caralho"]
        };
        
        const patterns = profanityPatterns["English"]; // Default to English for demo
        const words = [];
        
        patterns.forEach(word => {
            const regex = new RegExp(`\\b${word}\\b`, 'gi');
            let match;
            while ((match = regex.exec(text)) !== null) {
                words.push({
                    word: match[0].toLowerCase(),
                    start: match.index,
                    timestamp: Math.random() * CONFIG.audio.previewDuration
                });
            }
        });
        
        return words;
    }
    
    static highlightExplicitContent(text, explicitWords) {
        let highlightedText = text;
        
        explicitWords.forEach(item => {
            const regex = new RegExp(`\\b${item.word}\\b`, 'gi');
            highlightedText = highlightedText.replace(regex, 
                `<span class="explicit-word" title="Vocal content to be muted">${item.word}</span>`);
        });
        
        return highlightedText;
    }
    
    static generateVocalProcessingData(explicitCount) {
        // Generate muted sections (vocal track only)
        const mutedSections = [];
        const echoFills = [];
        const maxTime = CONFIG.audio.previewDuration - 2;
        
        for (let i = 0; i < explicitCount; i++) {
            const start = Math.random() * maxTime;
            const duration = 0.5 + Math.random() * 1.5; // 0.5-2 second duration
            
            // Muted section in vocal track
            mutedSections.push({ start, duration });
            
            // Echo fill section (1/4 second delay from previous word)
            const echoStart = Math.max(0, start - CONFIG.audio.echoFill.preWordCapture);
            const echoEnd = start + CONFIG.audio.echoFill.delay;
            echoFills.push({ 
                start: echoStart, 
                duration: echoEnd - echoStart,
                type: 'echo-fill'
            });
        }
        
        appState.mutedSections = mutedSections.sort((a, b) => a.start - b.start);
        appState.echoFills = echoFills.sort((a, b) => a.start - b.start);
        
        console.log('🎯 Generated vocal processing data:', {
            mutedSections: mutedSections.length,
            echoFills: echoFills.length
        });
    }
    
    static async completeVocalProcessing() {
        try {
            console.log('🎉 Vocal processing completed, showing preview...');
            
            // Create audio preview with original file (in real app, this would be the processed version)
            const audioUrl = URL.createObjectURL(appState.currentFile);
            const audioPlayer = dom.get('audioPlayer');
            if (audioPlayer) {
                audioPlayer.src = audioUrl;
                audioPlayer.load(); // Force reload
            }
            appState.audioPreview = audioUrl;
            
            // Calculate processing time
            const processingTime = Math.floor((Date.now() - appState.processingStartTime) / 1000);
            
            // Update vocal isolation stats
            this.updateVocalIsolationStats(processingTime);
            
            // Render vocal waveform visualization
            AudioManager.renderVocalWaveform();
            
            dom.showSection('previewSection');
            
            // Start preview timeout unless admin
            if (!appState.isAdmin) {
                this.startPreviewTimeout();
            }
            
        } catch (error) {
            Utils.logError('ProcessingManager.completeVocalProcessing', error);
            ErrorManager.showError('Failed to complete processing. Please try again.');
        }
    }

    static updateVocalIsolationStats(processingTime) {
        const vocalMutedCount = dom.get('vocalMutedCount');
        const echoFillCount = dom.get('echoFillCount');
        const instrumentalPreserved = dom.get('instrumentalPreserved');
        const processingTimeElement = dom.get('processingTime');

        const mutedCount = appState.mutedSections.length;
        const echoCount = appState.echoFills.length;

        if (vocalMutedCount) vocalMutedCount.textContent = mutedCount;
        if (echoFillCount) echoFillCount.textContent = echoCount;
        if (instrumentalPreserved) instrumentalPreserved.textContent = '100%';
        if (processingTimeElement) processingTimeElement.textContent = processingTime + 's';
    }
    
    static startPreviewTimeout() {
        let timeLeft = CONFIG.audio.previewDuration;
        
        console.log('⏰ Starting 30-second preview timeout...');
        
        const timeoutCountdown = dom.get('timeoutCountdown');
        if (timeoutCountdown) {
            timeoutCountdown.textContent = timeLeft;
        }
        
        const countdownInterval = setInterval(() => {
            try {
                timeLeft--;
                
                if (timeoutCountdown) {
                    timeoutCountdown.textContent = timeLeft;
                }
                
                const timeoutFill = dom.get('timeoutFill');
                if (timeoutFill) {
                    const percentage = (timeLeft / CONFIG.audio.previewDuration) * 100;
                    timeoutFill.style.width = percentage + '%';
                }
                
                if (timeLeft <= 0) {
                    clearInterval(countdownInterval);
                    const audioPlayer = dom.get('audioPlayer');
                    if (audioPlayer) {
                        audioPlayer.pause();
                    }
                    console.log('⏰ Preview timeout reached, showing paywall...');
                    PaymentManager.showPaywall();
                }
            } catch (error) {
                clearInterval(countdownInterval);
                Utils.logError('ProcessingManager.startPreviewTimeout', error);
            }
        }, 1000);
        
        appState.previewTimeout = countdownInterval;
    }
}

// Enhanced Audio Manager with Vocal Isolation Features
class AudioManager {
    static setupAudioPlayer() {
        try {
            console.log('🎵 Setting up enhanced audio player...');
            const audio = dom.get('audioPlayer');
            if (!audio) {
                console.warn('⚠️ Audio player element not found');
                return;
            }
            
            // Remove existing event listeners
            audio.removeEventListener('timeupdate', this.handleTimeUpdate);
            audio.removeEventListener('loadedmetadata', this.handleMetadataLoaded);
            audio.removeEventListener('ended', this.handleAudioEnded);
            
            // Add event listeners with proper context binding
            this.handleTimeUpdate = this.handleTimeUpdate.bind(this);
            this.handleMetadataLoaded = this.handleMetadataLoaded.bind(this);
            this.handleAudioEnded = this.handleAudioEnded.bind(this);
            
            audio.addEventListener('timeupdate', this.handleTimeUpdate);
            audio.addEventListener('loadedmetadata', this.handleMetadataLoaded);
            audio.addEventListener('ended', this.handleAudioEnded);
            
            console.log('✅ Audio player event listeners setup completed');
            
        } catch (error) {
            Utils.logError('AudioManager.setupAudioPlayer', error);
        }
    }

    static handleTimeUpdate(event) {
        try {
            const audio = event.target;
            const currentTime = audio.currentTime;
            
            // Update time display
            const currentTimeDisplay = dom.get('currentTime');
            if (currentTimeDisplay) {
                currentTimeDisplay.textContent = Utils.formatTime(currentTime);
            }
            
            // Update playhead position
            const playhead = dom.get('playhead');
            if (playhead) {
                const percentage = (currentTime / CONFIG.audio.previewDuration) * 100;
                playhead.style.left = percentage + '%';
            }
            
            // Handle vocal muting during explicit sections
            let shouldMute = false;
            appState.mutedSections.forEach(section => {
                if (currentTime >= section.start && currentTime <= section.start + section.duration) {
                    shouldMute = true;
                }
            });
            
            // In real app, this would mute only the vocal track
            if (shouldMute !== audio.muted) {
                audio.muted = shouldMute;
                if (shouldMute) {
                    console.log('🔇 Muting vocal content at', Utils.formatTime(currentTime));
                } else {
                    console.log('🔊 Unmuting at', Utils.formatTime(currentTime));
                }
            }
            
        } catch (error) {
            Utils.logError('AudioManager.handleTimeUpdate', error);
        }
    }

    static handleMetadataLoaded(event) {
        try {
            const audio = event.target;
            const duration = Math.min(audio.duration, CONFIG.audio.previewDuration);
            
            const totalTime = dom.get('totalTime');
            if (totalTime) {
                totalTime.textContent = Utils.formatTime(duration);
            }
            
            console.log('📊 Audio metadata loaded:', {
                duration: Utils.formatTime(duration),
                sampleRate: audio.sampleRate || 'unknown'
            });
            
        } catch (error) {
            Utils.logError('AudioManager.handleMetadataLoaded', error);
        }
    }

    static handleAudioEnded(event) {
        try {
            const playhead = dom.get('playhead');
            if (playhead) {
                playhead.style.left = '0%';
            }
            console.log('🏁 Audio playback ended');
        } catch (error) {
            Utils.logError('AudioManager.handleAudioEnded', error);
        }
    }
    
    static renderVocalWaveform() {
        try {
            console.log('🌊 Rendering vocal isolation waveform...');
            
            // Render vocal track visualization
            this.renderVocalTrack();
            
            // Render instrumental track visualization  
            this.renderInstrumentalTrack();
            
            // Render muted sections (vocal only)
            this.renderMutedSections();
            
            // Render echo fills
            this.renderEchoFills();
            
            console.log('✅ Vocal waveform rendered successfully');
            
        } catch (error) {
            Utils.logError('AudioManager.renderVocalWaveform', error);
        }
    }

    static renderVocalTrack() {
        const vocalTrack = dom.get('vocalTrack');
        if (vocalTrack) {
            vocalTrack.style.display = 'block';
            console.log('🎤 Vocal track visualization enabled');
        }
    }

    static renderInstrumentalTrack() {
        const instrumentalTrack = dom.get('instrumentalTrack');
        if (instrumentalTrack) {
            instrumentalTrack.style.display = 'block';
            console.log('🎺 Instrumental track visualization enabled');
        }
    }

    static renderMutedSections() {
        const mutedSectionsContainer = dom.get('mutedSections');
        if (!mutedSectionsContainer) return;
        
        mutedSectionsContainer.innerHTML = '';
        
        console.log('🔇 Rendering', appState.mutedSections.length, 'muted vocal sections');
        
        appState.mutedSections.forEach((section, index) => {
            const div = document.createElement('div');
            div.className = 'muted-section';
            div.style.left = (section.start / CONFIG.audio.previewDuration * 100) + '%';
            div.style.width = (section.duration / CONFIG.audio.previewDuration * 100) + '%';
            
            // Add tooltip
            div.title = `Muted vocal: ${Utils.formatTime(section.start)} - ${Utils.formatTime(section.start + section.duration)}`;
            
            mutedSectionsContainer.appendChild(div);
        });
    }

    static renderEchoFills() {
        const echoFillsContainer = dom.get('echoFills');
        if (!echoFillsContainer) return;
        
        echoFillsContainer.innerHTML = '';
        
        console.log('🔄 Rendering', appState.echoFills.length, 'echo fill sections');
        
        appState.echoFills.forEach((section, index) => {
            const div = document.createElement('div');
            div.className = 'echo-fill';
            div.style.left = (section.start / CONFIG.audio.previewDuration * 100) + '%';
            div.style.width = (section.duration / CONFIG.audio.previewDuration * 100) + '%';
            
            // Add tooltip
            div.title = `Echo fill: ${Utils.formatTime(section.start)} - ${Utils.formatTime(section.start + section.duration)}`;
            
            echoFillsContainer.appendChild(div);
        });
    }
}

// Enhanced Payment Manager
class PaymentManager {
    static showPaywall() {
        try {
            console.log('💳 Showing payment modal...');
            dom.show('paywallModal');
        } catch (error) {
            Utils.logError('PaymentManager.showPaywall', error);
        }
    }
    
    static hidePaywall() {
        try {
            console.log('❌ Hiding payment modal...');
            dom.hide('paywallModal');
        } catch (error) {
            Utils.logError('PaymentManager.hidePaywall', error);
        }
    }
    
    static async processPurchase(tier) {
        try {
            console.log('💰 Processing purchase for tier:', tier);
            
            if (!appState.stripe) {
                throw new Error('Stripe not initialized. Please refresh the page and try again.');
            }
            
            const priceId = CONFIG.stripe.pricing[tier]?.priceId;
            if (!priceId) {
                throw new Error('Invalid pricing tier selected.');
            }
            
            // Show payment processing modal
            dom.show('paymentModal');
            dom.hide('paywallModal');
            
            console.log('🔄 Redirecting to Stripe checkout...');
            
            // Create checkout session
            const { error } = await appState.stripe.redirectToCheckout({
                lineItems: [{ price: priceId, quantity: 1 }],
                mode: 'payment',
                successUrl: `${window.location.origin}?payment=success`,
                cancelUrl: `${window.location.origin}?payment=cancelled`
            });
            
            if (error) {
                throw error;
            }
            
        } catch (error) {
            console.error('💳 Payment processing error:', error);
            dom.hide('paymentModal');
            ErrorManager.showError(`Payment failed: ${error.message}`);
        }
    }
    
    static handlePaymentSuccess() {
        try {
            console.log('✅ Payment successful, unlocking full vocal isolation version...');
            dom.hide('paymentModal');
            this.unlockFullVersion();
        } catch (error) {
            Utils.logError('PaymentManager.handlePaymentSuccess', error);
        }
    }
    
    static unlockFullVersion() {
        try {
            console.log('🔓 Unlocking full vocal isolation version...');
            
            if (appState.previewTimeout) {
                clearInterval(appState.previewTimeout);
                appState.previewTimeout = null;
            }
            
            // Hide timeout display
            dom.hide('previewTimeout');
            
            // Remove time limit from audio
            const audio = dom.get('audioPlayer');
            if (audio) {
                audio.currentTime = 0;
                audio.muted = false;
                // In a real app, load the full cleaned audio with vocal isolation here
            }
            
            // Generate download URL (in real app, get from server)
            appState.processedAudioUrl = appState.audioPreview;
            
            this.showSuccessScreen();
            
        } catch (error) {
            Utils.logError('PaymentManager.unlockFullVersion', error);
        }
    }
    
    static showSuccessScreen() {
        try {
            console.log('🎉 Showing success screen...');
            
            // Update final vocal isolation stats
            const finalVocalsCleaned = dom.get('finalVocalsCleaned');
            const finalInstrumentalPreserved = dom.get('finalInstrumentalPreserved');
            
            if (finalVocalsCleaned) {
                finalVocalsCleaned.textContent = appState.mutedSections.length;
            }
            if (finalInstrumentalPreserved) {
                finalInstrumentalPreserved.textContent = '100%';
            }
            
            dom.showSection('successSection');
            
        } catch (error) {
            Utils.logError('PaymentManager.showSuccessScreen', error);
        }
    }
}

// Enhanced Admin Manager
class AdminManager {
    static showAdminModal() {
        try {
            console.log('👨‍💼 Showing admin modal...');
            dom.show('adminModal');
            const passwordInput = dom.get('adminPassword');
            if (passwordInput) {
                passwordInput.focus();
                passwordInput.value = '';
            }
        } catch (error) {
            Utils.logError('AdminManager.showAdminModal', error);
        }
    }
    
    static hideAdminModal() {
        try {
            console.log('❌ Hiding admin modal...');
            dom.hide('adminModal');
            const passwordInput = dom.get('adminPassword');
            if (passwordInput) passwordInput.value = '';
        } catch (error) {
            Utils.logError('AdminManager.hideAdminModal', error);
        }
    }
    
    static processAdminUnlock() {
        try {
            const passwordInput = dom.get('adminPassword');
            if (!passwordInput) {
                console.error('❌ Admin password input not found');
                return;
            }
            
            const password = passwordInput.value.trim();
            console.log('🔐 Processing admin unlock...');
            
            if (password === CONFIG.admin.password) {
                console.log('✅ Admin password correct, unlocking...');
                appState.isAdmin = true;
                this.hideAdminModal();
                
                // Hide paywall if visible
                const paywallModal = dom.get('paywallModal');
                if (paywallModal && !paywallModal.classList.contains('hidden')) {
                    dom.hide('paywallModal');
                }
                
                // Hide timeout if in preview
                const previewSection = dom.get('previewSection');
                if (previewSection && !previewSection.classList.contains('hidden')) {
                    dom.hide('previewTimeout');
                    if (appState.previewTimeout) {
                        clearInterval(appState.previewTimeout);
                        appState.previewTimeout = null;
                    }
                }
                
                PaymentManager.unlockFullVersion();
                this.showAdminStatus();
                
            } else {
                console.log('❌ Incorrect admin password');
                this.showPasswordError(passwordInput);
            }
            
        } catch (error) {
            Utils.logError('AdminManager.processAdminUnlock', error);
        }
    }

    static showPasswordError(passwordInput) {
        passwordInput.style.borderColor = 'var(--theme-error)';
        passwordInput.placeholder = 'Incorrect password';
        passwordInput.value = '';
        
        setTimeout(() => {
            passwordInput.style.borderColor = '';
            passwordInput.placeholder = 'Enter admin password';
        }, 2000);
    }
    
    static showAdminStatus() {
        try {
            const adminButton = dom.get('adminUnlock');
            if (adminButton) {
                adminButton.textContent = 'Admin Mode';
                adminButton.style.color = 'var(--theme-primary)';
                adminButton.style.borderColor = 'var(--theme-primary)';
                adminButton.style.boxShadow = '0 0 10px rgba(0, 245, 212, 0.5)';
            }
            console.log('👨‍💼 Admin status displayed');
        } catch (error) {
            Utils.logError('AdminManager.showAdminStatus', error);
        }
    }
}

// Enhanced Error Manager
class ErrorManager {
    static showError(message, actions = null) {
        try {
            console.error('💥 Showing error:', message);
            
            const errorMessage = dom.get('errorMessage');
            if (errorMessage) {
                errorMessage.textContent = message;
            }
            
            // Show/hide additional actions
            const contactBtn = dom.get('contactSupportBtn');
            if (contactBtn) {
                contactBtn.style.display = actions?.showContact ? 'inline-flex' : 'none';
            }
            
            dom.showSection('errorSection');
            
        } catch (error) {
            Utils.logError('ErrorManager.showError', error);
        }
    }
    
    static retry() {
        try {
            console.log('🔄 Retrying application...');
            appState.reset();
            dom.showSection('uploadSection');
            dom.hide('uploadProgress');
            dom.hide('transcriptionPreview');
            
            // Reset progress indicators
            this.resetProgressIndicators();
            
        } catch (error) {
            Utils.logError('ErrorManager.retry', error);
        }
    }

    static resetProgressIndicators() {
        const progressFill = dom.get('progressFill');
        const progressText = dom.get('progressText');
        const processingPercentage = dom.get('processingPercentage');

        if (progressFill) progressFill.style.width = '0%';
        if (progressText) progressText.textContent = '0%';
        if (processingPercentage) processingPercentage.textContent = '0%';
    }
    
    static contactSupport() {
        try {
            console.log('📧 Opening support contact...');
            window.open('mailto:support@fwea-i.com?subject=Vocal%20Isolation%20Audio%20Processing%20Issue', '_blank');
        } catch (error) {
            Utils.logError('ErrorManager.contactSupport', error);
        }
    }
}

// Enhanced Event Manager with Critical Fixes
class EventManager {
    static setupAllEventListeners() {
        try {
            console.log('⚡ Setting up enhanced event listeners...');
            this.setupFileUploadEvents();
            this.setupModalEvents();
            this.setupPaymentEvents();
            this.setupAdminEvents();
            this.setupSuccessEvents();
            this.setupErrorEvents();
            this.setupKeyboardShortcuts();
            this.checkUrlParams();
            console.log('✅ All event listeners setup completed');
        } catch (error) {
            Utils.logError('EventManager.setupAllEventListeners', error);
        }
    }
    
    static setupFileUploadEvents() {
        try {
            console.log('📁 Setting up file upload events...');
            
            const dropZone = dom.get('dropZone');
            const fileInput = dom.get('fileInput');
            
            if (!dropZone || !fileInput) {
                console.warn('⚠️ Critical upload elements missing');
                return;
            }
            
            // Main drop zone click - with improved event handling
            dropZone.addEventListener('click', (e) => {
                console.log('🖱️ Drop zone clicked');
                
                // Don't trigger if click is on browse button itself
                if (e.target.closest('.browse-btn')) {
                    console.log('🖱️ Click was on browse button, not triggering drop zone');
                    return;
                }
                
                e.preventDefault();
                e.stopPropagation();
                fileInput.click();
            });
            
            // Enhanced drag and drop events
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.add('drag-over');
            });
            
            dropZone.addEventListener('dragleave', (e) => {
                e.preventDefault();
                e.stopPropagation();
                // Only remove class if leaving the drop zone entirely
                if (!dropZone.contains(e.relatedTarget)) {
                    dropZone.classList.remove('drag-over');
                }
            });
            
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropZone.classList.remove('drag-over');
                console.log('📁 File dropped');
                
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                    FileManager.handleFileSelect(e.dataTransfer.files[0]);
                }
            });
            
            // File input change event
            fileInput.addEventListener('change', (e) => {
                console.log('📁 File input changed');
                if (e.target.files && e.target.files.length > 0) {
                    FileManager.handleFileSelect(e.target.files[0]);
                }
            });
            
            console.log('✅ File upload events setup completed');
            
        } catch (error) {
            Utils.logError('EventManager.setupFileUploadEvents', error);
        }
    }
    
    static setupModalEvents() {
        try {
            console.log('🪟 Setting up modal events...');
            
            // Paywall modal events
            this.setupPaywallModal();
            
            // Admin modal events  
            this.setupAdminModalEvents();
            
            console.log('✅ Modal events setup completed');
            
        } catch (error) {
            Utils.logError('EventManager.setupModalEvents', error);
        }
    }

    static setupPaywallModal() {
        const modalClose = dom.get('modalClose');
        const paywallOverlay = dom.get('paywallOverlay');

        if (modalClose) {
            modalClose.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('❌ Paywall modal close clicked');
                PaymentManager.hidePaywall();
            });
        }

        if (paywallOverlay) {
            paywallOverlay.addEventListener('click', (e) => {
                if (e.target === paywallOverlay) {
                    console.log('❌ Paywall overlay clicked');
                    PaymentManager.hidePaywall();
                }
            });
        }
    }

    static setupAdminModalEvents() {
        const adminModalClose = dom.get('adminModalClose');
        const adminOverlay = dom.get('adminOverlay');

        if (adminModalClose) {
            adminModalClose.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('❌ Admin modal close clicked');
                AdminManager.hideAdminModal();
            });
        }

        if (adminOverlay) {
            adminOverlay.addEventListener('click', (e) => {
                if (e.target === adminOverlay) {
                    console.log('❌ Admin overlay clicked');
                    AdminManager.hideAdminModal();
                }
            });
        }
    }
    
    static setupPaymentEvents() {
        try {
            console.log('💳 Setting up payment events...');
            
            const tierButtons = dom.elements.tierButtons;
            if (tierButtons && tierButtons.length > 0) {
                tierButtons.forEach((btn, index) => {
                    btn.addEventListener('click', (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        const tier = btn.dataset.tier;
                        console.log(`💰 Tier button ${index + 1} clicked:`, tier);
                        
                        if (tier) {
                            PaymentManager.processPurchase(tier);
                        } else {
                            console.error('❌ No tier data found on button');
                        }
                    });
                });
                console.log(`✅ Payment events setup for ${tierButtons.length} tier buttons`);
            } else {
                console.warn('⚠️ No tier buttons found');
            }
            
        } catch (error) {
            Utils.logError('EventManager.setupPaymentEvents', error);
        }
    }
    
    static setupAdminEvents() {
        try {
            console.log('👨‍💼 Setting up admin events...');
            
            // Admin events are now handled in DOM manager immediate handlers
            const adminSubmit = dom.get('adminSubmit');
            const adminPassword = dom.get('adminPassword');
            
            if (adminSubmit) {
                adminSubmit.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🔐 Admin submit clicked');
                    AdminManager.processAdminUnlock();
                });
            }
            
            if (adminPassword) {
                adminPassword.addEventListener('keypress', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        console.log('🔐 Admin password Enter pressed');
                        AdminManager.processAdminUnlock();
                    }
                });
            }
            
            console.log('✅ Admin events setup completed');
            
        } catch (error) {
            Utils.logError('EventManager.setupAdminEvents', error);
        }
    }
    
    static setupSuccessEvents() {
        try {
            console.log('🎉 Setting up success events...');
            
            const downloadBtn = dom.get('downloadBtn');
            const processAnotherBtn = dom.get('processAnotherBtn');
            const returnHomeBtn = dom.get('returnHomeBtn');
            
            if (downloadBtn) {
                downloadBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('⬇️ Download button clicked');
                    this.downloadCleanedAudio();
                });
            }
            
            if (processAnotherBtn) {
                processAnotherBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🔄 Process another button clicked');
                    this.processAnother();
                });
            }
            
            if (returnHomeBtn) {
                returnHomeBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🏠 Return home button clicked');
                    this.returnHome();
                });
            }
            
            console.log('✅ Success events setup completed');
            
        } catch (error) {
            Utils.logError('EventManager.setupSuccessEvents', error);
        }
    }
    
    static setupErrorEvents() {
        try {
            console.log('💥 Setting up error events...');
            
            const retryBtn = dom.get('retryBtn');
            const contactSupportBtn = dom.get('contactSupportBtn');
            
            if (retryBtn) {
                retryBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('🔄 Retry button clicked');
                    ErrorManager.retry();
                });
            }
            
            if (contactSupportBtn) {
                contactSupportBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('📧 Contact support button clicked');
                    ErrorManager.contactSupport();
                });
            }
            
            console.log('✅ Error events setup completed');
            
        } catch (error) {
            Utils.logError('EventManager.setupErrorEvents', error);
        }
    }
    
    static setupKeyboardShortcuts() {
        try {
            console.log('⌨️ Setting up keyboard shortcuts...');
            
            document.addEventListener('keydown', (e) => {
                try {
                    // ESC to close modals
                    if (e.key === 'Escape') {
                        const paywallModal = dom.get('paywallModal');
                        const adminModal = dom.get('adminModal');
                        
                        if (paywallModal && !paywallModal.classList.contains('hidden')) {
                            PaymentManager.hidePaywall();
                            console.log('⌨️ ESC - Closed paywall modal');
                        }
                        if (adminModal && !adminModal.classList.contains('hidden')) {
                            AdminManager.hideAdminModal();
                            console.log('⌨️ ESC - Closed admin modal');
                        }
                    }
                    
                    // Space to play/pause audio
                    if (e.key === ' ' && !e.target.matches('input, textarea, button')) {
                        e.preventDefault();
                        const audio = dom.get('audioPlayer');
                        if (audio && audio.src) {
                            if (audio.paused) {
                                audio.play().catch(console.error);
                                console.log('⌨️ SPACE - Audio play');
                            } else {
                                audio.pause();
                                console.log('⌨️ SPACE - Audio pause');
                            }
                        }
                    }
                    
                    // Admin shortcut (Ctrl+Shift+A)
                    if (e.ctrlKey && e.shiftKey && e.key === 'A') {
                        e.preventDefault();
                        dom.show('adminModal');
                        const passwordInput = dom.get('adminPassword');
                        if (passwordInput) {
                            passwordInput.focus();
                        }
                        console.log('⌨️ CTRL+SHIFT+A - Admin modal opened');
                    }
                    
                } catch (error) {
                    Utils.logError('EventManager keyboard shortcut', error);
                }
            });
            
            console.log('✅ Keyboard shortcuts setup completed');
            
        } catch (error) {
            Utils.logError('EventManager.setupKeyboardShortcuts', error);
        }
    }
    
    static checkUrlParams() {
        try {
            console.log('🔍 Checking URL parameters...');
            
            const urlParams = new URLSearchParams(window.location.search);
            const payment = urlParams.get('payment');
            
            if (payment === 'success') {
                console.log('✅ Payment success detected from URL');
                PaymentManager.handlePaymentSuccess();
                // Clean URL
                window.history.replaceState({}, document.title, window.location.pathname);
            } else if (payment === 'cancelled') {
                console.log('❌ Payment cancelled detected from URL');
                PaymentManager.showPaywall();
                // Clean URL
                window.history.replaceState({}, document.title, window.location.pathname);
            }
            
        } catch (error) {
            Utils.logError('EventManager.checkUrlParams', error);
        }
    }
    
    static downloadCleanedAudio() {
        try {
            if (appState.processedAudioUrl && appState.currentFile) {
                console.log('⬇️ Starting download of cleaned audio...');
                
                const a = document.createElement('a');
                a.href = appState.processedAudioUrl;
                a.download = `clean_vocal_isolated_${appState.currentFile.name}`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                
                console.log('✅ Download initiated');
            } else {
                console.error('❌ No processed audio URL available for download');
                ErrorManager.showError('No processed audio available. Please try processing again.');
            }
        } catch (error) {
            Utils.logError('EventManager.downloadCleanedAudio', error);
        }
    }
    
    static processAnother() {
        try {
            console.log('🔄 Processing another track...');
            appState.reset();
            dom.showSection('uploadSection');
            dom.hide('uploadProgress');
            dom.hide('transcriptionPreview');
            
            // Reset all progress indicators
            ErrorManager.resetProgressIndicators();
            
            // Reset file input
            const fileInput = dom.get('fileInput');
            if (fileInput) fileInput.value = '';
            
            console.log('✅ Reset completed, ready for new file');
            
        } catch (error) {
            Utils.logError('EventManager.processAnother', error);
        }
    }
    
    static returnHome() {
        try {
            console.log('🏠 Returning to home...');
            window.location.reload();
        } catch (error) {
            Utils.logError('EventManager.returnHome', error);
        }
    }
}

// Enhanced Server Status Monitor
class ServerMonitor {
    static async checkServerStatus() {
        try {
            const response = await fetch(`${CONFIG.hetzner.baseUrl}/health`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000)
            });
            
            appState.serverOnline = response.ok;
            console.log('🌐 Server status:', appState.serverOnline ? 'Online' : 'Offline');
            
        } catch (error) {
            appState.serverOnline = false;
            console.warn('🌐 Server status check failed:', error.message);
        }
        
        this.updateServerStatusDisplay();
    }

    static updateServerStatusDisplay() {
        const statusElement = dom.get('serverStatus');
        if (statusElement) {
            statusElement.textContent = appState.serverOnline ? 'Online' : 'Offline';
            statusElement.className = `server-status ${appState.serverOnline ? 'online' : 'offline'}`;
        }
    }
    
    static startMonitoring() {
        try {
            console.log('🔄 Starting server monitoring...');
            this.checkServerStatus();
            setInterval(() => this.checkServerStatus(), 30000); // Check every 30 seconds
        } catch (error) {
            Utils.logError('ServerMonitor.startMonitoring', error);
        }
    }
}

// Global DOM manager instance - initialized immediately
const dom = new DOMManager();

// Enhanced Application Initialization
class App {
    static async initialize() {
        try {
            console.log('🚀 Initializing FWEA-I Omnilingual Clean Version Editor with Vocal Isolation...');
            
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                await new Promise(resolve => {
                    document.addEventListener('DOMContentLoaded', resolve);
                });
            }
            
            // Initialize components in proper order
            console.log('🏗️ Initializing components...');
            
            // 1. Initialize particle animation first
            ParticleManager.initialize();
            
            // 2. Wait for DOM manager to be ready with timeout
            let attempts = 0;
            while (!dom.initialized && attempts < 50) {
                await Utils.delay(100);
                attempts++;
            }
            
            if (!dom.initialized) {
                console.warn('⚠️ DOM Manager initialization timeout, continuing anyway');
            }
            
            // 3. Initialize Stripe
            await appState.initializeStripe();
            
            // 4. Setup audio player
            AudioManager.setupAudioPlayer();
            
            // 5. Setup all event listeners
            EventManager.setupAllEventListeners();
            
            // 6. Start server monitoring
            ServerMonitor.startMonitoring();
            
            // 7. Show initial section
            dom.showSection('uploadSection');
            
            // 8. Final setup verification
            this.verifySetup();
            
            console.log('✅ FWEA-I Omnilingual Clean Version Editor initialized successfully');
            console.log('🎤 Vocal isolation technology: ENABLED');
            console.log('🔄 Echo fill technology: ENABLED');
            console.log('🎵 Ready to process audio files with vocal preservation!');
            
        } catch (error) {
            console.error('❌ Failed to initialize application:', error);
            ErrorManager.showError('Failed to initialize application. Please refresh the page.', { showContact: true });
        }
    }

    static verifySetup() {
        const criticalElements = ['dropZone', 'fileInput', 'browseBtn', 'adminUnlock'];
        let issues = [];

        criticalElements.forEach(id => {
            if (!dom.get(id)) {
                issues.push(id);
            }
        });

        if (issues.length > 0) {
            console.warn('⚠️ Setup verification found missing elements:', issues);
        } else {
            console.log('✅ Setup verification passed - all critical elements found');
        }

        // Test critical handlers
        const browseBtn = dom.get('browseBtn');
        const adminUnlock = dom.get('adminUnlock');
        
        if (browseBtn && browseBtn.onclick) {
            console.log('✅ Browse button handler verification: OK');
        } else {
            console.warn('⚠️ Browse button handler verification: MISSING');
        }
        
        if (adminUnlock && adminUnlock.onclick) {
            console.log('✅ Admin button handler verification: OK');
        } else {
            console.warn('⚠️ Admin button handler verification: MISSING');
        }
    }
}

// Enhanced Global error handlers
window.addEventListener('error', (e) => {
    console.error('💥 Global error captured:', e.error);
    Utils.logError('Global Window Error', e.error);
    
    // Don't show error UI if already showing error
    const errorSection = dom.get('errorSection');
    if (errorSection && !errorSection.classList.contains('hidden')) return;
    
    ErrorManager.showError('An unexpected error occurred. Please refresh the page and try again.', { showContact: true });
});

// Unhandled promise rejection handler
window.addEventListener('unhandledrejection', (e) => {
    console.error('💥 Unhandled promise rejection:', e.reason);
    Utils.logError('Unhandled Promise Rejection', e.reason);
    ErrorManager.showError('A network error occurred. Please check your connection and try again.');
});

// Initialize the application when DOM is ready
console.log('📋 Setting up application initialization...');

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('📄 DOM Content Loaded - Starting initialization...');
        App.initialize();
    });
} else {
    console.log('📄 DOM already ready - Starting initialization immediately...');
    App.initialize();
}

// Service Worker registration for offline functionality
if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
    window.addEventListener('load', async () => {
        try {
            console.log('🔧 Service Worker support detected - ready for offline functionality');
            // In a real app, register your service worker here
        } catch (error) {
            console.log('⚠️ Service Worker registration failed:', error);
        }
    });
}

console.log('🎵 FWEA-I Script loaded successfully - waiting for initialization...');
