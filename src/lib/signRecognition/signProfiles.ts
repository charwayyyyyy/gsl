import { SignProfile } from './types'

export const SUPPORTED_SIGNS: SignProfile[] = [
  {
    id: "hello",
    gloss: 'HELLO',
    handshape: ['FLAT', 'OPEN'],
    handedness: 'RIGHT_OR_LEFT',
    location: ['HIGH', 'FACE'],
    locationTolerance: 0.2,
    motion: {
      primaryDirection: ['FORWARD', 'RIGHT', 'LEFT', 'STATIC'],
      repetition: 0
    },
    requiresTwoHands: false,
    stabilityFrames: 8
  },
  {
    id: "thank_you",
    gloss: 'THANK YOU',
    handshape: ['FLAT', 'OPEN'],
    location: ['HIGH', 'MID', 'FACE', 'CHEST'],
    motion: {
      primaryDirection: ['FORWARD', 'DOWN'],
      repetition: 0
    },
    requiresTwoHands: false,
    stabilityFrames: 6
  },
  {
    id: "food",
    gloss: 'FOOD',
    handshape: ['PINCH'],
    location: ['HIGH', 'FACE'],
    motion: {
      primaryDirection: ['UP', 'STATIC'],
      repetition: 0
    },
    requiresTwoHands: false,
  },
  {
    id: "yes",
    gloss: 'YES',
    handshape: ['FIST'],
    location: ['MID', 'HIGH'],
    motion: {
      primaryDirection: ['DOWN'],
      repetition: 1
    },
    requiresTwoHands: false,
  },
  {
    id: "no",
    gloss: 'NO',
    handshape: ['PINCH', 'FLAT', 'POINT'],
    location: ['MID', 'HIGH'],
    motion: {
      primaryDirection: ['STATIC', 'RIGHT', 'LEFT'],
      repetition: 1
    },
    requiresTwoHands: false,
  }
];
