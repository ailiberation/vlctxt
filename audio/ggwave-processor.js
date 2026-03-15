class GGWaveProcessor extends AudioWorkletProcessor {
    process(inputs) {
        const input = inputs[0];
        if (input && input[0]) {
            // Send audio samples to main thread for ggwave to decode
            this.port.postMessage(input[0]);
        }
        return true;
    }
}

registerProcessor('ggwave-processor', GGWaveProcessor);
