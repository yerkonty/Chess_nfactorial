import Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';
import { PIECE_SKINS } from '@/lib/skins';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    try {
        const key = process.env.STRIPE_SECRET_KEY;
        if (!key || key === 'sk_test_placeholder') {
            return NextResponse.json({ error: 'Stripe key not configured' }, { status: 500 });
        }

        const stripe = new Stripe(key);
        const { skinId, userId } = await req.json();

        const skin = PIECE_SKINS.find((s) => s.id === skinId);
        if (!skin || skin.price === null) {
            return NextResponse.json({ error: 'Invalid skin' }, { status: 400 });
        }

        const origin = req.headers.get('origin') || 'https://ychess.me';

        const session = await stripe.checkout.sessions.create({
            payment_method_types: ['card'],
            line_items: [
                {
                    price_data: {
                        currency: 'usd',
                        product_data: {
                            name: `YChess — ${skin.name} Piece Skin`,
                            description: skin.description,
                        },
                        unit_amount: Math.round(skin.price * 100),
                    },
                    quantity: 1,
                },
            ],
            mode: 'payment',
            success_url: `${origin}/?skin=${skinId}&session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/`,
            metadata: { skinId, userId },
        });

        return NextResponse.json({ url: session.url });
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : String(e);
        return NextResponse.json({ error: message }, { status: 500 });
    }
}
