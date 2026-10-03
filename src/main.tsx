import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './ui/App';
import * as E from './engine/game';
import * as S2 from './stage2/stage2';
import './fonts.css';
import './styles.css';
import { initAnalytics } from './analytics';

// Outils de test : le moteur est accessible dans la console avec #dev dans l'adresse
if (location.hash.includes('dev')) { (window as any).__E = E; (window as any).__S2 = S2; }

createRoot(document.getElementById('root')!).render(<App />);
initAnalytics();
