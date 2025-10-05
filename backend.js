// backend.js — FWEA-I Clean Editor API (Node/Express)
// Requires: Node 18+ (global fetch/FormData/Blob), ffmpeg, npm i express multer cors

const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const { exec } = require('child_process');
// tiny promise-wrapped exec
const sh = (cmd) => new Promise((resolve, reject)=>{
  exec(cmd, (e, so, se)=> e ? reject(se || e) : resolve(so));
});

// read track duration with ffprobe (seconds as Number)
async function ffprobeDuration(src){
  try{
    const cmd = `ffprobe -v error -show_entries format=duration -of default=nw=1:nk=1 ${src.includes(' ') ? '"'+src+'"' : src}`;
    const out = await sh(cmd);
    const n = parseFloat(String(out).trim());
    return Number.isFinite(n) ? n : 0;
  }catch{
    return 0;
  }
}

const app = express();
const port = process.env.PORT || 8000;

// Upload & static dirs
const upload = multer({ dest: 'uploads/' });
fs.mkdirSync('public', { recursive: true });
fs.mkdirSync('uploads', { recursive: true });

app.use(cors({ origin: '*'}));
app.use('/public', express.static(path.join(process.cwd(), 'public')));

// Basic multilingual profanity set (seed; expand later)
const badWords = [
  /\b(fuck|shit|bitch|asshole|cunt|motherfucker|dick|pussy|nigga|nigger|hoe|slut)\b/i,
  /\b(puta|puto|pendejo|mierda|cabron|coño)\b/i,
  /\b(putain|merde|salope|con)\b/i,
  /\b(bitch|koko|vagin|kaka|manmanw|manman’w)\b/i,
  /\b(merda|caralho|porra|puta)\b/i,
];
const hasBad = (txt='') => badWords.some(rx => rx.test(txt));

app.get('/', (_req,res)=> res.json({ ok:true, msg:'FWEA-I Clean Editor API (Node)' }));

// POST /preview  -> returns { preview_url, language, transcript, muted_spans }
app.post('/preview', upload.single('file'), async (req, res) => {
  let tmpFiles = [];
  try{
    if(!req.file) return res.status(400).json({ error:'missing_file' });
    const src = req.file.path;

    const account = process.env.CF_ACCOUNT_ID || '';
    const token   = process.env.CF_API_TOKEN  || '';
    if(!account || !token) return res.status(500).json({ error:'cloudflare_credentials_missing' });

    // --- Work out duration & chunk plan ---
    const dur = await ffprobeDuration(src); // seconds
    const CHUNK_SEC = 5;      // smaller slices; keep CF body tiny

    // build a tiny audio slice for [start, start+len] with configurable codec/profile
    async function makeSlice(start, len, opts = { codec: 'libmp3lame', hz: 32000, br: '64k' }){
      const ext = opts.codec === 'libopus' ? 'ogg' : 'mp3';
      const out = path.join('uploads', `${Date.now().toString(36)}_${Math.round(start*1000)}.${ext}`);
      const args = [
        '-hide_banner','-loglevel','error','-y',
        '-i',  src,
        // accurate output trim (put -ss/-t after -i)
        '-ss', String(Math.max(0, start)),
        '-t',  String(Math.max(0.1, len)),
        '-ac','1',
        '-ar', String(opts.hz || 32000),
        '-c:a', opts.codec,
      ];
      if (opts.codec === 'libopus') {
        // Opus VBR at ~24k target
        args.push('-b:a', opts.br || '24k', '-vbr', 'on', '-compression_level', '10');
      } else {
        // MP3 CBR target
        args.push('-b:a', opts.br || '64k');
      }
      args.push(out);
      const cmd = `ffmpeg ${args.map(a=> a.includes(' ')?`"${a}"`:a).join(' ')}`;
      await sh(cmd);
      let st;
      try { st = fs.statSync(out); } catch(e){ st = { size: 0 }; }
      console.log(`[slice] ${path.basename(out)} len=${len.toFixed(3)}s size=${(st.size/1024).toFixed(1)}KB codec=${opts.codec} hz=${opts.hz} br=${opts.br}`);
      if (!st.size || st.size < 4096) throw new Error(`slice_too_small: ${out} (${st.size} bytes)`);
      tmpFiles.push(out);
      return out;
    }

    // Send a buffer to Cloudflare Whisper and return JSON
    async function whisperFile(filepath){
      const buf = fs.readFileSync(filepath);
      console.log(`[upload] ${path.basename(filepath)} bytes=${buf.length}`);
      const fd = new FormData();
      fd.append('input', JSON.stringify({ response_format:'verbose_json' }));
      const mime = filepath.endsWith('.ogg') ? 'audio/ogg' : 'audio/mpeg';
      fd.append('file', new Blob([buf], { type: mime }), path.basename(filepath));
      const url = `https://api.cloudflare.com/client/v4/accounts/${account}/ai/run/@cf/openai/whisper`;
      const cf  = await fetch(url, { method:'POST', headers:{ Authorization:`Bearer ${token}` }, body: fd });
      const j   = await cf.json().catch(()=>({}));
      if(!cf.ok){
        return { ok:false, error:{ status: cf.status, body: j, file: path.basename(filepath), bytes: buf.length } };
      }
      return { ok:true, json: j };
    }

    // --- Chunk, transcribe, offset segments ---
    const segments = []; // full-song
    let language = 'auto';
    const total = Math.max(0, dur) || CHUNK_SEC; // if ffprobe failed, do at least one chunk

    for(let start=0; start < total; start += CHUNK_SEC){
      const len = Math.min(CHUNK_SEC, total - start);

      // try a ladder of smaller encodes / durations if CF says "Request is too large"
      let slice = await makeSlice(start, len, { codec:'libmp3lame', hz:32000, br:'64k' });
      let r = await whisperFile(slice);

      const tooLarge = (err) => {
        try {
          const b = err && err.body ? (err.body.errors || err.body.error || err.body) : null;
          const s = JSON.stringify(b||err);
          return /too large/i.test(s) || /request.*large/i.test(s);
        } catch { return false; }
      };

      if(!r.ok && tooLarge(r.error)){
        try {
          slice = await makeSlice(start, Math.min(len, 3), { codec:'libmp3lame', hz:24000, br:'48k' });
          r = await whisperFile(slice);
        } catch(e){}
      }
      if(!r.ok && tooLarge(r.error)){
        try {
          slice = await makeSlice(start, Math.min(len, 2), { codec:'libopus', hz:24000, br:'24k' });
          r = await whisperFile(slice);
        } catch(e){}
      }
      if(!r.ok){
        return res.status(502).json({ error:'whisper_failed', detail:r.error, chunk: { start, len, retried:true } });
      }
      const result = r.json.result || r.json;
      if(result.language) language = result.language;
      const segs = Array.isArray(result.segments) ? result.segments : [];
      for(const s of segs){
        const st = Number(s.start)||0, en = Number(s.end)||0;
        segments.push({ start: st + start, end: en + start, text: s.text||'' });
      }
    }

    // --- Build profanity spans across the entire song ---
    const spans = [];
    for(const s of segments){ if(hasBad(s.text)) spans.push({ start: Math.max(0,s.start), end: Math.max(0,s.end), reason:'profanity' }); }
    spans.sort((a,b)=> a.start-b.start);
    const merged = [];
    for(const s of spans){
      if(!merged.length || s.start > merged[merged.length-1].end){ merged.push({...s}); }
      else { merged[merged.length-1].end = Math.max(merged[merged.length-1].end, s.end); }
    }

    // --- Render 30s preview from the ORIGINAL upload ---
    const id = Date.now().toString(36);
    const out = path.join('public', `${id}.mp3`);

    // Only mute spans that intersect 0–30s window
    const PREVIEW_T = 30;
    const toMute = merged
      .filter(s => s.end > 0 && s.start < PREVIEW_T)
      .map(s => ({ start: Math.max(0,s.start), end: Math.min(PREVIEW_T, s.end) }))
      .filter(s => s.end > s.start);
    const filter = toMute.map(s=>`volume=enable='between(t,${s.start.toFixed(3)},${s.end.toFixed(3)})':volume=0`).join(',');

    const args = ['-hide_banner','-loglevel','error','-y','-i', src, '-t', String(PREVIEW_T)];
    if(filter) args.push('-af', filter);
    args.push('-codec:a','libmp3lame','-b:a','192k', out);
    await sh(`ffmpeg ${args.map(a=> a.includes(' ')?`"${a}"`:a).join(' ')}`);

    return res.json({
      preview_url: `/public/${path.basename(out)}`,
      language,
      transcript: segments.map(s=>s.text||'').join(' ').trim(),
      muted_spans: merged,
    });
  }catch(err){
    console.error(err);
    res.status(500).json({ error:'preview_failed', detail:String(err) });
  }finally{
    // cleanup
    try{ if(req.file?.path) fs.unlink(req.file.path, ()=>{}); }catch(_){ }
    for(const f of tmpFiles){ try{ fs.unlink(f, ()=>{}); }catch(_){ }
    }
  }
});

app.listen(port, ()=> console.log(`🚀 Clean Editor API on http://0.0.0.0:${port}`));
