import type { CSSProperties } from 'react';

export type PieceSkin = {
    id: string;
    name: string;
    description: string;
    price: number | null; // null = free
    accentColor: string;  // for swatch preview
    whiteStyle: CSSProperties;
    blackStyle: CSSProperties;
};

export const PIECE_SKINS: PieceSkin[] = [
    {
        id: 'classic',
        name: 'Classic',
        description: 'The timeless original',
        price: null,
        accentColor: '#ffffff',
        whiteStyle: {
            color: '#ffffff',
            textShadow: '0 1px 3px rgba(0,0,0,0.85)',
        },
        blackStyle: {
            color: '#2d2d2d',
            textShadow: '0 1px 0 #000000, 0 2px 3px rgba(0,0,0,0.4)',
            WebkitTextStroke: '0.7px #1a1a1a',
        },
    },
    {
        id: 'neon',
        name: 'Neon Glow',
        description: 'Electric pieces that pulse with energy',
        price: 2.99,
        accentColor: '#bcfe00',
        whiteStyle: {
            color: '#bcfe00',
            textShadow: '0 0 8px #bcfe00, 0 0 20px rgba(188,254,0,0.55)',
        },
        blackStyle: {
            color: '#00d4ff',
            textShadow: '0 0 8px #00d4ff, 0 0 20px rgba(0,212,255,0.55)',
        },
    },
    {
        id: 'gold',
        name: 'Gold Rush',
        description: 'Gilded pieces fit for a champion',
        price: 2.99,
        accentColor: '#FFD700',
        whiteStyle: {
            color: '#FFD700',
            textShadow: '0 0 8px rgba(255,215,0,0.6), 0 1px 0 rgba(120,80,0,0.9)',
        },
        blackStyle: {
            color: '#CD7F32',
            textShadow: '0 0 8px rgba(205,127,50,0.55), 0 1px 0 rgba(80,40,0,0.9)',
        },
    },
    {
        id: 'crystal',
        name: 'Crystal',
        description: 'Icy blue pieces with a frozen glow',
        price: 2.99,
        accentColor: '#88ccff',
        whiteStyle: {
            color: '#e0f4ff',
            textShadow: '0 0 10px rgba(100,200,255,0.85), 0 0 1px #ffffff',
        },
        blackStyle: {
            color: '#4499dd',
            textShadow: '0 0 10px rgba(50,100,200,0.85), 0 0 1px #88aaff',
        },
    },
];
