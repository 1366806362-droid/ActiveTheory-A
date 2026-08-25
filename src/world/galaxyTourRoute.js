export const GALAXY_TOUR_ANCHORS = Object.freeze([
  Object.freeze({
    id: 'HERO_START',
    scene: 'HeroScene',
    target: null,
    scrollHint: 'SCROLL TO EXPLORE'
  }),
  Object.freeze({
    id: 'GEO_ACTIVE',
    scene: 'GeoScene',
    target: 'geo',
    scrollHint: 'SCROLL TO RETURN'
  }),
  Object.freeze({
    id: 'HERO_AFTER_GEO',
    scene: 'HeroScene',
    target: null,
    scrollHint: 'SCROLL TO 5A'
  }),
  Object.freeze({
    id: 'FIVE_A_ACTIVE',
    scene: 'FiveAScene',
    target: 'fiveA',
    scrollHint: 'SCROLL TO RETURN'
  }),
  Object.freeze({
    id: 'HERO_AFTER_FIVE_A',
    scene: 'HeroScene',
    target: null,
    scrollHint: 'SCROLL TO BRAND MIND'
  }),
  Object.freeze({
    id: 'BRAND_MIND_ACTIVE',
    scene: 'BrandMindScene',
    target: 'brandMind',
    scrollHint: 'EXPLORE BRAND MIND'
  })
]);

export const GALAXY_TOUR_SEGMENTS = Object.freeze([
  Object.freeze({
    id: 'GEO_ENTER',
    from: 'HERO_START',
    to: 'GEO_ACTIVE',
    target: 'geo'
  }),
  Object.freeze({
    id: 'GEO_RETURN',
    from: 'GEO_ACTIVE',
    to: 'HERO_AFTER_GEO',
    target: 'geo'
  }),
  Object.freeze({
    id: 'FIVE_A_ENTER',
    from: 'HERO_AFTER_GEO',
    to: 'FIVE_A_ACTIVE',
    target: 'fiveA'
  }),
  Object.freeze({
    id: 'FIVE_A_RETURN',
    from: 'FIVE_A_ACTIVE',
    to: 'HERO_AFTER_FIVE_A',
    target: 'fiveA'
  }),
  Object.freeze({
    id: 'BRAND_MIND_ENTER',
    from: 'HERO_AFTER_FIVE_A',
    to: 'BRAND_MIND_ACTIVE',
    target: 'brandMind'
  })
]);

const GALAXY_DIRECT_ENTRY_TARGETS = Object.freeze(['fiveA', 'brandMind']);
const GALAXY_DIRECT_RETURN_SEGMENTS = Object.freeze({
  brandMind: Object.freeze({
    id: 'BRAND_MIND_RETURN',
    from: 'BRAND_MIND_ACTIVE',
    to: 'HERO_START',
    target: 'brandMind'
  })
});

export function getTourAnchor(index) {
  return GALAXY_TOUR_ANCHORS[index] ?? null;
}

export function getTourSegment(fromIndex, toIndex) {
  const edgeIndex = Math.min(fromIndex, toIndex);

  return GALAXY_TOUR_SEGMENTS[edgeIndex] ?? null;
}

export function getTourRouteDefinition() {
  return {
    anchors: GALAXY_TOUR_ANCHORS.map((anchor, index) => ({ index, ...anchor })),
    segments: GALAXY_TOUR_SEGMENTS.map((segment, index) => ({ index, ...segment }))
  };
}

export function getDirectEntryContract(target) {
  if (!GALAXY_DIRECT_ENTRY_TARGETS.includes(target)) return null;

  const entryIndex = GALAXY_TOUR_SEGMENTS.findIndex((segment) => (
    segment.target === target && segment.id.endsWith('_ENTER')
  ));
  const returnSegment = GALAXY_TOUR_SEGMENTS.find((segment) => (
    segment.target === target && segment.id.endsWith('_RETURN')
  )) ?? GALAXY_DIRECT_RETURN_SEGMENTS[target];

  if (entryIndex < 0 || !returnSegment) return null;

  return Object.freeze({
    target,
    activeIndex: entryIndex + 1,
    entrySegment: GALAXY_TOUR_SEGMENTS[entryIndex],
    returnSegment
  });
}
