import { SignProfile } from './types'

export const SUPPORTED_SIGNS: SignProfile[] = [
  {
    gloss: 'HELLO',
    expectedFeatures: {
      handShape: ['FLAT', 'OPEN'],
      motionDirection: ['LEFT', 'RIGHT', 'FORWARD', 'STATIC'],
      relativeLocation: ['HIGH'],
      motionRepetition: 'SINGLE'
    }
  },
  {
    gloss: 'THANK YOU',
    expectedFeatures: {
      handShape: ['FLAT', 'OPEN'],
      motionDirection: ['FORWARD', 'DOWN'],
      relativeLocation: ['HIGH', 'MID'],
      motionRepetition: 'SINGLE'
    }
  },
  {
    gloss: 'FOOD',
    expectedFeatures: {
      handShape: 'PINCH',
      motionDirection: ['UP', 'STATIC'],
      relativeLocation: 'HIGH',
    }
  },
  {
    gloss: 'YES',
    expectedFeatures: {
      handShape: 'FIST',
      motionDirection: ['DOWN'],
      motionRepetition: 'REPEATED',
    }
  },
  {
    gloss: 'NO',
    expectedFeatures: {
      handShape: ['PINCH', 'FLAT'],
      motionDirection: ['STATIC'],
      motionRepetition: 'REPEATED',
    }
  }
];
