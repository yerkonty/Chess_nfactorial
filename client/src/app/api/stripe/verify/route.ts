import Stripe from 'stripe';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    const { sessionId } = await req.json();

    try {
        const session = await stripe.checkout.sessions.retrieve(sessionId);

        if (session.payment_status === 'paid') {
            return NextResponse.json({
                paid: true,
                skinId: session.metadata?.skinId ?? null,
            });
        }

        return NextResponse.json({ paid: false });
    } catch {
        return NextResponse.json({ paid: false }, { status: 400 });
    }
}
