import { FrameData, HandednessType, MatchResult } from './types';

type Point3D = { x: number; y: number; z: number };

export interface MotionTemplate {
  gloss: string;
  length: number;
  dimensions: number;
  sequence: Float32Array;
  page?: number;
  source?: string;
}

interface MotionTemplatePayload {
  gloss: string;
  length: number;
  dimensions: number;
  sequence: number[];
  page?: number;
  source?: string;
}

const TARGET_LENGTH = 30;
const TEMPLATE_DIMENSIONS = 3;

let motionTemplateCache: Map<string, MotionTemplate> | null = null;
let motionTemplatePromise: Promise<Map<string, MotionTemplate>> | null = null;

const templateKey = (gloss: string) => String(gloss || '').trim().toUpperCase();

const averagePoint = (a: Point3D, b: Point3D): Point3D => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
  z: (a.z + b.z) / 2,
});

function getPoseAnchor(frame: FrameData): { anchor: Point3D; scale: number } | null {
  const pose = frame.poseLandmarks?.[0];
  if (!pose || pose.length < 25) return null;
  const leftShoulder = pose[11];
  const rightShoulder = pose[12];
  if (!leftShoulder || !rightShoulder) return null;
  const anchor = averagePoint(leftShoulder, rightShoulder);
  const scale = Math.max(0.08, Math.hypot(leftShoulder.x - rightShoulder.x, leftShoulder.y - rightShoulder.y));
  return { anchor, scale };
}

function getHandLabel(frame: FrameData, handIndex: number): HandednessType | 'UNKNOWN' {
  const category = frame.handednesses?.[handIndex]?.[0]?.categoryName;
  if (category === 'Left' || category === 'LEFT') return 'LEFT';
  if (category === 'Right' || category === 'RIGHT') return 'RIGHT';
  return 'UNKNOWN';
}

function pickMotionPoint(frame: FrameData, activeHand: HandednessType | 'BOTH' | 'UNKNOWN'): Point3D | null {
  if (!frame.landmarks.length) return null;

  const pickHand = (handIndex: number): Point3D | null => {
    const wrist = frame.landmarks[handIndex]?.[0];
    if (!wrist) return null;
    const poseAnchor = getPoseAnchor(frame);
    if (!poseAnchor) {
      return { x: wrist.x, y: wrist.y, z: wrist.z };
    }
    return {
      x: (wrist.x - poseAnchor.anchor.x) / poseAnchor.scale,
      y: (wrist.y - poseAnchor.anchor.y) / poseAnchor.scale,
      z: wrist.z - poseAnchor.anchor.z,
    };
  };

  if (activeHand === 'BOTH' && frame.landmarks.length > 1) {
    const first = pickHand(0);
    const second = pickHand(1);
    if (first && second) {
      return averagePoint(first, second);
    }
  }

  if (activeHand === 'LEFT' || activeHand === 'RIGHT') {
    const index = frame.landmarks.findIndex((_, handIndex) => getHandLabel(frame, handIndex) === activeHand);
    if (index >= 0) {
      return pickHand(index);
    }
  }

  return pickHand(0);
}

function normalizePoints(points: Point3D[]): Float32Array {
  if (!points.length) {
    return new Float32Array(TARGET_LENGTH * TEMPLATE_DIMENSIONS);
  }

  const values = points.map((point) => [point.x, point.y, point.z]);
  const means = [0, 0, 0];
  for (const value of values) {
    means[0] += value[0];
    means[1] += value[1];
    means[2] += value[2];
  }
  means[0] /= values.length;
  means[1] /= values.length;
  means[2] /= values.length;

  const normalized = values.map((value) => [value[0] - means[0], value[1] - means[1], value[2] - means[2]]);
  const std = [0, 0, 0];
  for (const value of normalized) {
    std[0] += value[0] * value[0];
    std[1] += value[1] * value[1];
    std[2] += value[2] * value[2];
  }
  std[0] = Math.sqrt(std[0] / normalized.length) + 1e-6;
  std[1] = Math.sqrt(std[1] / normalized.length) + 1e-6;
  std[2] = Math.sqrt(std[2] / normalized.length) + 1e-6;

  const standardized = normalized.map((value) => [value[0] / std[0], value[1] / std[1], value[2] / std[2]]);
  const resampled: number[][] = [];
  for (let i = 0; i < TARGET_LENGTH; i += 1) {
    const sourceIndex = standardized.length === 1
      ? 0
      : Math.floor((i / (TARGET_LENGTH - 1)) * (standardized.length - 1));
    resampled.push([...standardized[Math.max(0, sourceIndex)] ]);
  }

  const smoothed = resampled.map((_, index) => {
    const previous = resampled[Math.max(0, index - 1)];
    const current = resampled[index];
    const next = resampled[Math.min(resampled.length - 1, index + 1)];
    return [
      previous[0] * 0.25 + current[0] * 0.5 + next[0] * 0.25,
      previous[1] * 0.25 + current[1] * 0.5 + next[1] * 0.25,
      previous[2] * 0.25 + current[2] * 0.5 + next[2] * 0.25,
    ];
  });

  return Float32Array.from(smoothed.flat());
}

export async function loadMotionTemplateCache(apiBaseUrl: string): Promise<Map<string, MotionTemplate>> {
  if (motionTemplateCache) {
    return motionTemplateCache;
  }
  if (motionTemplatePromise) {
    return motionTemplatePromise;
  }

  motionTemplatePromise = fetch(`${apiBaseUrl}/api/dictionary/motion-templates`)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Motion template request failed with status ${response.status}`);
      }
      const payload = await response.json();
      const templates = new Map<string, MotionTemplate>();
      const list = Array.isArray(payload?.templates) ? payload.templates as MotionTemplatePayload[] : [];
      for (const item of list) {
        if (!item?.gloss || !Array.isArray(item.sequence)) continue;
        templates.set(templateKey(item.gloss), {
          gloss: item.gloss,
          length: item.length || TARGET_LENGTH,
          dimensions: item.dimensions || TEMPLATE_DIMENSIONS,
          sequence: Float32Array.from(item.sequence),
          page: item.page,
          source: item.source,
        });
      }
      motionTemplateCache = templates;
      return templates;
    })
    .catch((error) => {
      motionTemplatePromise = null;
      throw error;
    });

  return motionTemplatePromise;
}

export function buildMotionTemplateQuery(frames: FrameData[], activeHand: HandednessType | 'BOTH' | 'UNKNOWN'): Float32Array | null {
  const points = frames
    .map((frame) => pickMotionPoint(frame, activeHand))
    .filter(Boolean) as Point3D[];
  if (points.length < 5) {
    return null;
  }
  return normalizePoints(points);
}

export function scoreMotionTemplate(query: Float32Array, template: MotionTemplate): number {
  const length = Math.min(query.length, template.sequence.length);
  if (length <= 0) return 0;

  let totalDistance = 0;
  let samples = 0;
  for (let index = 0; index < length; index += TEMPLATE_DIMENSIONS) {
    const dx = query[index] - template.sequence[index];
    const dy = query[index + 1] - template.sequence[index + 1];
    const dz = query[index + 2] - template.sequence[index + 2];
    totalDistance += Math.hypot(dx, dy, dz);
    samples += 1;
  }

  const averageDistance = totalDistance / Math.max(1, samples);
  return Math.max(0, Math.min(1, 1 / (1 + averageDistance)));
}

export function refineMatchWithMotionTemplate(
  match: MatchResult | null,
  frames: FrameData[],
  activeHand: HandednessType | 'BOTH' | 'UNKNOWN',
  templates: Map<string, MotionTemplate> | null,
): MatchResult | null {
  if (!match || !templates) return match;
  const template = templates.get(templateKey(match.gloss));
  if (!template) return match;

  const query = buildMotionTemplateQuery(frames, activeHand);
  if (!query) return match;

  const templateScore = scoreMotionTemplate(query, template);
  const disagreementPenalty = Math.max(0, 0.35 - templateScore) * 0.12;
  const adjustedConfidence = Math.max(0, Math.min(1, match.confidence * 0.78 + templateScore * 0.22 - disagreementPenalty));

  return {
    ...match,
    confidence: adjustedConfidence,
    breakdown: {
      ...match.breakdown,
      motion: Math.min(1, match.breakdown.motion + templateScore * 0.05),
    },
  };
}