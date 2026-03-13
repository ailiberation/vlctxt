// Initializing the "Acoustic Deck"
let ggwave = null;
const log = document.getElementById('log');

// Load the WASM engine for the audio processing
ggwave_factory().then(obj => {
    ggwave = obj;
    addLine("SYSTEM READY. HANDSHAKE VERIFIED.");
});

function addLine(text) {
    const div = document.createElement('div');
    div.innerText = `[${new Date().toLocaleTimeString()}] ${text}`;
    log.appendChild(div);
}

// TRANSMIT: Turning text into 20kHz "Static"
function transmit(text) {
    const protocolId = 5; // 5 is the 'Ultra High' (Ultrasonic) protocol in ggwave
    const waveform = ggwave.encode(text, protocolId, 10); // 10 = Volume
    
    // Play the audio via Web Audio API
    const context = new AudioContext();
    const buffer = context.createBuffer(1, waveform.length, 44100);
    buffer.getChannelData(0).set(waveform);
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.connect(context.destination);
    source.start();
    addLine("BURST TRANSMITTED OVER ULTRASONIC...");
}

// RECEIVE: Listening for the Boss
async function startListener() {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { 
        echoCancellation: false, noiseSuppression: false, autoGainControl: false 
    }});
    // Add logic here to pass stream to ggwave.decode()
    addLine("LISTENING FOR STATIC ON THE LINE...");
}
