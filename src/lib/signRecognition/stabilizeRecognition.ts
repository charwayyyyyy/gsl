import { MatchResult } from './types';

interface StabilizerState {
  history: MatchResult[];
  lastSpokenTime: number;
  lastSpokenGloss: string | null;
}

export class RecognitionStabilizer {
  private state: StabilizerState = {
    history: [],
    lastSpokenTime: 0,
    lastSpokenGloss: null
  };

  private readonly HISTORY_LIMIT = 15;
  private readonly CONSISTENCY_THRESHOLD = 0.7; // 70% of recent frames must agree
  private readonly COOLDOWN_MS = 3000; // 3 seconds cooldown between speeches

  public processMatch(match: MatchResult | null): { 
    confirmedMatch: MatchResult | null;
    shouldSpeak: boolean;
  } {
    if (match) {
      this.state.history.push(match);
    } else {
      // Push an unknown frame
      this.state.history.push({ gloss: 'UNKNOWN', confidence: 0 });
    }

    if (this.state.history.length > this.HISTORY_LIMIT) {
      this.state.history.shift(); // Keep buffer rolling
    }

    if (this.state.history.length < 8) {
      // Not enough data to confidently assert a sign
      return { confirmedMatch: null, shouldSpeak: false };
    }

    // Tally recent glosses
    const tallies: Record<string, { count: number, totalConfidence: number }> = {};
    for (const historic of this.state.history) {
      if (!tallies[historic.gloss]) {
        tallies[historic.gloss] = { count: 0, totalConfidence: 0 };
      }
      tallies[historic.gloss].count++;
      tallies[historic.gloss].totalConfidence += historic.confidence;
    }

    // Find majority vote
    let bestGloss = 'UNKNOWN';
    let bestCount = 0;
    for (const [gloss, data] of Object.entries(tallies)) {
      if (gloss !== 'UNKNOWN' && data.count > bestCount) {
        bestCount = data.count;
        bestGloss = gloss;
      }
    }

    const consistencyRatio = bestCount / this.state.history.length;

    if (bestGloss !== 'UNKNOWN' && consistencyRatio >= this.CONSISTENCY_THRESHOLD) {
      const avgConf = tallies[bestGloss].totalConfidence / bestCount;
      const confirmedMatch = { gloss: bestGloss, confidence: avgConf };

      const now = Date.now();
      const isCooldownOver = (now - this.state.lastSpokenTime) > this.COOLDOWN_MS;
      const isNewSign = bestGloss !== this.state.lastSpokenGloss;

      const shouldSpeak = isCooldownOver || isNewSign;

      if (shouldSpeak) {
        this.state.lastSpokenTime = now;
        this.state.lastSpokenGloss = bestGloss;
        // Purge history to prevent double firing immediately
        this.state.history = []; 
      }

      return { confirmedMatch, shouldSpeak };
    }

    return { confirmedMatch: null, shouldSpeak: false };
  }
}
