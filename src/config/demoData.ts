export interface DemoScenario {
  id: string;
  label: string;
  input: string;
  output: string;
  confidence: number;
  inputQuality: number;
  dictionaryMatch: number;
}

export const SIGN_TO_SPEECH_DEMO: DemoScenario[] = [
  {
    id: 's2s-1',
    label: 'Hello Gesture',
    input: 'Hand waving gesture detected',
    output: 'Hello',
    confidence: 0.94,
    inputQuality: 0.88,
    dictionaryMatch: 0.98,
  },
  {
    id: 's2s-2',
    label: 'Thank You Gesture',
    input: 'Hand to chin movement detected',
    output: 'Thank you',
    confidence: 0.91,
    inputQuality: 0.85,
    dictionaryMatch: 0.95,
  },
  {
    id: 's2s-3',
    label: 'Good Morning Gesture',
    input: 'Compound movement detected',
    output: 'Good morning',
    confidence: 0.89,
    inputQuality: 0.82,
    dictionaryMatch: 0.92,
  }
];

export const SPEECH_TO_SIGN_DEMO: DemoScenario[] = [
  {
    id: 'st2s-1',
    label: 'Greeting',
    input: 'Hello, how are you today?',
    output: 'HELLO HOW YOU TODAY',
    confidence: 0.96,
    inputQuality: 0.92,
    dictionaryMatch: 1.0,
  },
  {
    id: 'st2s-2',
    label: 'Gratitude',
    input: 'Thank you for your help',
    output: 'THANK YOU HELP',
    confidence: 0.93,
    inputQuality: 0.89,
    dictionaryMatch: 0.97,
  }
];

export const TEXT_TO_SIGN_DEMO: DemoScenario[] = [
  {
    id: 't2s-1',
    label: 'Basic Word',
    input: 'Teacher',
    output: 'TEACHER',
    confidence: 1.0,
    inputQuality: 1.0,
    dictionaryMatch: 1.0,
  },
  {
    id: 't2s-2',
    label: 'Location',
    input: 'Ghana',
    output: 'GHANA',
    confidence: 1.0,
    inputQuality: 1.0,
    dictionaryMatch: 1.0,
  }
];
