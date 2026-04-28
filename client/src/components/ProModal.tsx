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
            style={{ backgroundColor: 'rgba(74,44,10,0.55)', backdropFilter: 'blur(4px)' }}
            onClick={onClose}
        >
            <div
                className="w-full max-w-md animate-slide-up"
                style={{ backgroundColor: '#FFFDF9', border: '1.5px solid #C8A882', boxShadow: '6px 6px 0 #C8A882', maxHeight: '90vh', overflowY: 'auto' }}
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="px-8 pt-8 pb-5" style={{ borderBottom: '1.5px solid #E8D9A8' }}>
                    <div className="flex items-start justify-between">
                        <div>
                            <p className="text-xs font-black uppercase tracking-widest mb-2" style={{ color: '#D4722A' }}>
                                ⚡ YChess Pro
                            </p>
                            <h2 className="text-2xl font-black" style={{ color: '#4A2C0A' }}>Unlock your full potential</h2>
                        </div>
                        <button onClick={onClose} className="text-2xl leading-none mt-1" style={{ color: '#C8A882', background: 'none', border: 'none', cursor: 'pointer' }}>×</button>
                    </div>
                    <div className="flex gap-6 mt-5">
                        {(['plan', 'skins'] as Tab[]).map((t) => (
                            <button key={t} onClick={() => setTab(t)}
                                className="text-xs font-black uppercase tracking-widest pb-3 border-b-2 transition-all"
                                style={tab === t ? { color: '#D4722A', borderColor: '#D4722A' } : { color: '#C8A882', borderColor: 'transparent' }}>
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
                            style={{ backgroundColor: '#F7EDDA', border: '1px solid #E8D9A8' }}
                        >
                            {(['monthly', 'annual'] as Plan[]).map((p) => (
                                <button
                                    key={p}
                                    onClick={() => setPlan(p)}
                                    className="flex-1 py-2.5 text-xs uppercase tracking-widest flex items-center justify-center gap-2 transition-all"
                                    style={
                                        plan === p
                                            ? { backgroundColor: '#D4722A', color: '#FFFDF9', fontWeight: 700 }
                                            : { color: '#A07650' }
                                    }
                                >
                                    {p === 'annual' ? 'Annual' : 'Monthly'}
                                    {p === 'annual' && (
                                        <span
                                            className="text-[9px] px-1.5 py-0.5 rounded-sm font-bold uppercase"
                                            style={
                                                plan === 'annual'
                                                    ? { backgroundColor: '#000', color: '#D4722A' }
                                                    : { backgroundColor: '#D4722A22', color: '#D4722A' }
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
                            <span className="text-sm mb-1.5" style={{ color: '#A07650' }}>/month</span>
                        </div>
                        <p className="text-xs mb-6" style={{ color: '#C8A882' }}>
                            {plan === 'annual' ? 'Billed as $79/year · Cancel anytime' : 'Billed monthly · Cancel anytime'}
                        </p>

                        {/* Pro features */}
                        <div className="space-y-2 mb-4">
                            {PRO_FEATURES.map((f) => (
                                <div key={f} className="flex items-center gap-3 text-sm">
                                    <span className="flex-shrink-0" style={{ color: '#D4722A' }}>✓</span>
                                    <span>{f}</span>
                                </div>
                            ))}
                        </div>
                        <div className="pt-3 border-t border-[#1e1e1e] space-y-2 mb-6">
                            {FREE_FEATURES.map((f) => (
                                <div key={f} className="flex items-center gap-3 text-sm" style={{ color: '#C8A882' }}>
                                    <span className="flex-shrink-0">✓</span>
                                    <span>{f}</span>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={handlePlanCTA}
                            className="w-full py-3.5 text-sm uppercase tracking-widest font-bold rounded-sm transition-all active:scale-[0.98] hover:brightness-110"
                            style={{ backgroundColor: '#D4722A', color: '#FFFDF9' }}
                        >
                            {planClicked ? '🎉 Coming soon — stay tuned!' : 'Start Free 7-Day Trial'}
                        </button>
                        <p className="text-center text-xs mt-3" style={{ color: '#C8A882' }}>
                            No credit card required
                        </p>
                    </div>
                )}

                {/* ── PIECE SKINS TAB ── */}
                {tab === 'skins' && (
                    <div className="px-8 py-6 space-y-4">
                        <p className="text-xs" style={{ color: '#A07650' }}>
                            One-time purchase. Yours forever.
                        </p>

                        {PIECE_SKINS.map((skin) => {
                            const owned = skin.price === null || purchasedSkins.includes(skin.id);
                            const isLoading = loading === skin.id;

                            return (
                                <div
                                    key={skin.id}
                                    className="flex items-center justify-between rounded-sm px-4 py-4"
                                    style={{ backgroundColor: '#F7EDDA', border: '1px solid #E8D9A8' }}
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
                                            <p className="text-xs mt-0.5" style={{ color: '#C8A882' }}>
                                                {skin.description}
                                            </p>
                                        </div>
                                    </div>

                                    {owned ? (
                                        <span
                                            className="text-xs uppercase tracking-widest px-3 py-1.5 rounded-sm"
                                            style={{ backgroundColor: '#1a2a00', color: '#D4722A', border: '1px solid #D4722A44' }}
                                        >
                                            {skin.price === null ? 'Free' : 'Owned'}
                                        </span>
                                    ) : (
                                        <button
                                            onClick={() => handleBuy(skin.id)}
                                            disabled={isLoading}
                                            className="text-xs uppercase tracking-widest px-3 py-1.5 rounded-sm font-bold transition-all active:scale-[0.97] hover:brightness-110 disabled:opacity-50"
                                            style={{ backgroundColor: '#D4722A', color: '#FFFDF9' }}
                                        >
                                            {isLoading ? '…' : `$${skin.price?.toFixed(2)}`}
                                        </button>
                                    )}
                                </div>
                            );
                        })}

                        <p className="text-xs pt-2" style={{ color: '#C8A882' }}>
                            Secure checkout powered by Stripe. Skins are applied instantly after purchase.
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
