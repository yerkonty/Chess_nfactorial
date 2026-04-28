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

// ─── Meme sounds ────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)]; }

/** Vine Boom — iconic deep sub-bass punch */
function vineBoom(ac: AudioContext) {
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(90, t);
    osc.frequency.exponentialRampToValueAtTime(28, t + 0.55);
    const dist = ac.createWaveShaper();
    const curve = new Float32Array(256);
    for (let i = 0; i < 256; i++) { const x = (i * 2) / 255 - 1; curve[i] = Math.tanh(x * 4); }
    dist.curve = curve;
    const g = ac.createGain();
    g.gain.setValueAtTime(1.0, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    osc.connect(dist); dist.connect(g); g.connect(ac.destination);
    osc.start(t); osc.stop(t + 0.6);
}

/** Pew — laser sweep down */
function pew(ac: AudioContext) {
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1600, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.22);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.22);
    osc.connect(g); g.connect(ac.destination);
    osc.start(t); osc.stop(t + 0.25);
}

/** Boing — spring bounce up then down */
function boing(ac: AudioContext) {
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(200, t);
    osc.frequency.exponentialRampToValueAtTime(900, t + 0.12);
    osc.frequency.exponentialRampToValueAtTime(300, t + 0.28);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.3, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(g); g.connect(ac.destination);
    osc.start(t); osc.stop(t + 0.38);
}

/** Bruh — deep descending triangle tone */
function bruh(ac: AudioContext) {
    const t = ac.currentTime;
    const osc = ac.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(380, t);
    osc.frequency.exponentialRampToValueAtTime(70, t + 0.3);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc.connect(g); g.connect(ac.destination);
    osc.start(t); osc.stop(t + 0.38);
}

/** Air Horn — BRAAP sawtooth burst */
function airHorn(ac: AudioContext) {
    const t = ac.currentTime;
    [1, 1.26, 1.52, 2.02].forEach(ratio => {
        const osc = ac.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = 230 * ratio;
        const g = ac.createGain();
        g.gain.setValueAtTime(0.12, t);
        g.gain.setValueAtTime(0.12, t + 0.18);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
        osc.connect(g); g.connect(ac.destination);
        osc.start(t); osc.stop(t + 0.35);
    });
}

/** Windows XP error — two-tone descend */
function windowsError(ac: AudioContext) {
    const t = ac.currentTime;
    [880, 698].forEach((freq, i) => {
        const osc = ac.createOscillator();
        osc.type = 'square';
        osc.frequency.value = freq;
        const g = ac.createGain();
        g.gain.setValueAtTime(0, t + i * 0.16);
        g.gain.linearRampToValueAtTime(0.18, t + i * 0.16 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t + i * 0.16 + 0.22);
        osc.connect(g); g.connect(ac.destination);
        osc.start(t + i * 0.16); osc.stop(t + i * 0.16 + 0.26);
    });
}

/** "OHHHH" crowd — big dramatic chord hit */
function ohhh(ac: AudioContext) {
    const t = ac.currentTime;
    [130, 165, 196, 261].forEach(freq => {
        const osc = ac.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        const g = ac.createGain();
        g.gain.setValueAtTime(0.1, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
        osc.connect(g); g.connect(ac.destination);
        osc.start(t); osc.stop(t + 0.5);
    });
}

/** Sad trombone — wah wah wah wahhh */
function sadTrombone(ac: AudioContext) {
    const t = ac.currentTime;
    [466, 392, 330, 247].forEach((freq, i) => {
        const osc = ac.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.value = freq;
        const lp = ac.createBiquadFilter();
        lp.type = 'lowpass'; lp.frequency.value = 1200;
        const g = ac.createGain();
        const s = t + i * 0.24;
        g.gain.setValueAtTime(0, s);
        g.gain.linearRampToValueAtTime(0.22, s + 0.05);
        g.gain.exponentialRampToValueAtTime(0.001, s + 0.24);
        osc.connect(lp); lp.connect(g); g.connect(ac.destination);
        osc.start(s); osc.stop(s + 0.28);
    });
}

/** Victory fanfare — ascending C major arpeggio */
function victoryFanfare(ac: AudioContext) {
    const t = ac.currentTime;
    [523, 659, 784, 1047, 1319].forEach((freq, i) => {
        const osc = ac.createOscillator();
        osc.type = 'square';
        osc.frequency.value = freq;
        const g = ac.createGain();
        const s = t + i * 0.1;
        g.gain.setValueAtTime(0, s);
        g.gain.linearRampToValueAtTime(0.14, s + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, s + 0.28);
        osc.connect(g); g.connect(ac.destination);
        osc.start(s); osc.stop(s + 0.32);
    });
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
