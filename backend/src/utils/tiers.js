export const TIER_NAMES_ALL = [
  'beginner',
  'intermediate',
  'professional',
  'pro',
  'grandmaster',
  'gm',
];

export const TIER_DEFAULT_RATINGS = {
  beginner: 800,
  intermediate: 1200,
  pro: 1600,
  gm: 2000,
};

export const TIER_BASE_REWARD = {
  beginner: 0.001,
  intermediate: 0.003,
  pro: 0.008,
  gm: 0.020,
};

export const TIER_RATING_BANDS = {
  beginner: { min: 600, max: 999 },
  intermediate: { min: 1000, max: 1499 },
  pro: { min: 1500, max: 1999 },
  gm: { min: 2000, max: 3000 },
};

export const normalizeTier = (tier) => {
  if (!tier) return null;
  const normalized = tier.toLowerCase();
  const tierMap = {
    beginner: 'beginner',
    intermediate: 'intermediate',
    professional: 'pro',
    pro: 'pro',
    grandmaster: 'gm',
    gm: 'gm',
  };
  return tierMap[normalized] || null;
};

export const isValidTier = (tier) => {
  if (!tier) return false;
  const normalized = normalizeTier(tier);
  return ['beginner', 'intermediate', 'pro', 'gm'].includes(normalized);
};

export const tierToStakeSol = (tier) => {
  const stakes = {
    beginner: 0.05,
    intermediate: 0.10,
    pro: 0.25,
    gm: 0.50,
  };
  return stakes[tier] ?? 0.05;
};
