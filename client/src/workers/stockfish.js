// In /workers/stockfish.js
let stockfish;

self.onmessage = async (event) => {
    const { type, payload } = event.data;

    if (type === 'init') {
        if (!stockfish) {
            // Dynamically import the stockfish library, using the js file in the same folder
            const { default: Stockfish } = await import('./stockfish.js');
            stockfish = await Stockfish();

            stockfish.addEventListener('message', (line) => {
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
            await stockfish.send(payload);
        }
    }
};
