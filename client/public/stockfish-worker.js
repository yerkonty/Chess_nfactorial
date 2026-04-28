let engine = null;
let engineReady = false;
const queue = [];

self.onmessage = async (e) => {
    const { type, payload } = e.data;

    if (type === 'init') {
        if (engine) {
            // Already initialised — just report ready status
            if (engineReady) self.postMessage({ type: 'ready' });
            return;
        }
        importScripts('/stockfish-18-lite.js');
        engine = await Stockfish();

        engine.addMessageListener(line => {
            if (line === 'readyok') {
                engineReady = true;
                self.postMessage({ type: 'ready' });
                // Flush commands that arrived before the engine was ready
                queue.forEach(cmd => engine.postMessage(cmd));
                queue.length = 0;
            }
            if (line.startsWith('bestmove')) {
                const mv = line.split(' ')[1];
                if (mv && mv !== '(none)') {
                    self.postMessage({ type: 'best-move', payload: mv });
                }
            }
        });

        // Handshake — wait for readyok before accepting position/go
        engine.postMessage('uci');
        engine.postMessage('isready');

    } else if (type === 'uci') {
        // Raw UCI string forwarding (same as original worker)
        if (!engineReady) {
            queue.push(payload);
        } else {
            engine.postMessage(payload);
        }
    } else if (type === 'stop') {
        if (engine) engine.postMessage('stop');
    }
};
