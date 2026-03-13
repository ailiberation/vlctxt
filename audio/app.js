// --- 1. THE SHIELD (Service Worker Registration) ---
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log("GHOST PROTOCOL: OFFLINE CACHE ACTIVE"))
            .catch(err => console.log("GHOST PROTOCOL: FAILED", err));
    });
}

// --- 2. THE CORE (Variables & Engine Initialization) ---
let ggwave = null;
const log = document.getElementById('log');
const cmdInput = document.getElementById('cmd');
const terminal = document.getElementById('terminal');

// Initialize the ggwave WASM engine
ggwave_factory().then(obj => {
    ggwave = obj;
    addLine("SYSTEM READY. STATIC FREQUENCY LOCKED.");
    addLine("TYPE 'START' TO INITIALIZE RECEIVER.");
});

// --- 3. THE INTERFACE (UI Functions) ---
function addLine(text) {
    const div = document.createElement('div');
    div.innerText = `[${new Date().toLocaleTimeString()}] ${text}`;
    log.appendChild(div);
    // Auto-scroll to bottom
    terminal.scrollTop = terminal.scrollHeight;
}

// --- 4. THE PAYLOAD (Transmit & Receive Logic) ---
async function encryptData(plaintext, password) {
    const encoder = new TextEncoder();
    const data = encoder.encode(plaintext);
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    
    // Create a key from your password
    const passwordData = encoder.encode(password);
    const hash = await window.crypto.subtle.digest('SHA-256', passwordData);
    const key = await window.crypto.subtle.importKey('raw', hash, {name: 'AES-GCM'}, false, ['encrypt']);

    const ciphertext = await window.crypto.subtle.encrypt({name: 'AES-GCM', iv: iv}, key, data);
    
    // Combine IV and Ciphertext so the receiver knows how to start
    const combined = new Uint8Array(iv.length + ciphertext.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(ciphertext), iv.length);
    return btoa(String.fromCharCode.apply(null, combined)); // Convert to base64 string for transmission
}

// TRANSMIT FUNCTION
function transmit(text) {
    if (!ggwave) return addLine("ERROR: ENGINE NOT LOADED");
    
    // Protocol 5 = Ultra High (Ultrasonic / 18-22kHz)
    const protocolId = 5; 
    const waveform = ggwave.encode(text, protocolId, 10); // Volume 10
    
    const context = new (window.AudioContext || window.webkitAudioContext)();
    const buffer = context.createBuffer(1, waveform.length, 44100);
    buffer.getChannelData(0).set(waveform);
    
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.start();
    addLine(`BURST TRANSMITTED: "${text}"`);
}
async function decryptData(base64Data, password) {
    try {
        const combined = new Uint8Array(atob(base64Data).split("").map(c => c.charCodeAt(0)));
        const iv = combined.slice(0, 12);
        const ciphertext = combined.slice(12);
        
        const encoder = new TextEncoder();
        const passwordData = encoder.encode(password);
        const hash = await window.crypto.subtle.digest('SHA-256', passwordData);
        const key = await window.crypto.subtle.importKey('raw', hash, {name: 'AES-GCM'}, false, ['decrypt']);

        const decrypted = await window.crypto.subtle.decrypt({name: 'AES-GCM', iv: iv}, key, ciphertext);
        return new TextDecoder().decode(decrypted);
    } catch (e) {
        return "!!! DECRYPTION FAILED: WRONG KEY OR CORRUPT DATA !!!";
    }
}

// RECEIVE FUNCTION
async function startListener() {
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ 
            audio: { 
                echoCancellation: false, 
                noiseSuppression: false, 
                autoGainControl: false 
            } 
        });

        const context = new (window.AudioContext || window.webkitAudioContext)();
        const source = context.createMediaStreamSource(stream);
        const processor = context.createScriptProcessor(1024, 1, 1);

        source.connect(processor);
        processor.connect(context.destination);

        processor.onaudioprocess = function
