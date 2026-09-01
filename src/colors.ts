import type { Project, Tag } from '@super-productivity/plugin-api';

const FALLBACK_COLORS = [
  'var(--bp-tag-green)',
  'var(--bp-tag-purple)',
  'var(--bp-tag-cyan)',
  'var(--bp-tag-amber)',
];

const hashString = (input: string): number => {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash << 5) - hash + input.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash);
};

export const fallbackColorFor = (seed: string): string =>
  FALLBACK_COLORS[hashString(seed) % FALLBACK_COLORS.length];

export const resolveProjectColor = (project: Project | undefined): string => {
  if (!project) return FALLBACK_COLORS[0];
  return project.theme?.primary || fallbackColorFor(project.id);
};

export const resolveTagColor = (tag: Tag): string => tag.color || fallbackColorFor(tag.id);
