import { ExtractedFeatures, MatchResult } from './types';
import { SUPPORTED_SIGNS } from './signProfiles';

export function matchSign(features: ExtractedFeatures): MatchResult | null {
  let bestMatch: MatchResult | null = null;
  let highestScore = 0;

  for (const profile of SUPPORTED_SIGNS) {
    const { primaryHand } = features;
    
    // 1. Handshape Score (35%)
    let handshapeScore = 0;
    if (profile.handshape.includes(primaryHand.handShape)) {
      handshapeScore = 1.0;
    } else if (primaryHand.handShape !== 'UNKNOWN') {
      // Partial credit for similar shapes could go here, for now 0
      handshapeScore = 0;
    }

    // 2. Location Score (25%)
    let locationScore = 0;
    const allowedLocs = Array.isArray(profile.location) ? profile.location : [profile.location];
    if (allowedLocs.includes(primaryHand.relativeLocation)) {
      locationScore = 1.0;
    } 

    // 3. Motion Score (25%)
    // - Direction matching
    let motionScore = 0;
    const expectedDirs = Array.isArray(profile.motion.primaryDirection) 
      ? profile.motion.primaryDirection 
      : [profile.motion.primaryDirection];
      
    if (expectedDirs.includes(primaryHand.motion.primaryDirection)) {
      motionScore += 0.6; // Core direction
    }

    // - Repetition matching
    if (profile.motion.repetition !== undefined) {
      if (primaryHand.motion.repetition >= profile.motion.repetition) {
        motionScore += 0.4; // Met repetition quota
      }
    } else {
      motionScore += 0.4; // Profile doesn't care
    }

    // 4. Multi-hand Score (10%)
    let multiHandScore = 0;
    if (profile.requiresTwoHands) {
      if (features.multiHand.leftHandPresent && features.multiHand.rightHandPresent) {
        multiHandScore = 1.0;
      }
    } else {
      if (!features.multiHand.leftHandPresent || !features.multiHand.rightHandPresent) {
        multiHandScore = 1.0; // Perfect, only one hand
      } else {
        multiHandScore = 0.8; // Acceptable if both are visible but one is doing the work
      }
    }

    // 5. Handedness Score (5%)
    let handednessScore = 1.0; // Default to 1 unless it violates a strict handedness request
    if (profile.handedness && profile.handedness !== 'RIGHT_OR_LEFT') {
      if (features.multiHand.activeHand !== profile.handedness) {
        handednessScore = 0.0;
      }
    }

    // 6. Facial Score (5%)
    let facialScore = 1.0; // Assume 1.0 until full facial feature extraction is available

    const confidence = 
      (handshapeScore * 0.35) + 
      (motionScore * 0.25) + 
      (locationScore * 0.20) + 
      (multiHandScore * 0.10) + 
      (handednessScore * 0.05) +
      (facialScore * 0.05);

    let status: 'reject' | 'tentative' | 'accept' = 'reject';
    if (confidence > 0.70) status = 'accept';
    else if (confidence >= 0.50) status = 'tentative';

    if (confidence > highestScore) {
      highestScore = confidence;
      bestMatch = { 
        gloss: profile.gloss, 
        confidence, 
        breakdown: {
          handshape: handshapeScore * 0.35,
          location: locationScore * 0.20,
          motion: motionScore * 0.25,
          multiHand: multiHandScore * 0.10,
          handedness: handednessScore * 0.05,
          facial: facialScore * 0.05
        },
        status
      };
    }
  }

  // Debug export via window object
  // @ts-ignore
  window.__LAST_EXTRACTED_FEATURES = features;
  // @ts-ignore
  window.__LAST_MATCH = bestMatch;

  return highestScore >= 0.5 ? bestMatch : null;
}
