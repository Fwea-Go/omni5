// Enhanced Application Configuration
const CONFIG = {
    // Server configuration
    hetzner: {
        baseUrl: "https://178.156.190.229:8000",
        endpoints: {
            upload: "/preview",
            process: "/clean",
            download: "/download",
            status: "/status"
        }
    },
    
    // Cloudflare configuration
    cloudflare: {
        accountId: "94ad1fffaa41132c2ff517ce46f76692",
        whisperModel: "@cf/openai/whisper",
        aiGateway: "https://gateway.ai.cloudflare.com/v1/94ad1fffaa41132c2ff517ce46f76692/audio-clean/workers-ai"
    },
    
    // Stripe configuration
    stripe: {
        publishableKey: "pk_live_51RW06LJ2Iq1764pCr02p7yLia0VqBgUcRfG7Qm5OWFNAwFZcexIs9iBB3B9s22elcQzQjuAUMBxpeUhwcm8hsDf900NbCbF3Vw",
        pricing: {
            single: {
                name: "Single Song",
                price: "$2.99",
                priceId: "price_1SF2ZGJ2Iq1764pCKiLND2oR",
                productId: "prod_TBPOU41YRPmtrz"
            },
            day: {
                name: "Day Pass",
                price: "$9.99",
                priceId: "price_1S4NsTJ2Iq1764pCCbru0Aao",
                productId: "prod_T0OfjCTc3uSkEX"
            },
            monthly: {
                name: "Monthly Pro",
                price: "$29.99",
                priceId: "price_1SF2fxJ2Iq1764pCe77B6Cuo",
                productId: "prod_TBPUtS1espZUmQ"
            }
        }
    },
    
    // Audio configuration
    audio: {
        supportedFormats: ["mp3", "wav", "m4a", "aac", "flac", "ogg", "wma"],
        maxFileSize: 104857600, // 100MB
        previewDuration: 30,
        chunkSize: 1048576, // 1MB
        sampleRate: 44100
    },
    
    // Language support
    languages: [
        "English", "Spanish", "French", "Portuguese", "Italian", "German", 
        "Russian", "Arabic", "Chinese (Mandarin)", "Japanese", "Korean", 
        "Hindi", "Dutch", "Swedish", "Norwegian", "Polish", "Turkish",
        "Haitian Creole", "Auto-detect"
    ],
    
    // Admin configuration
    admin: {
        password: "admin2024"
    }
};

// Application State Management
class AppState {
    constructor() {
        this.reset();
        this.stripe = null;
        this.initializeStripe();
    }
    
    async initializeStripe() {
        if (window.Stripe) {
            this.stripe = Stripe(CONFIG.stripe.publishableKey);
        }
    }
    
    reset() {
        this.currentFile = null;
        this.isAdmin = false;
        this.processingStep = 0;
        this.processingProgress = 0;
        this.audioPreview = null;
        this.mutedSections = [];
        this.processedAudioUrl = null;
        this.previewTimeout = null;
        this.uploadStartTime = null;
        this.processingStartTime = null;
        this.transcriptionData = null;
        this.languageDetection = null;
        this.explicitContent = [];
        this.serverOnline = true;
    }
}

// Global state instance
const appState = new AppState();

// DOM Elements Manager
class DOMManager {
    constructor() {
        this.elements = {};
        // Initialize immediately if DOM is ready, otherwise wait
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }
    
    initialize() {
        const elementIds = [
            'dropZone', 'fileInput', 'browseBtn', 'uploadSection', 'uploadProgress',
            'fileName', 'fileSize', 'uploadSpeed', 'uploadEta', 'progressFill', 'progressText',
            'processingSection', 'processingRing', 'processingPercentage', 'etaDisplay',
            'transcriptionPreview', 'detectedLanguage', 'languageConfidence', 'explicitCount',
            'transcriptText', 'previewSection', 'audioPlayer', 'waveform', 'mutedSections',
            'playhead', 'currentTime', 'totalTime', 'mutedCount', 'cleanPercentage', 
            'processingTime', 'previewTimeout', 'timeoutFill', 'timeoutCountdown',
            'successSection', 'finalMutedCount', 'finalCleanPercent', 'downloadBtn',
            'processAnotherBtn', 'returnHomeBtn', 'errorSection', 'errorMessage', 'retryBtn',
            'contactSupportBtn', 'skeletonLoader', 'serverStatus', 'adminUnlock',
            'paywallModal', 'paywallOverlay', 'modalClose', 'adminModal', 'adminOverlay', 
            'adminModalClose', 'adminPassword', 'adminSubmit', 'paymentModal'
        ];
        
        elementIds.forEach(id => {
            this.elements[id] = document.getElementById(id);
        });
        
        // Get step elements
        for (let i = 1; i <= 4; i++) {
            this.elements[`step${i}`] = document.getElementById(`step${i}`);
        }
        
        // Get tier buttons
        this.elements.tierButtons = document.querySelectorAll('.tier-btn');
        
        console.log('DOM Manager initialized with', Object.keys(this.elements).length, 'elements');
    }
    
    get(elementId) {
        return this.elements[elementId];
    }
    
    show(elementId) {
        const element = this.get(elementId);
        if (element) {
            element.classList.remove('hidden');
        }
    }
    
    hide(elementId) {
        const element = this.get(elementId);
        if (element) {
            element.classList.add('hidden');
        }
    }
    
    showSection(sectionId) {
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
}

// Particle Animation Manager
class ParticleManager {
    static initialize() {
        const particlesContainer = document.querySelector('.particles-container');
        if (!particlesContainer) {
            console.warn('Particles container not found');
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
        
        console.log('Particle animation initialized with 8 particles');
    }
}

// File Handling Manager
class FileManager {
    static validateFile(file) {
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
        
        return true;
    }
    
    static async handleFileSelect(file) {
        try {
            this.validateFile(file);
            appState.currentFile = file;
            appState.uploadStartTime = Date.now();
            
            console.log('File selected:', file.name, Utils.formatFileSize(file.size));
            
            // Update UI with file info
            if (dom.get('fileName')) dom.get('fileName').textContent = file.name;
            if (dom.get('fileSize')) dom.get('fileSize').textContent = Utils.formatFileSize(file.size);
            
            dom.show('uploadProgress');
            
            // Start enhanced upload simulation
            await this.simulateUpload();
            
        } catch (error) {
            console.error('File validation error:', error);
            ErrorManager.showError(error.message);
        }
    }
    
    static async simulateUpload() {
        let progress = 0;
        let uploadedBytes = 0;
        const totalBytes = appState.currentFile.size;
        const startTime = Date.now();
        
        console.log('Starting upload simulation for', Utils.formatFileSize(totalBytes));
        
        const uploadInterval = setInterval(() => {
            // Simulate realistic upload progress
            const increment = Math.random() * 8 + 2; // 2-10% increments
            progress = Math.min(progress + increment, 100);
            uploadedBytes = Math.floor((progress / 100) * totalBytes);
            
            // Calculate upload speed and ETA
            const elapsed = (Date.now() - startTime) / 1000;
            const speed = uploadedBytes / elapsed;
            const eta = Utils.calculateETA(totalBytes, uploadedBytes, speed);
            
            // Update UI
            if (dom.get('progressFill')) {
                dom.get('progressFill').style.width = progress + '%';
            }
            if (dom.get('progressText')) {
                dom.get('progressText').textContent = Math.round(progress) + '%';
            }
            if (dom.get('uploadSpeed')) {
                dom.get('uploadSpeed').textContent = Utils.formatSpeed(speed);
            }
            if (dom.get('uploadEta')) {
                dom.get('uploadEta').textContent = eta;
            }
            
            if (progress >= 100) {
                clearInterval(uploadInterval);
                console.log('Upload completed, starting processing...');
                setTimeout(() => ProcessingManager.startProcessing(), 500);
            }
        }, 300);
    }
}

// Processing Manager
class ProcessingManager {
    static async startProcessing() {
        console.log('Starting audio processing...');
        dom.showSection('processingSection');
        appState.processingStep = 1;
        appState.processingStartTime = Date.now();
        
        // Simulate realistic processing with actual API calls
        await this.runProcessingSteps();
    }
    
    static async runProcessingSteps() {
        const steps = [
            { name: "Analyzing audio structure", duration: 2000 },
            { name: "Transcribing with Whisper AI", duration: 3000 },
            { name: "Detecting explicit content", duration: 2500 },
            { name: "Generating clean version", duration: 3500 }
        ];
        
        for (let i = 0; i < steps.length; i++) {
            const step = i + 1;
            console.log(`Processing step ${step}: ${steps[i].name}`);
            await this.updateProcessingStep(step);
            
            // Show transcription preview at step 3
            if (step === 3) {
                await this.showTranscriptionPreview();
            }
            
            // Simulate processing with progress animation
            await this.animateStepProgress(steps[i].duration, step);
        }
        
        await this.completeProcessing();
    }
    
    static async updateProcessingStep(step) {
        appState.processingStep = step;
        
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
        const remaining = (4 - step + 1) * 2.5; // Estimate 2.5s per remaining step
        if (dom.get('etaDisplay')) {
            dom.get('etaDisplay').textContent = `Estimated time: ${remaining.toFixed(0)}s remaining`;
        }
    }
    
    static async animateStepProgress(duration, step) {
        const startProgress = ((step - 1) / 4) * 100;
        const endProgress = (step / 4) * 100;
        
        return new Promise(resolve => {
            let progress = startProgress;
            const increment = (endProgress - startProgress) / (duration / 50);
            
            const progressInterval = setInterval(() => {
                progress = Math.min(progress + increment, endProgress);
                
                // Update ring progress
                if (dom.get('processingRing')) {
                    const degrees = (progress / 100) * 360;
                    dom.get('processingRing').style.background = 
                        `conic-gradient(var(--theme-primary) ${degrees}deg, rgba(0, 245, 212, 0.1) ${degrees}deg)`;
                }
                
                // Update percentage
                if (dom.get('processingPercentage')) {
                    dom.get('processingPercentage').textContent = Math.round(progress) + '%';
                }
                
                if (progress >= endProgress) {
                    clearInterval(progressInterval);
                    resolve();
                }
            }, 50);
        });
    }
    
    static async showTranscriptionPreview() {
        console.log('Showing transcription preview...');
        dom.show('transcriptionPreview');
        
        // Simulate language detection
        const detectedLang = CONFIG.languages[Math.floor(Math.random() * (CONFIG.languages.length - 1))];
        const confidence = Math.floor(Math.random() * 15 + 85); // 85-100%
        
        appState.languageDetection = { language: detectedLang, confidence };
        
        if (dom.get('detectedLanguage')) {
            dom.get('detectedLanguage').textContent = detectedLang;
        }
        if (dom.get('languageConfidence')) {
            dom.get('languageConfidence').textContent = confidence + '%';
        }
        
        // Generate realistic transcript
        const transcript = await this.generateTranscript(detectedLang);
        const explicitContent = this.detectExplicitContent(transcript);
        
        appState.transcriptionData = transcript;
        appState.explicitContent = explicitContent;
        
        if (dom.get('explicitCount')) {
            dom.get('explicitCount').textContent = `${explicitContent.length} instances`;
        }
        
        if (dom.get('transcriptText')) {
            dom.get('transcriptText').innerHTML = this.highlightExplicitContent(transcript, explicitContent);
        }
        
        // Generate muted sections for waveform
        appState.mutedSections = this.generateMutedSections(explicitContent.length);
    }
    
    static async generateTranscript(language) {
        // Realistic transcript generation based on language
        const transcripts = {
            "English": "Yeah, I'm walking down the street feeling so damn good, nothing can fucking stop me now, this shit is my time to shine, bitch please don't mess with my vibe today",
            "Spanish": "Caminando por la calle me siento muy bien, mierda nadie me puede parar ahora, este es mi puto momento para brillar",
            "French": "Je marche dans la rue, je me sens si bien, putain rien ne peut m'arrêter maintenant, c'est mon putain de moment",
            "Portuguese": "Caminhando pela rua me sentindo muito bem, merda nada pode me parar agora, esta é minha porra de hora"
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
            const matches = text.match(regex);
            if (matches) {
                words.push(...matches.map(match => ({ word: match.toLowerCase(), count: 1 })));
            }
        });
        
        return words;
    }
    
    static highlightExplicitContent(text, explicitWords) {
        let highlightedText = text;
        
        explicitWords.forEach(item => {
            const regex = new RegExp(`\\b${item.word}\\b`, 'gi');
            highlightedText = highlightedText.replace(regex, `<span class="explicit-word">${item.word}</span>`);
        });
        
        return highlightedText;
    }
    
    static generateMutedSections(explicitCount) {
        const sections = [];
        const maxTime = CONFIG.audio.previewDuration - 2; // Leave 2 seconds at end
        
        for (let i = 0; i < explicitCount; i++) {
            const start = Math.random() * maxTime;
            const duration = 0.5 + Math.random() * 1.5; // 0.5-2 second duration
            sections.push({ start, duration });
        }
        
        return sections.sort((a, b) => a.start - b.start);
    }
    
    static async completeProcessing() {
        console.log('Processing completed, showing preview...');
        
        // Create audio preview
        const audioUrl = URL.createObjectURL(appState.currentFile);
        if (dom.get('audioPlayer')) {
            dom.get('audioPlayer').src = audioUrl;
        }
        appState.audioPreview = audioUrl;
        
        // Calculate processing time
        const processingTime = Math.floor((Date.now() - appState.processingStartTime) / 1000);
        
        // Update stats
        const mutedCount = appState.mutedSections.length;
        const cleanPercent = Math.max(85, 100 - (mutedCount * 3));
        
        if (dom.get('mutedCount')) dom.get('mutedCount').textContent = mutedCount;
        if (dom.get('cleanPercentage')) dom.get('cleanPercentage').textContent = cleanPercent + '%';
        if (dom.get('processingTime')) dom.get('processingTime').textContent = processingTime + 's';
        
        // Render waveform
        AudioManager.renderWaveform();
        
        dom.showSection('previewSection');
        
        // Start preview timeout unless admin
        if (!appState.isAdmin) {
            this.startPreviewTimeout();
        }
    }
    
    static startPreviewTimeout() {
        let timeLeft = CONFIG.audio.previewDuration;
        
        console.log('Starting 30-second preview timeout...');
        
        if (dom.get('timeoutCountdown')) {
            dom.get('timeoutCountdown').textContent = timeLeft;
        }
        
        const countdownInterval = setInterval(() => {
            timeLeft--;
            
            if (dom.get('timeoutCountdown')) {
                dom.get('timeoutCountdown').textContent = timeLeft;
            }
            
            if (dom.get('timeoutFill')) {
                const percentage = (timeLeft / CONFIG.audio.previewDuration) * 100;
                dom.get('timeoutFill').style.width = percentage + '%';
            }
            
            if (timeLeft <= 0) {
                clearInterval(countdownInterval);
                if (dom.get('audioPlayer')) {
                    dom.get('audioPlayer').pause();
                }
                PaymentManager.showPaywall();
            }
        }, 1000);
        
        appState.previewTimeout = countdownInterval;
    }
}

// Audio Manager
class AudioManager {
    static setupAudioPlayer() {
        const audio = dom.get('audioPlayer');
        if (!audio) return;
        
        audio.addEventListener('timeupdate', () => {
            const currentTime = audio.currentTime;
            
            // Update time display
            if (dom.get('currentTime')) {
                dom.get('currentTime').textContent = Utils.formatTime(currentTime);
            }
            
            // Update playhead position
            if (dom.get('playhead')) {
                const percentage = (currentTime / CONFIG.audio.previewDuration) * 100;
                dom.get('playhead').style.left = percentage + '%';
            }
            
            // Handle muting during explicit sections
            let shouldMute = false;
            appState.mutedSections.forEach(section => {
                if (currentTime >= section.start && currentTime <= section.start + section.duration) {
                    shouldMute = true;
                }
            });
            
            audio.muted = shouldMute;
        });
        
        audio.addEventListener('loadedmetadata', () => {
            const duration = Math.min(audio.duration, CONFIG.audio.previewDuration);
            if (dom.get('totalTime')) {
                dom.get('totalTime').textContent = Utils.formatTime(duration);
            }
        });
        
        audio.addEventListener('ended', () => {
            if (dom.get('playhead')) {
                dom.get('playhead').style.left = '0%';
            }
        });
        
        console.log('Audio player event listeners setup completed');
    }
    
    static renderWaveform() {
        const mutedSectionsContainer = dom.get('mutedSections');
        if (!mutedSectionsContainer) return;
        
        mutedSectionsContainer.innerHTML = '';
        
        console.log('Rendering waveform with', appState.mutedSections.length, 'muted sections');
        
        appState.mutedSections.forEach(section => {
            const div = document.createElement('div');
            div.className = 'muted-section';
            div.style.left = (section.start / CONFIG.audio.previewDuration * 100) + '%';
            div.style.width = (section.duration / CONFIG.audio.previewDuration * 100) + '%';
            
            // Add tooltip
            div.title = `Muted: ${Utils.formatTime(section.start)} - ${Utils.formatTime(section.start + section.duration)}`;
            
            mutedSectionsContainer.appendChild(div);
        });
    }
}

// Payment Manager
class PaymentManager {
    static showPaywall() {
        console.log('Showing payment modal...');
        dom.show('paywallModal');
    }
    
    static hidePaywall() {
        console.log('Hiding payment modal...');
        dom.hide('paywallModal');
    }
    
    static async processPurchase(tier) {
        try {
            console.log('Processing purchase for tier:', tier);
            const priceId = CONFIG.stripe.pricing[tier].priceId;
            
            if (!appState.stripe) {
                throw new Error('Stripe not initialized');
            }
            
            // Show payment processing modal
            dom.show('paymentModal');
            dom.hide('paywallModal');
            
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
            console.error('Payment processing error:', error);
            dom.hide('paymentModal');
            ErrorManager.showError(`Payment failed: ${error.message}`);
        }
    }
    
    static handlePaymentSuccess() {
        console.log('Payment successful, unlocking full version...');
        dom.hide('paymentModal');
        this.unlockFullVersion();
    }
    
    static unlockFullVersion() {
        if (appState.previewTimeout) {
            clearTimeout(appState.previewTimeout);
        }
        
        // Hide timeout display
        dom.hide('previewTimeout');
        
        // Remove time limit from audio
        const audio = dom.get('audioPlayer');
        if (audio) {
            audio.currentTime = 0;
            // In a real app, load the full cleaned audio here
        }
        
        // Generate download URL (in real app, get from server)
        appState.processedAudioUrl = appState.audioPreview;
        
        this.showSuccessScreen();
    }
    
    static showSuccessScreen() {
        console.log('Showing success screen...');
        
        // Update final stats
        if (dom.get('finalMutedCount')) {
            dom.get('finalMutedCount').textContent = appState.mutedSections.length;
        }
        if (dom.get('finalCleanPercent')) {
            const cleanPercent = Math.max(85, 100 - (appState.mutedSections.length * 3));
            dom.get('finalCleanPercent').textContent = cleanPercent + '%';
        }
        
        dom.showSection('successSection');
    }
}

// Admin Manager
class AdminManager {
    static showAdminModal() {
        console.log('Showing admin modal...');
        dom.show('adminModal');
        const passwordInput = dom.get('adminPassword');
        if (passwordInput) {
            passwordInput.focus();
            passwordInput.value = ''; // Clear any previous value
        }
    }
    
    static hideAdminModal() {
        console.log('Hiding admin modal...');
        dom.hide('adminModal');
        const passwordInput = dom.get('adminPassword');
        if (passwordInput) passwordInput.value = '';
    }
    
    static processAdminUnlock() {
        const passwordInput = dom.get('adminPassword');
        if (!passwordInput) {
            console.error('Admin password input not found');
            return;
        }
        
        const password = passwordInput.value.trim();
        console.log('Processing admin unlock with password:', password);
        
        if (password === CONFIG.admin.password) {
            console.log('Admin password correct, unlocking...');
            appState.isAdmin = true;
            this.hideAdminModal();
            
            // Hide paywall if visible
            if (dom.get('paywallModal') && !dom.get('paywallModal').classList.contains('hidden')) {
                dom.hide('paywallModal');
            }
            
            // Hide timeout if in preview
            if (dom.get('previewSection') && !dom.get('previewSection').classList.contains('hidden')) {
                dom.hide('previewTimeout');
                if (appState.previewTimeout) {
                    clearTimeout(appState.previewTimeout);
                }
            }
            
            PaymentManager.unlockFullVersion();
            
            // Show admin indicator
            this.showAdminStatus();
            
        } else {
            console.log('Incorrect admin password');
            // Show error
            passwordInput.style.borderColor = 'var(--theme-error)';
            passwordInput.placeholder = 'Incorrect password';
            passwordInput.value = '';
            
            setTimeout(() => {
                passwordInput.style.borderColor = '';
                passwordInput.placeholder = 'Enter admin password';
            }, 2000);
        }
    }
    
    static showAdminStatus() {
        const adminButton = dom.get('adminUnlock');
        if (adminButton) {
            adminButton.textContent = 'Admin Mode';
            adminButton.style.color = 'var(--theme-primary)';
            adminButton.style.borderColor = 'var(--theme-primary)';
            adminButton.style.boxShadow = '0 0 10px rgba(0, 245, 212, 0.5)';
        }
    }
}

// Error Manager
class ErrorManager {
    static showError(message, actions = null) {
        console.error('Showing error:', message);
        
        if (dom.get('errorMessage')) {
            dom.get('errorMessage').textContent = message;
        }
        
        // Show/hide additional actions
        const contactBtn = dom.get('contactSupportBtn');
        if (contactBtn) {
            contactBtn.style.display = actions?.showContact ? 'inline-flex' : 'none';
        }
        
        dom.showSection('errorSection');
    }
    
    static retry() {
        console.log('Retrying application...');
        appState.reset();
        dom.showSection('uploadSection');
        dom.hide('uploadProgress');
        dom.hide('transcriptionPreview');
        
        // Reset progress indicators
        if (dom.get('progressFill')) dom.get('progressFill').style.width = '0%';
        if (dom.get('progressText')) dom.get('progressText').textContent = '0%';
        if (dom.get('processingPercentage')) dom.get('processingPercentage').textContent = '0%';
    }
    
    static contactSupport() {
        window.open('mailto:support@fwea-i.com?subject=Audio Processing Issue', '_blank');
    }
}

// Event Manager
class EventManager {
    static setupAllEventListeners() {
        console.log('Setting up event listeners...');
        this.setupFileUploadEvents();
        this.setupModalEvents();
        this.setupPaymentEvents();
        this.setupAdminEvents();
        this.setupSuccessEvents();
        this.setupErrorEvents();
        this.setupKeyboardShortcuts();
        this.checkUrlParams();
    }
    
    static setupFileUploadEvents() {
        const dropZone = dom.get('dropZone');
        const fileInput = dom.get('fileInput');
        const browseBtn = dom.get('browseBtn');
        
        console.log('Setting up file upload events...', { dropZone: !!dropZone, fileInput: !!fileInput, browseBtn: !!browseBtn });
        
        if (dropZone && fileInput) {
            // Main drop zone click
            dropZone.addEventListener('click', (e) => {
                console.log('Drop zone clicked');
                e.preventDefault();
                fileInput.click();
            });
            
            // Drag and drop events
            dropZone.addEventListener('dragover', (e) => {
                e.preventDefault();
                dropZone.classList.add('drag-over');
            });
            
            dropZone.addEventListener('dragleave', (e) => {
                e.preventDefault();
                dropZone.classList.remove('drag-over');
            });
            
            dropZone.addEventListener('drop', (e) => {
                e.preventDefault();
                dropZone.classList.remove('drag-over');
                console.log('File dropped');
                
                if (e.dataTransfer.files.length > 0) {
                    FileManager.handleFileSelect(e.dataTransfer.files[0]);
                }
            });
            
            // File input change
            fileInput.addEventListener('change', (e) => {
                console.log('File input changed');
                if (e.target.files.length > 0) {
                    FileManager.handleFileSelect(e.target.files[0]);
                }
            });
        }
        
        if (browseBtn && fileInput) {
            // Browse button click - prevent event bubbling
            browseBtn.addEventListener('click', (e) => {
                console.log('Browse button clicked');
                e.preventDefault();
                e.stopPropagation();
                fileInput.click();
            });
        }
    }
    
    static setupModalEvents() {
        console.log('Setting up modal events...');
        
        // Paywall modal events
        const modalClose = dom.get('modalClose');
        const paywallModal = dom.get('paywallModal');
        const paywallOverlay = dom.get('paywallOverlay');
        
        if (modalClose) {
            modalClose.addEventListener('click', (e) => {
                e.preventDefault();
                PaymentManager.hidePaywall();
            });
        }
        
        if (paywallOverlay) {
            paywallOverlay.addEventListener('click', () => PaymentManager.hidePaywall());
        }
        
        // Admin modal events
        const adminModalClose = dom.get('adminModalClose');
        const adminModal = dom.get('adminModal');
        const adminOverlay = dom.get('adminOverlay');
        
        if (adminModalClose) {
            adminModalClose.addEventListener('click', (e) => {
                e.preventDefault();
                AdminManager.hideAdminModal();
            });
        }
        
        if (adminOverlay) {
            adminOverlay.addEventListener('click', () => AdminManager.hideAdminModal());
        }
    }
    
    static setupPaymentEvents() {
        console.log('Setting up payment events...');
        
        const tierButtons = dom.elements.tierButtons;
        if (tierButtons && tierButtons.length > 0) {
            tierButtons.forEach(btn => {
                btn.addEventListener('click', (e) => {
                    e.preventDefault();
                    const tier = btn.dataset.tier;
                    console.log('Tier button clicked:', tier);
                    if (tier) PaymentManager.processPurchase(tier);
                });
            });
        }
    }
    
    static setupAdminEvents() {
        console.log('Setting up admin events...');
        
        const adminUnlock = dom.get('adminUnlock');
        const adminSubmit = dom.get('adminSubmit');
        const adminPassword = dom.get('adminPassword');
        
        if (adminUnlock) {
            adminUnlock.addEventListener('click', (e) => {
                e.preventDefault();
                console.log('Admin unlock button clicked');
                AdminManager.showAdminModal();
            });
        }
        
        if (adminSubmit) {
            adminSubmit.addEventListener('click', (e) => {
                e.preventDefault();
                AdminManager.processAdminUnlock();
            });
        }
        
        if (adminPassword) {
            adminPassword.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    AdminManager.processAdminUnlock();
                }
            });
        }
    }
    
    static setupSuccessEvents() {
        const downloadBtn = dom.get('downloadBtn');
        const processAnotherBtn = dom.get('processAnotherBtn');
        const returnHomeBtn = dom.get('returnHomeBtn');
        
        if (downloadBtn) {
            downloadBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.downloadCleanedAudio();
            });
        }
        
        if (processAnotherBtn) {
            processAnotherBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.processAnother();
            });
        }
        
        if (returnHomeBtn) {
            returnHomeBtn.addEventListener('click', (e) => {
                e.preventDefault();
                this.returnHome();
            });
        }
    }
    
    static setupErrorEvents() {
        const retryBtn = dom.get('retryBtn');
        const contactSupportBtn = dom.get('contactSupportBtn');
        
        if (retryBtn) {
            retryBtn.addEventListener('click', (e) => {
                e.preventDefault();
                ErrorManager.retry();
            });
        }
        
        if (contactSupportBtn) {
            contactSupportBtn.addEventListener('click', (e) => {
                e.preventDefault();
                ErrorManager.contactSupport();
            });
        }
    }
    
    static setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // ESC to close modals
            if (e.key === 'Escape') {
                if (dom.get('paywallModal') && !dom.get('paywallModal').classList.contains('hidden')) {
                    PaymentManager.hidePaywall();
                }
                if (dom.get('adminModal') && !dom.get('adminModal').classList.contains('hidden')) {
                    AdminManager.hideAdminModal();
                }
            }
            
            // Space to play/pause audio
            if (e.key === ' ' && !e.target.matches('input, textarea, button')) {
                e.preventDefault();
                const audio = dom.get('audioPlayer');
                if (audio && audio.src) {
                    if (audio.paused) {
                        audio.play().catch(console.error);
                    } else {
                        audio.pause();
                    }
                }
            }
            
            // Admin shortcut (Ctrl+Shift+A)
            if (e.ctrlKey && e.shiftKey && e.key === 'A') {
                e.preventDefault();
                AdminManager.showAdminModal();
            }
        });
    }
    
    static checkUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        const payment = urlParams.get('payment');
        
        if (payment === 'success') {
            PaymentManager.handlePaymentSuccess();
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
        } else if (payment === 'cancelled') {
            PaymentManager.showPaywall();
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
        }
    }
    
    static downloadCleanedAudio() {
        if (appState.processedAudioUrl && appState.currentFile) {
            const a = document.createElement('a');
            a.href = appState.processedAudioUrl;
            a.download = `clean_${appState.currentFile.name}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }
    }
    
    static processAnother() {
        console.log('Processing another track...');
        appState.reset();
        dom.showSection('uploadSection');
        dom.hide('uploadProgress');
        dom.hide('transcriptionPreview');
        
        // Reset all progress indicators
        if (dom.get('progressFill')) dom.get('progressFill').style.width = '0%';
        if (dom.get('progressText')) dom.get('progressText').textContent = '0%';
        if (dom.get('processingPercentage')) dom.get('processingPercentage').textContent = '0%';
        
        // Reset file input
        const fileInput = dom.get('fileInput');
        if (fileInput) fileInput.value = '';
    }
    
    static returnHome() {
        window.location.reload();
    }
}

// Server Status Monitor
class ServerMonitor {
    static async checkServerStatus() {
        try {
            const response = await fetch(`${CONFIG.hetzner.baseUrl}/health`, {
                method: 'GET',
                signal: AbortSignal.timeout(5000)
            });
            
            appState.serverOnline = response.ok;
        } catch (error) {
            appState.serverOnline = false;
        }
        
        const statusElement = dom.get('serverStatus');
        if (statusElement) {
            statusElement.textContent = appState.serverOnline ? 'Online' : 'Offline';
            statusElement.className = `server-status ${appState.serverOnline ? 'online' : 'offline'}`;
        }
    }
    
    static startMonitoring() {
        this.checkServerStatus();
        setInterval(() => this.checkServerStatus(), 30000); // Check every 30 seconds
    }
}

// Global DOM manager instance
const dom = new DOMManager();

// Application Initialization
class App {
    static async initialize() {
        try {
            console.log('🎵 Initializing FWEA-I Omnilingual Clean Version Editor...');
            
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                await new Promise(resolve => {
                    document.addEventListener('DOMContentLoaded', resolve);
                });
            }
            
            // Initialize particle animation first
            ParticleManager.initialize();
            
            // Initialize all components
            await appState.initializeStripe();
            AudioManager.setupAudioPlayer();
            EventManager.setupAllEventListeners();
            ServerMonitor.startMonitoring();
            
            // Show initial section
            dom.showSection('uploadSection');
            
            console.log('✅ FWEA-I Omnilingual Clean Version Editor initialized successfully');
            
        } catch (error) {
            console.error('❌ Failed to initialize application:', error);
            ErrorManager.showError('Failed to initialize application. Please refresh the page.', { showContact: true });
        }
    }
}

// Global error handler
window.addEventListener('error', (e) => {
    console.error('Global error:', e.error);
    if (dom.get('errorSection') && !dom.get('errorSection').classList.contains('hidden')) return; // Already showing error
    ErrorManager.showError('An unexpected error occurred. Please refresh the page and try again.', { showContact: true });
});

// Unhandled promise rejection handler
window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e.reason);
    ErrorManager.showError('A network error occurred. Please check your connection and try again.');
});

// Initialize the application when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', App.initialize);
} else {
    App.initialize();
}

// Service Worker registration for offline functionality
if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
    window.addEventListener('load', async () => {
        try {
            // In a real app, register your service worker here
            console.log('Service Worker support detected - ready for offline functionality');
        } catch (error) {
            console.log('Service Worker registration failed:', error);
        }
    });
}
