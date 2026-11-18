/**
 * Appearance is two independent choices:
 *  - a type style (TYPES): the fonts, and how names are set (case, spacing, size)
 *  - a colour family (LOOKS): four skies each (night, dawn, day, dusk), so the background
 *    still follows the time of day.
 * All fonts are open-source (SIL Open Font License) and bundled, so nothing loads from the network.
 */
import { Caveat_600SemiBold } from '@expo-google-fonts/caveat/600SemiBold';
import { Figtree_400Regular } from '@expo-google-fonts/figtree/400Regular';
import { Fraunces_400Regular } from '@expo-google-fonts/fraunces/400Regular';
import { Fraunces_400Regular_Italic } from '@expo-google-fonts/fraunces/400Regular_Italic';
import { IBMPlexMono_400Regular } from '@expo-google-fonts/ibm-plex-mono/400Regular';
import { IBMPlexMono_400Regular_Italic } from '@expo-google-fonts/ibm-plex-mono/400Regular_Italic';
import { IBMPlexSans_400Regular } from '@expo-google-fonts/ibm-plex-sans/400Regular';
import { Nunito_400Regular } from '@expo-google-fonts/nunito/400Regular';
import { Nunito_400Regular_Italic } from '@expo-google-fonts/nunito/400Regular_Italic';
import { SpecialElite_400Regular } from '@expo-google-fonts/special-elite/400Regular';

export const FONTS = {
  Caveat_600SemiBold,
  Figtree_400Regular,
  Fraunces_400Regular,
  Fraunces_400Regular_Italic,
  IBMPlexMono_400Regular,
  IBMPlexMono_400Regular_Italic,
  IBMPlexSans_400Regular,
  Nunito_400Regular,
  Nunito_400Regular_Italic,
  SpecialElite_400Regular,
};

type FontName = keyof typeof FONTS;
export type Stops = readonly [string, string, string];
export type Phase = 'night' | 'dawn' | 'day' | 'dusk';

interface Look {
  id: string;
  name: string;
  blurb: string;
  /** Text colour as "r,g,b". */
  ink: string;
  /** Dark colour used on top of filled (light) controls. */
  onFill: string;
  sky: Record<Phase, { stops: Stops; glow: string }>;
}

export const LOOKS: Look[] = [
  {
    id: 'first-light',
    name: 'First Light',
    blurb: 'Indigo into coral.',
    ink: '244,239,233', onFill: '#1a1838',
    sky: {
      night: { stops: ['#080b1c', '#11163a', '#1d1b3f'], glow: '150,160,255' },
      dawn: { stops: ['#141a3c', '#4a3a66', '#c9785e'], glow: '255,190,140' },
      day: { stops: ['#14233f', '#27456a', '#557790'], glow: '200,225,255' },
      dusk: { stops: ['#1a1838', '#4b2f5c', '#a5564f'], glow: '255,160,130' },
    },
  },
  {
    id: 'mist',
    name: 'Mist',
    blurb: 'Grey-blue fog and sage.',
    ink: '236,241,240', onFill: '#1b232b',
    sky: {
      night: { stops: ['#0c1014', '#161d24', '#222c33'], glow: '170,190,200' },
      dawn: { stops: ['#1b232b', '#42525c', '#9fa9a3'], glow: '230,235,220' },
      day: { stops: ['#1d2a33', '#3d5560', '#7c9296'], glow: '220,235,235' },
      dusk: { stops: ['#161c24', '#3a4350', '#8a8590'], glow: '225,205,215' },
    },
  },
  {
    id: 'woodland',
    name: 'Woodland',
    blurb: 'Forest green, moss and amber.',
    ink: '243,238,222', onFill: '#0f2019',
    sky: {
      night: { stops: ['#07100c', '#0e1f18', '#182b20'], glow: '140,190,150' },
      dawn: { stops: ['#0f2019', '#2d4a35', '#b98a4a'], glow: '255,205,130' },
      day: { stops: ['#102a20', '#2a5540', '#6c8f5c'], glow: '220,240,180' },
      dusk: { stops: ['#141d14', '#3c3a26', '#9a5f38'], glow: '255,170,110' },
    },
  },
  {
    id: 'field-guide',
    name: 'Field Guide',
    blurb: 'Ink navy, teal and ochre.',
    ink: '247,236,214', onFill: '#0b1c2c',
    sky: {
      night: { stops: ['#06101a', '#0b2230', '#123440'], glow: '120,190,200' },
      dawn: { stops: ['#0b1c2c', '#1f5560', '#d9a25a'], glow: '255,210,140' },
      day: { stops: ['#0c2536', '#1c6070', '#5fa39c'], glow: '200,240,230' },
      dusk: { stops: ['#0d1826', '#2a4458', '#c07a48'], glow: '255,180,120' },
    },
  },
  {
    id: 'night-heron',
    name: 'Night Heron',
    blurb: 'Near-black, slate and violet. The darkest.',
    ink: '226,234,248', onFill: '#0b0e16',
    sky: {
      night: { stops: ['#050608', '#0b0e16', '#141a28'], glow: '130,150,220' },
      dawn: { stops: ['#0a0c14', '#252a44', '#6f6a9a'], glow: '190,180,255' },
      day: { stops: ['#0c1018', '#222e44', '#4f6480'], glow: '180,205,245' },
      dusk: { stops: ['#0a0a12', '#2a2238', '#6b4a6a'], glow: '220,170,220' },
    },
  },
];

export interface TypeStyle {
  id: string;
  name: string;
  blurb: string;
  fontNames: string;
  /** Font for bird names, titles and the alarm time. */
  display: FontName;
  /** Font for scientific names. */
  italic: FontName;
  /** Font for everything else. */
  body: FontName;
  /** Font for small capital labels and tabs. Defaults to the body font. */
  label?: FontName;
  /** Size multiplier for the display font: faces run small or large at the same point size. */
  displayScale: number;
  upper?: boolean;
  tracking?: number;
}

export const TYPES: TypeStyle[] = [
  {
    id: 'storybook', name: 'Storybook', blurb: 'Soft, old-fashioned serif. Warm and literary.',
    fontNames: 'Fraunces + Figtree',
    display: 'Fraunces_400Regular', italic: 'Fraunces_400Regular_Italic', body: 'Figtree_400Regular',
    displayScale: 0.95,
  },
  {
    id: 'field-notes', name: 'Field notes', blurb: 'Typewritten names, ruled-notebook labels, plain reading text.',
    fontNames: 'Special Elite + IBM Plex Mono + IBM Plex Sans',
    display: 'SpecialElite_400Regular', italic: 'IBMPlexMono_400Regular_Italic', body: 'IBMPlexSans_400Regular',
    label: 'IBMPlexMono_400Regular',
    displayScale: 0.9,
  },
  {
    id: 'sketchbook', name: 'Sketchbook', blurb: 'Handwritten names, like a birding journal.',
    fontNames: 'Caveat + Nunito',
    display: 'Caveat_600SemiBold', italic: 'Nunito_400Regular_Italic', body: 'Nunito_400Regular',
    displayScale: 1.22,
  },
];

export const DEFAULT_TYPE = 'storybook';

export const DEFAULT_LOOK = 'first-light';

export function phaseFor(hour: number): Phase {
  if (hour >= 5 && hour < 9) return 'dawn';
  if (hour >= 9 && hour < 17) return 'day';
  if (hour >= 17 && hour < 21) return 'dusk';
  return 'night';
}

export interface Theme {
  look: Look;
  type: TypeStyle;
  /** Display font (bird names, titles, the alarm time). */
  SERIF: string;
  ITALIC: string;
  SANS: string;
  /** Font for small labels and tabs. */
  LABEL: string;
  /** Scales a display font size for this typeface. */
  ds: (size: number) => number;
  /** Font, size, case and letter-spacing for display text. */
  display: (size: number) => { fontFamily: string; fontSize: number; textTransform?: 'uppercase'; letterSpacing?: number };
  C: { text: string; dim: string; faint: string; line: string; fill: string; fillOn: string; onFill: string };
}

export function themeFor(lookId: string | undefined, typeId: string | undefined): Theme {
  const look = LOOKS.find((l) => l.id === lookId) ?? LOOKS[0]!;
  const type = TYPES.find((t) => t.id === typeId) ?? TYPES[0]!;
  const a = (alpha: number) => `rgba(${look.ink},${alpha})`;
  const ds = (size: number) => Math.round(size * type.displayScale);
  return {
    look,
    type,
    SERIF: type.display,
    ITALIC: type.italic,
    SANS: type.body,
    LABEL: type.label ?? type.body,
    ds,
    display: (size) => ({
      fontFamily: type.display,
      fontSize: ds(size),
      ...(type.upper ? { textTransform: 'uppercase' as const } : {}),
      ...(type.tracking ? { letterSpacing: (type.tracking * ds(size)) / 40 } : {}),
    }),
    C: { text: a(1), dim: a(0.62), faint: a(0.38), line: a(0.14), fill: a(0.08), fillOn: a(0.9), onFill: look.onFill },
  };
}
