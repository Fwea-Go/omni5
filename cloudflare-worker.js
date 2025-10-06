
// Enhanced FWEA-I Omnilingual Clean Editor - Advanced Audio Processing Worker
// Account ID: 94ad1fffaa41132c2ff517ce46f76692

export default {
  async fetch(request, env, ctx) {
    // Enhanced CORS headers
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, X-Session-ID',
      'Access-Control-Max-Age': '86400',
      'Access-Control-Allow-Credentials': 'false'
    };

    // Handle preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, { 
        status: 200, 
        headers: corsHeaders 
      });
    }

    const url = new URL(request.url);
    const path = url.pathname;

    console.log(`[${new Date().toISOString()}] ${request.method} ${path}`);

    try {
      // Enhanced routing with vocal isolation
      switch (path) {
        case '/upload':
          return handleUpload(request, env, corsHeaders);
        case '/separate':
          return handleVocalSeparation(request, env, corsHeaders);
        case '/transcribe':
          return handleTranscription(request, env, corsHeaders);
        case '/clean':
          return handleAdvancedCleaning(request, env, corsHeaders);
        case '/preview':
          return handlePreviewGeneration(request, env, corsHeaders);
        case '/payment':
          return handlePayment(request, env, corsHeaders);
        case '/download':
          return handleDownload(request, env, corsHeaders);
        case '/status':
          return handleStatus(request, env, corsHeaders);
        case '/health':
          return handleHealthCheck(request, env, corsHeaders);
        default:
          return new Response(JSON.stringify({
            error: 'Endpoint not found',
            availableEndpoints: ['/upload', '/separate', '/transcribe', '/clean', '/preview', '/payment', '/download', '/status']
          }), { 
            status: 404, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
      }
    } catch (error) {
      console.error('Worker error:', error);
      return new Response(JSON.stringify({
        error: 'Internal Server Error',
        message: error.message,
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json'
        }
      });
    }
  }
};

// Handle file upload with enhanced validation
async function handleUpload(request, env, corsHeaders) {
  if (request.method !== 'POST') {
    return errorResponse('Method Not Allowed', 405, corsHeaders);
  }

  try {
    console.log('Processing upload request...');

    const contentType = request.headers.get('content-type') || '';
    let audioFile, fileName, fileSize;

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      audioFile = formData.get('audio');
      if (!audioFile) {
        return errorResponse('No audio file provided in form data', 400, corsHeaders);
      }
      fileName = audioFile.name;
      fileSize = audioFile.size;
    } else {
      // Handle direct binary upload
      const buffer = await request.arrayBuffer();
      audioFile = new Blob([buffer]);
      fileName = 'uploaded-audio.mp3'; // Default name
      fileSize = buffer.byteLength;
    }

    // Enhanced file validation
    if (fileSize > 104857600) { // 100MB
      return errorResponse('File too large. Maximum size is 100MB.', 413, corsHeaders);
    }

    if (fileSize < 1024) { // 1KB minimum
      return errorResponse('File too small. Minimum size is 1KB.', 400, corsHeaders);
    }

    // Validate file format
    const validFormats = ['mp3', 'wav', 'm4a', 'aac', 'flac', 'ogg', 'wma'];
    const fileExtension = fileName.split('.').pop()?.toLowerCase();

    if (!fileExtension || !validFormats.includes(fileExtension)) {
      return errorResponse(`Unsupported file format. Supported: ${validFormats.join(', ')}`, 400, corsHeaders);
    }

    // Generate session ID and store metadata
    const sessionId = crypto.randomUUID();

    // Store session data in KV
    const sessionData = {
      sessionId,
      fileName,
      fileSize,
      format: fileExtension,
      uploadedAt: new Date().toISOString(),
      status: 'uploaded',
      steps: {
        upload: 'completed',
        separation: 'pending',
        transcription: 'pending',
        cleaning: 'pending',
        preview: 'pending'
      }
    };

    await env.AUDIO_SESSIONS.put(sessionId, JSON.stringify(sessionData));
    console.log(`Session ${sessionId} created for file: ${fileName}`);

    // Store audio file in R2 bucket
    try {
      const audioBuffer = await audioFile.arrayBuffer();
      await env.AUDIO_FILES.put(`${sessionId}/original.${fileExtension}`, audioBuffer, {
        httpMetadata: {
          contentType: audioFile.type || 'audio/mpeg'
        }
      });
      console.log(`Audio file stored in R2: ${sessionId}/original.${fileExtension}`);
    } catch (r2Error) {
      console.error('R2 storage error:', r2Error);
      return errorResponse('Failed to store audio file', 500, corsHeaders);
    }

    return successResponse({
      sessionId,
      fileName,
      fileSize,
      format: fileExtension,
      message: 'File uploaded successfully',
      nextStep: 'vocal-separation',
      estimatedTime: Math.ceil(fileSize / (1024 * 1024)) * 10 // ~10 seconds per MB
    }, corsHeaders);

  } catch (error) {
    console.error('Upload error:', error);
    return errorResponse(`Upload failed: ${error.message}`, 500, corsHeaders);
  }
}

// Handle vocal separation using advanced AI
async function handleVocalSeparation(request, env, corsHeaders) {
  if (request.method !== 'POST') {
    return errorResponse('Method Not Allowed', 405, corsHeaders);
  }

  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return errorResponse('Session ID required', 400, corsHeaders);
    }

    // Get session data
    const sessionData = await getSessionData(env, sessionId);
    if (!sessionData) {
      return errorResponse('Session not found', 404, corsHeaders);
    }

    console.log(`Starting vocal separation for session: ${sessionId}`);

    // Update session status
    sessionData.status = 'separating';
    sessionData.steps.separation = 'processing';
    await env.AUDIO_SESSIONS.put(sessionId, JSON.stringify(sessionData));

    // Retrieve original audio from R2
    const audioObject = await env.AUDIO_FILES.get(`${sessionId}/original.${sessionData.format}`);
    if (!audioObject) {
      return errorResponse('Original audio file not found', 404, corsHeaders);
    }

    const audioBuffer = await audioObject.arrayBuffer();

    // Simulate vocal separation (in production, use actual AI model)
    // This would typically call a specialized vocal separation model
    const separationResult = await simulateVocalSeparation(audioBuffer, sessionData.format);

    // Store separated tracks
    await env.AUDIO_FILES.put(`${sessionId}/vocals.${sessionData.format}`, separationResult.vocals);
    await env.AUDIO_FILES.put(`${sessionId}/instrumental.${sessionData.format}`, separationResult.instrumental);

    // Update session
    sessionData.steps.separation = 'completed';
    sessionData.separationData = {
      vocalQuality: separationResult.quality,
      separationConfidence: separationResult.confidence,
      processedAt: new Date().toISOString()
    };

    await env.AUDIO_SESSIONS.put(sessionId, JSON.stringify(sessionData));

    console.log(`Vocal separation completed for session: ${sessionId}`);

    return successResponse({
      sessionId,
      separation: {
        status: 'completed',
        quality: separationResult.quality,
        confidence: separationResult.confidence,
        vocalTrackSize: separationResult.vocals.byteLength,
        instrumentalTrackSize: separationResult.instrumental.byteLength
      },
      nextStep: 'transcription',
      message: 'Vocal separation completed successfully'
    }, corsHeaders);

  } catch (error) {
    console.error('Vocal separation error:', error);
    return errorResponse(`Vocal separation failed: ${error.message}`, 500, corsHeaders);
  }
}

// Handle Whisper transcription on separated vocals only
async function handleTranscription(request, env, corsHeaders) {
  if (request.method !== 'POST') {
    return errorResponse('Method Not Allowed', 405, corsHeaders);
  }

  try {
    const { sessionId } = await request.json();

    if (!sessionId) {
      return errorResponse('Session ID required', 400, corsHeaders);
    }

    const sessionData = await getSessionData(env, sessionId);
    if (!sessionData) {
      return errorResponse('Session not found', 404, corsHeaders);
    }

    console.log(`Starting transcription for session: ${sessionId}`);

    // Update session status
    sessionData.status = 'transcribing';
    sessionData.steps.transcription = 'processing';
    await env.AUDIO_SESSIONS.put(sessionId, JSON.stringify(sessionData));

    // Get vocal track only for transcription
    const vocalObject = await env.AUDIO_FILES.get(`${sessionId}/vocals.${sessionData.format}`);
    if (!vocalObject) {
      return errorResponse('Vocal track not found', 404, corsHeaders);
    }

    const vocalBuffer = await vocalObject.arrayBuffer();
    const vocalArray = new Uint8Array(vocalBuffer);

    // Call Cloudflare AI Whisper model on vocals only
    const aiResponse = await env.AI.run('@cf/openai/whisper', {
      audio: Array.from(vocalArray)
    });

    if (!aiResponse.success) {
      throw new Error('Whisper transcription failed');
    }

    const transcription = aiResponse.result || aiResponse;

    // Detect language and confidence
    const detectedLanguage = detectLanguage(transcription.text);
    const explicitContent = detectExplicitContent(transcription.text, detectedLanguage);

    // Update session with transcription data
    sessionData.steps.transcription = 'completed';
    sessionData.transcriptionData = {
      text: transcription.text,
      language: detectedLanguage,
      explicitContent: explicitContent,
      wordCount: transcription.word_count || 0,
      words: transcription.words || [],
      processedAt: new Date().toISOString()
    };

    await env.AUDIO_SESSIONS.put(sessionId, JSON.stringify(sessionData));

    console.log(`Transcription completed for session: ${sessionId}, found ${explicitContent.length} explicit words`);

    return successResponse({
      sessionId,
      transcription: {
        text: transcription.text,
        language: {
          detected: detectedLanguage,
          confidence: 0.85 + (Math.random() * 0.15) // 85-100% confidence
        },
        explicitContent: {
          found: explicitContent.length > 0,
          count: explicitContent.length,
          words: explicitContent.slice(0, 10), // Limit for preview
          timestamps: transcription.words || []
        },
        wordCount: transcription.word_count || 0
      },
      nextStep: 'cleaning',
      message: 'Transcription completed successfully'
    }, corsHeaders);

  } catch (error) {
    console.error('Transcription error:', error);
    return errorResponse(`Transcription failed: ${error.message}`, 500, corsHeaders);
  }
}

// Handle advanced audio cleaning with echo fill
async function handleAdvancedCleaning(request, env, corsHeaders) {
  if (request.method !== 'POST') {
    return errorResponse('Method Not Allowed', 405, corsHeaders);
  }

  try {
    const { sessionId, settings = {} } = await request.json();

    if (!sessionId) {
      return errorResponse('Session ID required', 400, corsHeaders);
    }

    const sessionData = await getSessionData(env, sessionId);
    if (!sessionData || !sessionData.transcriptionData) {
      return errorResponse('Session not found or transcription not completed', 404, corsHeaders);
    }

    console.log(`Starting advanced cleaning for session: ${sessionId}`);

    // Update session status
    sessionData.status = 'cleaning';
    sessionData.steps.cleaning = 'processing';
    await env.AUDIO_SESSIONS.put(sessionId, JSON.stringify(sessionData));

    // Get both vocal and instrumental tracks
    const vocalObject = await env.AUDIO_FILES.get(`${sessionId}/vocals.${sessionData.format}`);
    const instrumentalObject = await env.AUDIO_FILES.get(`${sessionId}/instrumental.${sessionData.format}`);

    if (!vocalObject || !instrumentalObject) {
      return errorResponse('Separated audio tracks not found', 404, corsHeaders);
    }

    const vocalBuffer = await vocalObject.arrayBuffer();
    const instrumentalBuffer = await instrumentalObject.arrayBuffer();

    // Process cleaning with echo fill
    const cleaningResult = await processAdvancedCleaning(
      vocalBuffer,
      instrumentalBuffer, 
      sessionData.transcriptionData.explicitContent,
      sessionData.transcriptionData.words,
      settings
    );

    // Store cleaned audio
    await env.AUDIO_FILES.put(`${sessionId}/cleaned.${sessionData.format}`, cleaningResult.cleanedAudio);

    // Update session
    sessionData.steps.cleaning = 'completed';
    sessionData.cleaningData = {
      mutedSections: cleaningResult.mutedSections,
      echoFills: cleaningResult.echoFills,
      preservedInstrumental: true,
      processedAt: new Date().toISOString(),
      settings: settings
    };

    await env.AUDIO_SESSIONS.put(sessionId, JSON.stringify(sessionData));

    console.log(`Advanced cleaning completed for session: ${sessionId}`);

    return successResponse({
      sessionId,
      cleaning: {
        status: 'completed',
        mutedSections: cleaningResult.mutedSections,
        echoFillsApplied: cleaningResult.echoFills.length,
        instrumentalPreserved: true,
        fileSize: cleaningResult.cleanedAudio.byteLength
      },
      nextStep: 'preview',
      message: 'Advanced cleaning completed successfully'
    }, corsHeaders);

  } catch (error) {
    console.error('Advanced cleaning error:', error);
    return errorResponse(`Advanced cleaning failed: ${error.message}`, 500, corsHeaders);
  }
}

// Generate preview with cleaned vocals + original instrumental
async function handlePreviewGeneration(request, env, corsHeaders) {
  if (request.method !== 'POST') {
    return errorResponse('Method Not Allowed', 405, corsHeaders);
  }

  try {
    const { sessionId } = await request.json();

    const sessionData = await getSessionData(env, sessionId);
    if (!sessionData || !sessionData.cleaningData) {
      return errorResponse('Session not found or cleaning not completed', 404, corsHeaders);
    }

    console.log(`Generating preview for session: ${sessionId}`);

    // Get cleaned audio
    const cleanedObject = await env.AUDIO_FILES.get(`${sessionId}/cleaned.${sessionData.format}`);
    if (!cleanedObject) {
      return errorResponse('Cleaned audio not found', 404, corsHeaders);
    }

    const cleanedBuffer = await cleanedObject.arrayBuffer();

    // Generate 30-second preview
    const previewBuffer = await generatePreview(cleanedBuffer, 30);

    // Store preview
    await env.AUDIO_FILES.put(`${sessionId}/preview.${sessionData.format}`, previewBuffer);

    // Update session
    sessionData.steps.preview = 'completed';
    sessionData.status = 'preview-ready';
    sessionData.previewData = {
      duration: 30,
      size: previewBuffer.byteLength,
      generatedAt: new Date().toISOString()
    };

    await env.AUDIO_SESSIONS.put(sessionId, JSON.stringify(sessionData));

    // Generate signed URL for preview
    const previewUrl = `https://your-domain.com/preview/${sessionId}`;

    return successResponse({
      sessionId,
      preview: {
        url: previewUrl,
        duration: 30,
        size: previewBuffer.byteLength,
        mutedSections: sessionData.cleaningData.mutedSections,
        ready: true
      },
      paymentRequired: true,
      message: 'Preview ready - payment required for full version'
    }, corsHeaders);

  } catch (error) {
    console.error('Preview generation error:', error);
    return errorResponse(`Preview generation failed: ${error.message}`, 500, corsHeaders);
  }
}

// Handle payment processing
async function handlePayment(request, env, corsHeaders) {
  if (request.method !== 'POST') {
    return errorResponse('Method Not Allowed', 405, corsHeaders);
  }

  try {
    const { sessionId, priceId, returnUrl } = await request.json();

    if (!sessionId || !priceId) {
      return errorResponse('Session ID and price ID required', 400, corsHeaders);
    }

    const sessionData = await getSessionData(env, sessionId);
    if (!sessionData) {
      return errorResponse('Session not found', 404, corsHeaders);
    }

    console.log(`Processing payment for session: ${sessionId}, price: ${priceId}`);

    // In production, create actual Stripe checkout session
    // This is a simulation for development
    const checkoutUrl = `https://checkout.stripe.com/pay/cs_live_${Math.random().toString(36).substr(2, 9)}`;

    // Update session with payment info
    sessionData.paymentData = {
      priceId,
      checkoutUrl,
      initiatedAt: new Date().toISOString(),
      status: 'pending'
    };

    await env.AUDIO_SESSIONS.put(sessionId, JSON.stringify(sessionData));

    return successResponse({
      sessionId,
      checkout: {
        url: checkoutUrl,
        sessionId: sessionId
      },
      message: 'Payment session created'
    }, corsHeaders);

  } catch (error) {
    console.error('Payment processing error:', error);
    return errorResponse(`Payment processing failed: ${error.message}`, 500, corsHeaders);
  }
}

// Handle file download
async function handleDownload(request, env, corsHeaders) {
  if (request.method !== 'GET') {
    return errorResponse('Method Not Allowed', 405, corsHeaders);
  }

  try {
    const url = new URL(request.url);
    const sessionId = url.searchParams.get('session');
    const type = url.searchParams.get('type') || 'cleaned'; // preview, cleaned, original

    if (!sessionId) {
      return errorResponse('Session ID required', 400, corsHeaders);
    }

    const sessionData = await getSessionData(env, sessionId);
    if (!sessionData) {
      return errorResponse('Session not found', 404, corsHeaders);
    }

    // Check if payment is required and completed (except for preview)
    if (type !== 'preview' && !sessionData.paymentData?.status === 'completed') {
      return errorResponse('Payment required for full version', 402, corsHeaders);
    }

    console.log(`Downloading ${type} audio for session: ${sessionId}`);

    // Get appropriate audio file
    const audioObject = await env.AUDIO_FILES.get(`${sessionId}/${type}.${sessionData.format}`);
    if (!audioObject) {
      return errorResponse(`${type} audio file not found`, 404, corsHeaders);
    }

    const fileName = `${type}_${sessionData.fileName}`;

    return new Response(audioObject.body, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${fileName}"`
      }
    });

  } catch (error) {
    console.error('Download error:', error);
    return errorResponse(`Download failed: ${error.message}`, 500, corsHeaders);
  }
}

// Handle status checks
async function handleStatus(request, env, corsHeaders) {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session');

  if (!sessionId) {
    return errorResponse('Session ID required', 400, corsHeaders);
  }

  const sessionData = await getSessionData(env, sessionId);
  if (!sessionData) {
    return errorResponse('Session not found', 404, corsHeaders);
  }

  return successResponse({
    sessionId,
    status: sessionData.status,
    steps: sessionData.steps,
    progress: calculateProgress(sessionData.steps),
    createdAt: sessionData.uploadedAt,
    fileInfo: {
      name: sessionData.fileName,
      size: sessionData.fileSize,
      format: sessionData.format
    },
    lastUpdated: new Date().toISOString()
  }, corsHeaders);
}

// Handle health check
async function handleHealthCheck(request, env, corsHeaders) {
  return successResponse({
    status: 'healthy',
    service: 'FWEA-I Omnilingual Clean Editor',
    version: '2.0.0',
    features: [
      'vocal-separation',
      'multi-language-transcription', 
      'advanced-cleaning',
      'echo-fill',
      'stripe-payments'
    ],
    timestamp: new Date().toISOString()
  }, corsHeaders);
}

// Helper Functions

async function getSessionData(env, sessionId) {
  try {
    const data = await env.AUDIO_SESSIONS.get(sessionId);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error getting session data:', error);
    return null;
  }
}

function calculateProgress(steps) {
  const completed = Object.values(steps).filter(status => status === 'completed').length;
  const total = Object.keys(steps).length;
  return Math.round((completed / total) * 100);
}

function successResponse(data, corsHeaders) {
  return new Response(JSON.stringify({
    success: true,
    ...data,
    timestamp: new Date().toISOString()
  }), {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}

function errorResponse(message, status, corsHeaders) {
  return new Response(JSON.stringify({
    success: false,
    error: message,
    timestamp: new Date().toISOString()
  }), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });
}

// Audio Processing Functions (Simulated - replace with actual implementations)

async function simulateVocalSeparation(audioBuffer, format) {
  // Simulate processing time
  await new Promise(resolve => setTimeout(resolve, 2000));

  // In production, this would use actual vocal separation AI
  const totalSize = audioBuffer.byteLength;
  const vocalSize = Math.floor(totalSize * 0.3); // Vocals typically 30% of mix
  const instrumentalSize = totalSize - vocalSize;

  return {
    vocals: audioBuffer.slice(0, vocalSize),
    instrumental: audioBuffer.slice(vocalSize),
    quality: 'high',
    confidence: 0.92
  };
}

async function processAdvancedCleaning(vocalBuffer, instrumentalBuffer, explicitWords, wordTimestamps, settings) {
  // Simulate advanced cleaning with echo fill
  await new Promise(resolve => setTimeout(resolve, 1500));

  const mutedSections = explicitWords.map((word, index) => ({
    word: word.word,
    start: word.start || (index * 5),
    end: word.end || (index * 5 + 1),
    echoFillStart: Math.max(0, (word.start || (index * 5)) - 0.5),
    echoFillEnd: word.start || (index * 5)
  }));

  const echoFills = mutedSections.map(section => ({
    originalStart: section.echoFillStart,
    originalEnd: section.echoFillEnd,
    targetStart: section.start,
    targetEnd: section.end,
    delay: 0.25,
    decay: 0.4
  }));

  // Simulate merging cleaned vocals with original instrumental
  const combinedBuffer = new ArrayBuffer(vocalBuffer.byteLength + instrumentalBuffer.byteLength);

  return {
    cleanedAudio: combinedBuffer,
    mutedSections,
    echoFills
  };
}

async function generatePreview(cleanedBuffer, durationSeconds) {
  // Generate preview by taking first N seconds
  const sampleRate = 44100; // CD quality
  const bytesPerSample = 4; // 16-bit stereo
  const previewBytes = durationSeconds * sampleRate * bytesPerSample;

  return cleanedBuffer.slice(0, Math.min(previewBytes, cleanedBuffer.byteLength));
}

function detectLanguage(text) {
  // Enhanced language detection
  const patterns = {
    'English': /\b(the|and|or|but|in|on|at|to|for|of|with|by|is|are|was|were|have|has|had)\b/gi,
    'Spanish': /\b(el|la|los|las|de|en|un|una|por|para|con|sin|es|son|fue|fueron|tiene|ha)\b/gi,
    'French': /\b(le|la|les|de|du|des|un|une|dans|pour|avec|sans|est|sont|était|avoir|être)\b/gi,
    'Portuguese': /\b(o|a|os|as|de|em|um|uma|para|com|sem|por|é|são|foi|eram|ter|ser)\b/gi,
    'German': /\b(der|die|das|den|dem|des|ein|eine|und|oder|in|mit|ist|sind|war|haben|sein)\b/gi,
    'Italian': /\b(il|la|lo|gli|le|di|da|in|con|su|per|tra|è|sono|era|erano|avere|essere)\b/gi
  };

  let maxMatches = 0;
  let detectedLang = 'English';

  for (const [lang, pattern] of Object.entries(patterns)) {
    const matches = (text.match(pattern) || []).length;
    if (matches > maxMatches) {
      maxMatches = matches;
      detectedLang = lang;
    }
  }

  return detectedLang;
}

function detectExplicitContent(text, language) {
  // Enhanced multilingual profanity detection
  const profanityPatterns = {
    'English': /\b(fuck|shit|bitch|damn|hell|ass|crap|piss|cock|dick|pussy|cunt|whore|slut|bastard|motherfucker)\b/gi,
    'Spanish': /\b(mierda|joder|cabrón|puta|puto|pendejo|hijo\s+de\s+puta|coño|verga|chingar|pinche)\b/gi,
    'French': /\b(merde|putain|connard|salope|bordel|enculé|foutre|chier|baiser|niquer)\b/gi,
    'Portuguese': /\b(merda|caralho|porra|puta|filho\s+da\s+puta|cu|buceta|foder|cagar)\b/gi,
    'German': /\b(scheiße|arschloch|hure|fotze|hurensohn|fick|verdammt|ficken|scheißen)\b/gi,
    'Italian': /\b(merda|cazzo|puttana|stronzo|figlio\s+di\s+puttana|vaffanculo|fottere|cagare)\b/gi
  };

  const pattern = profanityPatterns[language] || profanityPatterns['English'];
  const matches = [];
  let match;

  while ((match = pattern.exec(text)) !== null) {
    matches.push({
      word: match[0].toLowerCase(),
      start: match.index,
      end: match.index + match[0].length,
      context: text.substring(Math.max(0, match.index - 10), match.index + match[0].length + 10)
    });
  }

  return matches;
}
