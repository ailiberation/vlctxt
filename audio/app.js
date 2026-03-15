// --- 1. THE SHIELD (Service Worker) ---
// sw.js removed - add the file back if you want offline caching

// --- 2. THE CORE ---
let ggwave = null;
let instance = null;
let sessionKey = null;
const log = document.getElementById('log');
const cmdInput = document.getElementById('cmd');
const terminal = document.getElementById('terminal');

// Shared AudioContext (reused across all transmissions)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

ggwave_factory().then(obj => {
    ggwave = obj;
    const parameters = ggwave.getDefaultParameters();
    parameters.sampleRateInp = audioCtx.sampleRate;
    parameters.sampleRateOut = audioCtx.sampleRate;
    instance = ggwave.init(parameters);
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
    const waveform = ggwave.encode(instance, text, protocolId, 10);
    const buffer = audioCtx.createBuffer(1, waveform.length, audioCtx.sampleRate);
    buffer.getChannelData(0).set(waveform);
    const source = audioCtx.createBufferSource();
    source.buffer = buffer;
    source.connect(audioCtx.destination);
    source.start();
}

async function startListener() {
    try {
        // Resume context in case it was suspended (required on mobile)
        if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
        }

        // Load the AudioWorklet processor
        await audioCtx.audioWorklet.addModule('ggwave-processor.js');

        const stream = await navigator.mediaDevices.getUserMedia({
            audio: {
                echoCancellation: false,
                noiseSuppression: false,
                autoGainControl: false
            }
        });

        const source = audioCtx.createMediaStreamSource(stream);
        const workletNode = new AudioWorkletNode(audioCtx, 'ggwave-processor');

        // Receive audio chunks from worklet and decode
        workletNode.port.onmessage = async (e) => {
            const result = ggwave.decode(instance, e.data);
            if (result && result.length > 0) {
                const rawText = new TextDecoder().decode(result);
                const clearText = await decrypt(rawText);
                addLine(`INCOMING: ${clearText}`);
                terminal.style.borderColor = "#ff00ff";
                setTimeout(() => terminal.style.borderColor = "var(--neon)", 500);
            }
        };

        // Connect mic -> worklet (no connection to destination, avoids feedback)
        source.connect(workletNode);

        addLine("SCANNING ULTRASONIC BANDS...");
    } catch (err) {
        addLine(`ERROR STARTING LISTENER: ${err.message}`);
    }
}

// --- 5. THE COMMANDER ---
cmdInput.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
        // Resume AudioContext on user interaction (required by mobile browsers)
        if (audioCtx.state === 'suspended') {
            await audioCtx.resume();
        }

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
            } else {
                addLine("ERROR: SET KEY FIRST.");
            }
        }
    }
});
