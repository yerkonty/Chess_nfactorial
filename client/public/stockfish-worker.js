let stockfish = null;

self.onmessage = async (event) => {
    const { type, payload } = event.data;

    if (type === 'init') {
        if (!stockfish) {
            importScripts('/stockfish-18-lite.js');
            stockfish = await Stockfish();

            stockfish.addMessageListener((line) => {
                self.postMessage({ type: 'engine-message', payload: line });
                if (line.startsWith('bestmove')) {
                    const bestMove = line.split(' ')[1];
                    self.postMessage({ type: 'best-move', payload: bestMove });
                }
            });
        }
        self.postMessage({ type: 'init-complete' });
    } else if (type === 'uci') {
        if (stockfish) {
            stockfish.postMessage(payload);
        }
    }
};
