import { MatchResult } from './types';
import { SUPPORTED_SIGNS } from './signProfiles';

interface StabilizerState {
  history: MatchResult[];
  lastSpokenTime: number;
  lastSpokenGloss: string | null;
  competingCandidates: Map<string, number>;
  activeHoldStart: number;
}

export class RecognitionStabilizer {
  private state: StabilizerState = {
    history: [],
    lastSpokenTime: 0,
    lastSpokenGloss: null,
    competingCandidates: new Map(),
    activeHoldStart: 0,
  };

  private readonly HISTORY_LIMIT = 20; // extended for better temporal smoothing
  private readonly COMPETITION_THRESHOLD = 0.05; // closeness ratio for competition
  private readonly COOLDOWN_MS = 2500; // 2.5 seconds cooldown
  private readonly CONSISTENCY_SCORE_THRESHOLD = 0.65; // base score needed to be considered
  
  public processMatch(match: MatchResult | null): { 
    confirmedMatch: MatchResult | null;
    shouldSpeak: boolean;
  } {
    const now = Date.now();

    if (match) {
      this.state.history.push(match);
    } else {
      this.state.history.push({ gloss: 'UNKNOWN', confidence: 0, breakdown: { handshape: 0, location: 0, motion: 0, handedness: 0, multiHand: 0 } });
    }

    if (this.state.history.length > this.HISTORY_LIMIT) {
      this.state.history.shift();
    }

    if (this.state.history.length < 5) {
      return { confirmedMatch: null, shouldSpeak: false };
    }

    // 1. Calculate confidence-weighted tallies
    const tallies = new Map<string, number>();
    let totalWeight = 0;

    // Give more weight to recent frames
    this.state.history.forEach((historic, index) => {
      if (historic.gloss === 'UNKNOWN') return;
      if (historic.confidence < this.CONSISTENCY_SCORE_THRESHOLD) return;

      const weight = 1 + (index / this.HISTORY_LIMIT); // linearly increasing weight (1x to 2x)
      const currentScore = tallies.get(historic.gloss) || 0;
      tallies.set(historic.gloss, currentScore + (historic.confidence * weight));
      totalWeight += weight;
    });

    if (tallies.size === 0) {
      return { confirmedMatch: null, shouldSpeak: false };
    }

    // 2. Candidate Competition
    // Find top two candidates
    const sortedCandidates = Array.from(tallies.entries()).sort((a, b) => b[1] - a[1]);
    const topCandidate = sortedCandidates[0];
    const secondCandidate = sortedCandidates.length > 1 ? sortedCandidates[1] : null;

    const normalizedTopScore = topCandidate[1] / totalWeight;

    // Check if we have strong competition
    if (secondCandidate && (topCandidate[1] - secondCandidate[1]) / topCandidate[1] < this.COMPETITION_THRESHOLD) {
      // Oscillation detected! Too close to call. Wait it out.
      return { confirmedMatch: null, shouldSpeak: false };
    }

    // 3. Temporal Stability Checks
    const signProfile = SUPPORTED_SIGNS.find(s => s.gloss === topCandidate[0]);
    const requiredFrames = signProfile?.stabilityFrames || 6;
    
    // Check if the top candidate has been seen enough times recently
    const recentCount = this.state.history.slice(-10).filter(h => h.gloss === topCandidate[0]).length;
    
    if (recentCount < requiredFrames || normalizedTopScore < this.CONSISTENCY_SCORE_THRESHOLD) {
      return { confirmedMatch: null, shouldSpeak: false };
    }

    // --- We have a stable, dominant match ---
    const confirmedMatch = { 
      gloss: topCandidate[0], 
      confidence: normalizedTopScore,
      breakdown: this.state.history.find(h => h.gloss === topCandidate[0])?.breakdown || { handshape: 0, location: 0, motion: 0, handedness: 0, multiHand: 0 }
    };

    const isCooldownOver = (now - this.state.lastSpokenTime) > this.COOLDOWN_MS;
    const isNewSign = topCandidate[0] !== this.state.lastSpokenGloss;

    const shouldSpeak = isCooldownOver || isNewSign;

    if (shouldSpeak) {
      this.state.lastSpokenTime = now;
      this.state.lastSpokenGloss = topCandidate[0];
      // clear some history, but preserve recent frames to avoid full restart
      this.state.history = this.state.history.slice(-5); 
    }

    return { confirmedMatch, shouldSpeak };
  }
}
