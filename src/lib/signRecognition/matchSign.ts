import { ExtractedFeatures, MatchResult } from './types';
import { SUPPORTED_SIGNS } from './signProfiles';

export function matchSign(features: ExtractedFeatures): MatchResult | null {
  let bestMatch: MatchResult | null = null;
  let highestScore = 0;

  for (const sign of SUPPORTED_SIGNS) {
    let score = 0;
    let totalCriteria = 0;

    const { expectedFeatures } = sign;

    // Hand Shape Check (High weighting)
    totalCriteria += 2;
    const expectedShapes = Array.isArray(expectedFeatures.handShape) 
      ? expectedFeatures.handShape 
      : [expectedFeatures.handShape];
      
    if (expectedShapes.includes(features.handShape)) {
      score += 2;
    }

    // Motion Direction
    if (expectedFeatures.motionDirection) {
      totalCriteria += 1.5;
      const expectedDirs = Array.isArray(expectedFeatures.motionDirection)
        ? expectedFeatures.motionDirection
        : [expectedFeatures.motionDirection];
      if (expectedDirs.includes(features.motionDirection)) {
        score += 1.5;
      }
    }

    // Relative Location
    if (expectedFeatures.relativeLocation) {
      totalCriteria += 1;
      const expectedLocs = Array.isArray(expectedFeatures.relativeLocation)
        ? expectedFeatures.relativeLocation
        : [expectedFeatures.relativeLocation];
      if (expectedLocs.includes(features.relativeLocation)) {
        score += 1;
      }
    }

    const confidence = score / totalCriteria;

    if (confidence > highestScore) {
      highestScore = confidence;
      bestMatch = { gloss: sign.gloss, confidence };
    }
  }

  return highestScore > 0.6 ? bestMatch : null;
}
