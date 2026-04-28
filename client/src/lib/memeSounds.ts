// Real MP3 meme sounds from myinstants.com
// Cached Audio elements for instant replay

const cache = new Map<string, HTMLAudioElement>();
let current: HTMLAudioElement | null = null;

function get(name: string): HTMLAudioElement {
    if (!cache.has(name)) {
        const a = new Audio(`/meme-sounds/${name}.mp3`);
        a.preload = 'auto';
        cache.set(name, a);
    }
    return cache.get(name)!;
}

function play(name: string, volume = 0.75): void {
    try {
        if (current) { current.pause(); current.currentTime = 0; }
        const a = get(name);
        a.currentTime = 0;
        a.volume = volume;
        current = a;
        a.play().catch(() => {});
    } catch { /* browser blocked autoplay */ }
}

export function stopMemeSound(): void {
    if (current) { current.pause(); current.currentTime = 0; current = null; }
}

function pick(arr: string[]): string { return arr[Math.floor(Math.random() * arr.length)]; }

// Preload all sounds so first play is instant
export function preloadMemeSounds(): void {
    const all = [
        'among-us', 'baby-laugh', 'faahh', 'emotional-damage', 'spiderman',
        'instagram-thud', 'galaxy', 'shocked', 'cat-laugh', 'snore',
        'social-credit', 'oh-my-god', 'french-song', 'wow-anime', 'dexter',
        'bruh', 'auughh', 'oi-oi', 'punch', 'bing-chilling',
        'what-the-hell', 'rizzbot',
    ];
    all.forEach(name => get(name)); // warms the cache
}

// ── Distribution by situation ────────────────────────────────────────────────

/** Regular move — satisfying, neutral */
export function playMemeMove(): void {
    play(pick([
        'instagram-thud', // the satisfying thud
        'punch',          // aggressive move energy
        'wow-anime',      // impressed spectator
        'bruh',           // nonchalant
        'oi-oi',          // hyped
    ]));
}

/** Capture — something dramatic happened */
export function playMemeCapture(): void {
    play(pick([
        'auughh',           // pain / frustration
        'what-the-hell',    // disbelief reaction
        'oh-my-god',        // shocked
        'emotional-damage', // Steven He classic
        'faahh',            // the FAAHH reaction
        'shocked',          // shocked sfx
    ]));
}

/** Check — alarm / warning vibes */
export function playMemeCheck(): void {
    play(pick([
        'social-credit',    // -999 social credit siren
        'among-us',         // SUS detected
        'what-the-hell',    // wtf is happening
        'emotional-damage', // EMOTIONAL DAMAGE
    ]));
}

/** Queen captured — extra spicy */
export function playMemeCaptureQueen(): void {
    play(pick([
        'baby-laugh',       // baby laughing at you
        'cat-laugh',        // cat laughing at you
        'rizzbot',          // rizzbot laughing
        'oh-my-god',        // oh my god bro
        'emotional-damage', // EMOTIONAL DAMAGE
    ]));
}

/** En passant — galaxy brain */
export function playMemeEnPassant(): void {
    play(pick([
        'galaxy',         // galaxy brain
        'social-credit',  // -999 social credit for such a move
        'among-us',       // sus rule
        'what-the-hell',  // what the hell is en passant
    ]));
}

/** Game over win */
export function playMemeWin(): void {
    play(pick([
        'french-song',   // French victory song
        'spiderman',     // Spiderman theme
        'oi-oi',         // oi oi oe celebration
        'baby-laugh',    // baby laughing happily
        'rizzbot',       // rizzbot laugh of triumph
        'cat-laugh',     // cat judging the loser
    ]));
}

/** Game over loss */
export function playMemeLose(): void {
    play(pick([
        'snore',          // boring / skill issue
        'bruh',           // bruh
        'dexter',         // dexter meme music
        'bing-chilling',  // John Cena bing chilling
        'galaxy',         // galaxy brain'd yourself into losing
    ]));
}

/** Generic game over — random win/lose variant based on param */
export function playMemeGameOver(win: boolean): void {
    if (win) playMemeWin(); else playMemeLose();
}
