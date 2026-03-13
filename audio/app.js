// --- 1. THE SHIELD (Service Worker) ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js').then(reg => console.log("OFFLINE CACHE READY"));
    });
}

// --- 2. THE CORE ---
let ggwave = null;
let sessionKey = null; // This holds our "Shared Secret"
const log = document.getElementById('log');
const cmdInput = document.getElementById('cmd');
const terminal = document.getElementById('terminal');

ggwave_factory().then(obj => {
    ggwave = obj;
    addLine("SYSTEM READY. ENCRYPTION MODULE LOADED.");
    addLine("STEP 1: TYPE 'KEY [YOUR_PASSWORD]' TO SET THE SECRET.");
    addLine("STEP 2: TYPE 'START' TO INITIALIZE LISTENER.");
});

function addLine(text) {
    const div = document.createElement('div');
    div.innerText = `[${new Date().toLocaleTimeString()}] ${text}`;
    log.appendChild(div);
    terminal.scrollTop = terminal.scrollHeight;
}

// --- 3. THE CRYPTO VAULT ---
async function getKey(password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hash = await window.crypto.subtle.digest('SHA-256', data);
    return window.crypto.subtle.importKey('raw', hash, {name: 'AES-GCM'}, false, ['encrypt', 'decrypt']);
}

async function encrypt(text) {
    if (!sessionKey) return null;
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(text);
    const ciphertext = await window.crypto.subtle.encrypt({name: "AES-GCM", iv}, sessionKey, encoded);
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);
    return btoa(String.fromCharCode.apply(null, combined));
}

async function decrypt(base64) {
    if (!sessionKey) return "!!! NO KEY SET !!!";
    try {
        const combined = new Uint8Array(atob(base64).split("").map(c => c.charCodeAt(0)));
        const iv = combined.slice(0, 12);
        const data = combined.slice(12);
        const decrypted = await window.crypto.subtle.decrypt({name: "AES-GCM", iv}, sessionKey, data);
        return new TextDecoder().decode(decrypted);
    } catch (e) { return "!!! DECRYPTION FAILED (CORRUPT OR WRONG KEY) !!!"; }
}

// --- 4. THE MODEM ---
function transmit(text) {
    const protocolId = 5; // Ultrasonic
    const waveform = ggwave.encode(text, protocolId, 10);
    const context = new (window.AudioContext || window.webkitAudioContext)();
    const buffer = context.createBuffer(1, waveform.length, 44100);
    buffer.getChannelData(0).set(waveform);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.start();
}

async function startListener() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    const context = new AudioContext();
    const source = context.createMediaStreamSource(stream);
    const processor = context.createScriptProcessor(1024, 1, 1);
    source.connect(processor);
    processor.connect(context.destination);

    processor.onaudioprocess = async (e) => {
        const result = ggwave.decode(e.inputBuffer.getChannelData(0));
        if (result && result.length > 0) {
            const rawText = new TextDecoder().decode(result);
            const clearText = await decrypt(rawText);
            addLine(`INCOMING: ${clearText}`);
            terminal.style.borderColor = "#ff00ff";
            setTimeout(() => terminal.style.borderColor = "var(--neon)", 500);
        }
    };
    addLine("SCANNING ULTRASONIC BANDS...");
}

// --- 5. THE COMMANDER ---
cmdInput.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
        const val = cmdInput.value.trim();
        cmdInput.value = '';
        if (val.toLowerCase().startsWith('key ')) {
            sessionKey = await getKey(val.split(' ')[1]);
            addLine("SESSION KEY INSTALLED.");
        } else if (val.toLowerCase() === 'start') {
            startListener();
        } else {
            const secretPayload = await encrypt(val);
            if (secretPayload) {
                transmit(secretPayload);
                addLine(`OUTGOING (SECURE): ${val}`);
            } else { addLine("ERROR: SET KEY FIRST."); }
        }
    }
});
