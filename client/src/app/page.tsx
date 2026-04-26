'use client';

import { useState, useEffect } from 'react';
import { account } from '@/lib/appwrite';
import AuthForm from '@/components/auth/Auth';
import Chessboard from "@/components/Chessboard";
import { Models } from 'appwrite';

export default function Home() {
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkUser = async () => {
      try {
        const currentUser = await account.get();
        setUser(currentUser);
      } catch (error) {
        setUser(null);
      } finally {
        setLoading(false);
      }
    };

    checkUser();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-white">Loading...</p>
      </div>
    );
  }

  return (
    <main className="flex items-center justify-center min-h-screen bg-gray-800">
      {user ? <Chessboard userId={user.$id} /> : <AuthForm />}
    </main>
  );
}



