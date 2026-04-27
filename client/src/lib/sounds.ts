let ctx: AudioContext | null = null;

function getCtx(): AudioContext {
    if (!ctx) ctx = new AudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
}

function noise(ac: AudioContext, duration: number, decay: number): AudioBufferSourceNode {
    const len = Math.floor(ac.sampleRate * duration);
    const buf = ac.createBuffer(1, len, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    const src = ac.createBufferSource();
    src.buffer = buf;
    return src;
}

export function playMove(): void {
    try {
        const ac = getCtx();
        const t = ac.currentTime;
        const master = ac.createGain();
        master.gain.value = 0.55;
        master.connect(ac.destination);

        // Woody click: shaped noise through bandpass
        const src = noise(ac, 0.05, 5);
        const bp = ac.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 900;
        bp.Q.value = 1.2;
        src.connect(bp);
        bp.connect(master);
        src.start(t);

        // Low thud: pitch-dropping sine
        const osc = ac.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(160, t);
        osc.frequency.exponentialRampToValueAtTime(70, t + 0.07);
        const og = ac.createGain();
        og.gain.setValueAtTime(0.28, t);
        og.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
        osc.connect(og);
        og.connect(master);
        osc.start(t);
        osc.stop(t + 0.08);
    } catch { /* AudioContext unavailable */ }
}

export function playCapture(): void {
    try {
        const ac = getCtx();
        const t = ac.currentTime;
        const master = ac.createGain();
        master.gain.value = 0.7;
        master.connect(ac.destination);

        // Heavier, lower noise burst
        const src = noise(ac, 0.09, 3);
        const bp = ac.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.value = 480;
        bp.Q.value = 0.7;
        src.connect(bp);
        bp.connect(master);
        src.start(t);

        // Deeper thud
        const osc = ac.createOscillator();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(120, t);
        osc.frequency.exponentialRampToValueAtTime(50, t + 0.1);
        const og = ac.createGain();
        og.gain.setValueAtTime(0.4, t);
        og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
        osc.connect(og);
        og.connect(master);
        osc.start(t);
        osc.stop(t + 0.12);
    } catch {}
}

export function playCheck(): void {
    try {
        const ac = getCtx();
        const t = ac.currentTime;

        [0, 0.09].forEach((delay, i) => {
            const osc = ac.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = i === 0 ? 1100 : 1400;
            const g = ac.createGain();
            g.gain.setValueAtTime(0, t + delay);
            g.gain.linearRampToValueAtTime(0.28, t + delay + 0.01);
            g.gain.exponentialRampToValueAtTime(0.001, t + delay + 0.18);
            osc.connect(g);
            g.connect(ac.destination);
            osc.start(t + delay);
            osc.stop(t + delay + 0.22);
        });
    } catch {}
}

export function playGameOver(): void {
    try {
        const ac = getCtx();
        const t = ac.currentTime;

        [880, 698, 523].forEach((freq, i) => {
            const osc = ac.createOscillator();
            osc.type = 'sine';
            osc.frequency.value = freq;
            const g = ac.createGain();
            g.gain.setValueAtTime(0, t + i * 0.18);
            g.gain.linearRampToValueAtTime(0.22, t + i * 0.18 + 0.015);
            g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.18 + 0.35);
            osc.connect(g);
            g.connect(ac.destination);
            osc.start(t + i * 0.18);
            osc.stop(t + i * 0.18 + 0.4);
        });
    } catch {}
}
