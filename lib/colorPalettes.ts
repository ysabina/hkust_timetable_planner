export interface SchedulePalette {
  id: string;
  name: string;
  description: string;
  colors: string[];
}

export const DEFAULT_PALETTE_ID = 'rosewood';

export const SCHEDULE_PALETTES: SchedulePalette[] = [
  {
    id: 'rosewood',
    name: 'Rosewood',
    description: 'The signature warm palette',
    colors: ['#F75590', '#B75D69', '#FBD87F', '#B5F8FE', '#10CFA8', '#C4A5E1', '#F08A8A', '#8093C1'],
  },
  {
    id: 'orchid',
    name: 'Orchid Night',
    description: 'Plum, violet and cool blue',
    colors: ['#A855F7', '#EC4899', '#6366F1', '#3B82F6', '#14B8A6', '#D97706', '#8B5CF6', '#64748B'],
  },
  {
    id: 'harbour',
    name: 'Harbour',
    description: 'Calm teal and ocean tones',
    colors: ['#0F9B8E', '#2563EB', '#0891B2', '#4F46E5', '#65A30D', '#CA8A04', '#DB2777', '#64748B'],
  },
  {
    id: 'petal',
    name: 'Soft Petal',
    description: 'Light, gentle classroom colors',
    colors: ['#FCE4D8', '#FBD87F', '#B5F8FE', '#E7B8FF', '#FFD4D4', '#A7E8D5', '#C4A5E1', '#FFB5C5'],
  },
];

const LEGACY_COLORS: Record<string, string> = {
  'bg-blue-600': '#2563EB',
  'bg-teal-600': '#0D9488',
  'bg-orange-600': '#EA580C',
};

export function getSchedulePalette(id: string): SchedulePalette {
  return SCHEDULE_PALETTES.find(palette => palette.id === id) || SCHEDULE_PALETTES[0];
}

export function normalizeScheduleColor(color: string | null | undefined): string {
  if (!color) return SCHEDULE_PALETTES[0].colors[0];
  if (/^#[0-9A-F]{6}$/i.test(color)) return color.toUpperCase();
  const arbitraryHex = color.match(/^bg-\[(#[0-9A-F]{6})\]$/i);
  if (arbitraryHex) return arbitraryHex[1].toUpperCase();
  return LEGACY_COLORS[color] || SCHEDULE_PALETTES[0].colors[0];
}

export function getReadableTextColor(backgroundColor: string): '#171220' | '#FFFFFF' {
  const hex = normalizeScheduleColor(backgroundColor).slice(1);
  const [red, green, blue] = [0, 2, 4].map(offset => parseInt(hex.slice(offset, offset + 2), 16));
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  return luminance > 0.62 ? '#171220' : '#FFFFFF';
}
