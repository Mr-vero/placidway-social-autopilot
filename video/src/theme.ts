import { loadFont as loadFraunces } from '@remotion/google-fonts/Fraunces';
import { loadFont as loadInter } from '@remotion/google-fonts/Inter';
import { loadFont as loadMono } from '@remotion/google-fonts/JetBrainsMono';

export const serif = loadFraunces('normal', { weights: ['400', '500', '600'], subsets: ['latin'] }).fontFamily;
export const sans = loadInter('normal', { weights: ['400', '500', '600', '700'], subsets: ['latin'] }).fontFamily;
export const mono = loadMono('normal', { weights: ['400', '500'], subsets: ['latin'] }).fontFamily;

// PlacidWay palette (from placidway.com) on a warm cinematic dark.
export const C = {
  bg: '#141210',
  bg2: '#1C1916',
  panel: '#221E1A',
  line: 'rgba(255,240,225,0.10)',
  ink: '#F6F1EA',
  ink2: '#CFC6BB',
  ink3: '#8F857B',
  coral: '#E85A4F',
  coral2: '#F5867B',
  red: '#A9362D',
  peach: '#F2C79C',
  cream: '#F3F0EB',
  green: '#5CC092',
  amber: '#E3A94A',
  blue: '#7FA6E6',
};

export const FPS = 30;
export const W = 1920;
export const H = 1080;
