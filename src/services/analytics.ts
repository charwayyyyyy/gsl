
const API_BASE = 'http://localhost:8000/api';

export interface AnalyticsEvent {
  event_type: 'search' | 'voice_search' | 'unknown_search' | 'feedback' | 'error';
  data: Record<string, any>;
  session_id?: string;
}

export interface FeedbackData {
  gloss: string;
  reason?: string;
}

class AnalyticsService {
  private sessionId: string;

  constructor() {
    this.sessionId = this.getSessionId();
  }

  private getSessionId(): string {
    let sid = localStorage.getItem('gsl_session_id');
    if (!sid) {
      // Fallback for environments where crypto.randomUUID() might not be available
      if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        sid = crypto.randomUUID();
      } else {
        sid = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
      }
      localStorage.setItem('gsl_session_id', sid);
    }
    return sid;
  }

  async track(event: AnalyticsEvent) {
    try {
      await fetch(`${API_BASE}/analytics/track`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...event,
          session_id: this.sessionId,
        }),
      });
    } catch (e) {
      console.error('Analytics track failed', e);
    }
  }

  async reportFeedback(feedback: FeedbackData) {
    try {
      await fetch(`${API_BASE}/feedback/report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedback),
      });
      
      // Also track as an analytics event
      this.track({
        event_type: 'feedback',
        data: feedback
      });
    } catch (e) {
      console.error('Feedback report failed', e);
    }
  }
}

export const analytics = new AnalyticsService();
