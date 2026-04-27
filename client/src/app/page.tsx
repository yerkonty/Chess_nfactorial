'use client';

import { useState, useEffect } from 'react';
import { account } from '@/lib/appwrite';
import AuthForm from '@/components/auth/Auth';
import Chessboard from '@/components/Chessboard';
import { Models } from 'appwrite';

export default function Home() {
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null);
  const [loading, setLoading] = useState(true);
  const [purchasedSkins, setPurchasedSkins] = useState<string[]>([]);

  useEffect(() => {
    const init = async () => {
      try {
        const currentUser = await account.get();
        setUser(currentUser);

        const prefs = currentUser.prefs as { purchasedSkins?: string[] };
        const existing: string[] = prefs.purchasedSkins ?? [];

        // Handle post-Stripe redirect (read URL params without useSearchParams)
        const params = new URLSearchParams(window.location.search);
        const skinId    = params.get('skin');
        const sessionId = params.get('session_id');

        if (skinId && sessionId && !existing.includes(skinId)) {
          const res = await fetch('/api/stripe/verify', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sessionId }),
          });
          const data = await res.json();
          if (data.paid && data.skinId === skinId) {
            const updated = [...existing, skinId];
            await account.updatePrefs({ ...prefs, purchasedSkins: updated });
            setPurchasedSkins(updated);
          } else {
            setPurchasedSkins(existing);
          }
        } else {
          setPurchasedSkins(existing);
        }

        // Clean URL params without triggering a navigation
        if (skinId || sessionId) {
          window.history.replaceState({}, '', '/');
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    init();
  }, []);

  const addPurchasedSkin = (skinId: string) => {
    setPurchasedSkins((prev) => [...prev, skinId]);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black">
        <div className="text-center">
          <div className="spinner mx-auto mb-3" />
          <p className="text-sm" style={{ color: '#adacac' }}>Loading…</p>
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black">
      {user
        ? <Chessboard
            userId={user.$id}
            userName={user.name || 'Player'}
            purchasedSkins={purchasedSkins}
            onSkinPurchased={addPurchasedSkin}
          />
        : <AuthForm />
      }
    </main>
  );
}
