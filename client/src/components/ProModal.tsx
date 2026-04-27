'use client';

import { useState } from 'react';
import { PIECE_SKINS } from '@/lib/skins';

const PRO_FEATURES = [
    'Unlimited AI Coach sessions',
    'Deep post-game analysis (10+ key moments)',
    'Grandmaster-level AI (depth 25+)',
    'Unlimited game history',
    'Online multiplayer',
    'Exclusive board themes',
    'Opening repertoire trainer',
];

const FREE_FEATURES = [
    'Basic AI Coach (3/day)',
    'Play vs AI & friends locally',
    'Post-game analysis',
    'Game history (last 50)',
];

type Plan = 'monthly' | 'annual';
type Tab  = 'plan' | 'skins';

export default function ProModal({
    onClose,
    purchasedSkins,
    onBuySkin,
}: {
    onClose: () => void;
    purchasedSkins: string[];
    onBuySkin: (skinId: string) => Promise<void>;
}) {
    const [tab, setTab]       = useState<Tab>('plan');
    const [plan, setPlan]     = useState<Plan>('annual');
    const [loading, setLoading] = useState<string | null>(null); // skinId being purchased
    const [planClicked, setPlanClicked] = useState(false);

    const handlePlanCTA = () => {
        setPlanClicked(true);
        setTimeout(() => setPlanClicked(false), 2500);
    };

    const handleBuy = async (skinId: string) => {
        setLoading(skinId);
        try {
            await onBuySkin(skinId);
        } finally {
            setLoading(null);
        }
    };

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center px-4"
            style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)' }}
            onClick={onClose}
        >
            <div
                className="w-full max-w-md rounded-sm animate-slide-up"
                style={{ backgroundColor: '#111', border: '1px solid #282828', maxHeight: '90vh', overflowY: 'auto' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-8 pt-8 pb-5 border-b border-[#1e1e1e]">
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-xs uppercase tracking-widest mb-2" style={{ color: '#bcfe00' }}>
                                ⚡ YChess Pro
                            </p>
                            <h2 className="text-2xl font-bold">Unlock your full potential</h2>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-2xl leading-none transition-colors hover:text-white mt-1"
                            style={{ color: '#555' }}
                        >
                            ×
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-6 mt-5">
                        {(['plan', 'skins'] as Tab[]).map((t) => (
                            <button
                                key={t}
                                onClick={() => setTab(t)}
                                className="text-xs uppercase tracking-widest pb-3 border-b-2 transition-all"
                                style={
                                    tab === t
                                        ? { color: '#bcfe00', borderColor: '#bcfe00' }
                                        : { color: '#555', borderColor: 'transparent' }
                                }
                            >
                                {t === 'plan' ? 'Pro Plan' : 'Piece Skins'}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── PRO PLAN TAB ── */}
                {tab === 'plan' && (
                    <div className="px-8 py-6">
                        {/* Toggle */}
                        <div
                            className="flex rounded-sm overflow-hidden mb-6"
                            style={{ backgroundColor: '#191919', border: '1px solid #282828' }}
                        >
                            {(['monthly', 'annual'] as Plan[]).map((p) => (
                                <button
                                    key={p}
                                    onClick={() => setPlan(p)}
                                    className="flex-1 py-2.5 text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                                    style={
                                        plan === p
                                            ? { backgroundColor: '#bcfe00', color: '#000', fontWeight: 700 }
                                            : { color: '#adacac' }
                                    }
                                >
                                    {p === 'annual' ? 'Annual' : 'Monthly'}
                                    {p === 'annual' && (
                                        <span
                                            className="text-[9px] px-1.5 py-0.5 rounded-sm font-bold uppercase"
                                            style={
                                                plan === 'annual'
                                                    ? { backgroundColor: '#000', color: '#bcfe00' }
                                                    : { backgroundColor: '#bcfe0022', color: '#bcfe00' }
                                            }
                                        >
                                            Save 34%
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>

                        {/* Price */}
                        <div className="mb-1 flex items-end gap-1">
                            <span className="text-4xl font-bold">
                                {plan === 'annual' ? '$6.59' : '$9.99'}
                            </span>
                            <span className="text-sm mb-1.5" style={{ color: '#adacac' }}>/month</span>
                        </div>
                        <p className="text-xs mb-6" style={{ color: '#555' }}>
                            {plan === 'annual' ? 'Billed as $79/year · Cancel anytime' : 'Billed monthly · Cancel anytime'}
                        </p>

                        {/* Pro features */}
                        <div className="space-y-2 mb-4">
                            {PRO_FEATURES.map((f) => (
                                <div key={f} className="flex items-center gap-3 text-sm">
                                    <span className="flex-shrink-0" style={{ color: '#bcfe00' }}>✓</span>
                                    <span>{f}</span>
                                </div>
                            ))}
                        </div>
                        <div className="pt-3 border-t border-[#1e1e1e] space-y-2 mb-6">
                            {FREE_FEATURES.map((f) => (
                                <div key={f} className="flex items-center gap-3 text-sm" style={{ color: '#555' }}>
                                    <span className="flex-shrink-0">✓</span>
                                    <span>{f}</span>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={handlePlanCTA}
                            className="w-full py-3.5 text-sm uppercase tracking-widest font-bold rounded-sm transition-all active:scale-[0.98] hover:brightness-110"
                            style={{ backgroundColor: '#bcfe00', color: '#000' }}
                        >
                            {planClicked ? '🎉 Coming soon — stay tuned!' : 'Start Free 7-Day Trial'}
                        </button>
                        <p className="text-center text-xs mt-3" style={{ color: '#555' }}>
                            No credit card required
                        </p>
                    </div>
                )}

                {/* ── PIECE SKINS TAB ── */}
                {tab === 'skins' && (
                    <div className="px-8 py-6 space-y-4">
                        <p className="text-xs" style={{ color: '#adacac' }}>
                            One-time purchase. Yours forever.
                        </p>

                        {PIECE_SKINS.map((skin) => {
                            const owned = skin.price === null || purchasedSkins.includes(skin.id);
                            const isLoading = loading === skin.id;

                            return (
                                <div
                                    key={skin.id}
                                    className="flex items-center justify-between rounded-sm px-4 py-4"
                                    style={{ backgroundColor: '#191919', border: '1px solid #282828' }}
                                >
                                    <div className="flex items-center gap-4">
                                        {/* Piece preview — king symbol styled with the skin */}
                                        <div
                                            style={{
                                                fontSize: 32,
                                                lineHeight: 1,
                                                width: 44,
                                                textAlign: 'center',
                                                ...skin.whiteStyle,
                                            }}
                                        >
                                            ♔
                                        </div>
                                        <div>
                                            <p className="text-sm font-medium">{skin.name}</p>
                                            <p className="text-xs mt-0.5" style={{ color: '#555' }}>
                                                {skin.description}
                                            </p>
                                        </div>
                                    </div>

                                    {owned ? (
                                        <span
                                            className="text-xs uppercase tracking-widest px-3 py-1.5 rounded-sm"
                                            style={{ backgroundColor: '#1a2a00', color: '#bcfe00', border: '1px solid #bcfe0044' }}
                                        >
                                            {skin.price === null ? 'Free' : 'Owned'}
                                        </span>
                                    ) : (
                                        <button
                                            onClick={() => handleBuy(skin.id)}
                                            disabled={isLoading}
                                            className="text-xs uppercase tracking-widest px-3 py-1.5 rounded-sm font-bold transition-all active:scale-[0.97] hover:brightness-110 disabled:opacity-50"
                                            style={{ backgroundColor: '#bcfe00', color: '#000' }}
                                        >
                                            {isLoading ? '…' : `$${skin.price?.toFixed(2)}`}
                                        </button>
                                    )}
                                </div>
                            );
                        })}

                        <p className="text-xs pt-2" style={{ color: '#555' }}>
                            Secure checkout powered by Stripe. Skins are applied instantly after purchase.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
