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
      primaryDirection: ['FORWARD', 'RIGHT', 'LEFT'],
      repetition: 0
    },
    requiresTwoHands: false,
    stabilityFrames: 4
  },
  {
    id: "thank_you",
    gloss: 'THANK YOU',
    handshape: ['FLAT', 'OPEN'],
    location: ['FACE', 'HIGH'],
    motion: {
      primaryDirection: ['FORWARD', 'DOWN'],
      repetition: 0
    },
    requiresTwoHands: false,
    stabilityFrames: 4
  },
  {
    id: "food",
    gloss: 'FOOD',
    handshape: ['PINCH', 'CURVED'],
    location: ['FACE', 'HIGH'],
    motion: {
      primaryDirection: ['UP', 'FORWARD'],
      repetition: 1
    },
    requiresTwoHands: false,
    stabilityFrames: 3,
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
    stabilityFrames: 3,
  },
  {
    id: "no",
    gloss: 'NO',
    handshape: ['POINT'],
    location: ['MID', 'HIGH'],
    motion: {
      primaryDirection: ['RIGHT', 'LEFT'],
      repetition: 1
    },
    requiresTwoHands: false,
    stabilityFrames: 4,
  }
];
