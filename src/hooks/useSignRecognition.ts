import { useState, useEffect, useRef, useCallback } from 'react';
import { FilesetResolver, HandLandmarker, PoseLandmarker } from '@mediapipe/tasks-vision';
import { API_BASE_URL } from '@/config';
import { extractFeatures, loadMotionTemplateCache, matchSign, MotionTemplate, RecognitionStabilizer, refineMatchWithMotionTemplate, setSupportedSigns } from '../lib/signRecognition';
import { FrameData, MatchResult, ExtractedFeatures } from '../lib/signRecognition/types';

interface UseSignRecognitionReturn {
  isReady: boolean;
  isDetecting: boolean;
  predictedGloss: string | null;
  confidence: number;
  lastSpoken: string | null;
  debugInfo: {
    features: ExtractedFeatures | null;
    rawMatch: MatchResult | null;
  } | null;
  processVideoFrame: (videoElement: HTMLVideoElement, timestamp: number) => void;
}

export function useSignRecognition(): UseSignRecognitionReturn {
  const [isReady, setIsReady] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [predictedGloss, setPredictedGloss] = useState<string | null>(null);
  const [confidence, setConfidence] = useState(0);
  const [lastSpoken, setLastSpoken] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<{ features: ExtractedFeatures | null; rawMatch: MatchResult | null } | null>(null);

  const landmarkerRef = useRef<HandLandmarker | null>(null);
  const poseLandmarkerRef = useRef<PoseLandmarker | null>(null);
  const motionTemplatesRef = useRef<Map<string, MotionTemplate> | null>(null);
  const frameBufferRef = useRef<FrameData[]>([]);
  const stabilizerRef = useRef(new RecognitionStabilizer());
  const lastVideoTimeRef = useRef<number>(-1);
  const lastProcessedTimestampRef = useRef<number>(0);

  // throttle state updates to reduce React renders
  const lastDebugUpdateRef = useRef<number>(0);

  useEffect(() => {
    let active = true;

    async function initializeVision() {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        if (!active) return;
        const handLandmarker = await HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task",
            delegate: "GPU"
          },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5
        });

        let poseLandmarker: PoseLandmarker | null = null;
        try {
          poseLandmarker = await PoseLandmarker.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath: "https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task",
              delegate: "GPU"
            },
            runningMode: "VIDEO",
            numPoses: 1,
            minPoseDetectionConfidence: 0.5,
            minPosePresenceConfidence: 0.5,
            minTrackingConfidence: 0.5
          });
        } catch (poseError) {
          console.warn('Pose Landmarker unavailable; continuing with hand-only landmarks.', poseError);
        }

        try {
          const response = await fetch(`${API_BASE_URL}/api/dictionary/recognition-profiles`);
          if (response.ok) {
            const payload = await response.json();
            if (Array.isArray(payload?.profiles)) {
              setSupportedSigns(payload.profiles);
            }
          }
        } catch (profileError) {
          console.warn('Falling back to bundled recognition profiles:', profileError);
        }

        try {
          motionTemplatesRef.current = await loadMotionTemplateCache(API_BASE_URL);
        } catch (templateError) {
          console.warn('Motion templates unavailable; local refinement disabled.', templateError);
        }

        if (active) {
          landmarkerRef.current = handLandmarker;
          poseLandmarkerRef.current = poseLandmarker;
          setIsReady(true);
        }
      } catch (err) {
        console.error("Failed to initialize MediaPipe HandLandmarker", err);
      }
    }

    initializeVision();

    return () => {
      active = false;
      if (landmarkerRef.current) {
        landmarkerRef.current.close();
      }
      if (poseLandmarkerRef.current) {
        poseLandmarkerRef.current.close();
      }
    };
  }, []);

  const speakText = useCallback((text: string) => {
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.0;
      utterance.pitch = 1.0;
      
      const voices = window.speechSynthesis.getVoices();
      const englishVoice = voices.find(v => v.lang.includes('en') && (v.name.includes('Ghana') || v.name.includes('African'))) 
        || voices.find(v => v.lang.includes('en'));
      
      if (englishVoice) {
        utterance.voice = englishVoice;
      }

      window.speechSynthesis.speak(utterance);
    }
  }, []);

  const processVideoFrame = useCallback((videoElement: HTMLVideoElement, timestamp: number) => {
    if (!isReady || !landmarkerRef.current) return;
    if (!videoElement.videoWidth || !videoElement.videoHeight) return;
    if (videoElement.readyState < 2) return;

    if (videoElement.currentTime === lastVideoTimeRef.current) return;
    lastVideoTimeRef.current = videoElement.currentTime;

    // Cap detection work to ~15 FPS to keep UI responsive on lower-end devices.
    if (timestamp - lastProcessedTimestampRef.current < 66) return;
    lastProcessedTimestampRef.current = timestamp;

    try {
      const result = landmarkerRef.current.detectForVideo(videoElement, timestamp);
      const poseResult = poseLandmarkerRef.current?.detectForVideo(videoElement, timestamp);

      if (result && result.landmarks && result.landmarks.length > 0) {
        setIsDetecting(prev => (prev ? prev : true));
        // Append to rolling buffer
        frameBufferRef.current.push({
          timestamp,
          landmarks: result.landmarks,
          handednesses: result.handednesses,
          poseLandmarks: poseResult?.landmarks,
        });
        if (frameBufferRef.current.length > 30) {
          frameBufferRef.current.shift();
        }

        // 1. Extract Features
        const features = extractFeatures(frameBufferRef.current);
        if (!features) {
          stabilizerRef.current.processMatch(null); 
          return;
        }

        // 2. Match against profiles
        const profileMatch = matchSign(features);
        const match = refineMatchWithMotionTemplate(
          profileMatch,
          frameBufferRef.current,
          features.multiHand.activeHand,
          motionTemplatesRef.current,
        );

        // 3. Stabilize & Cooldown
        const { confirmedMatch, shouldSpeak } = stabilizerRef.current.processMatch(match);

        if (confirmedMatch) {
          setPredictedGloss(confirmedMatch.gloss);
          setConfidence(confirmedMatch.confidence);

          if (shouldSpeak) {
            setLastSpoken(confirmedMatch.gloss);
            speakText(confirmedMatch.gloss.toLowerCase());
          }
        }

        // Throttled debug publish (approx 10fps limit for React renders so we don't block the main thread drastically)
        if (timestamp - lastDebugUpdateRef.current > 100) {
          setDebugInfo({ features, rawMatch: match });
          lastDebugUpdateRef.current = timestamp;
        }

      } else {
        setIsDetecting(prev => (prev ? false : prev));
        stabilizerRef.current.processMatch(null);
      }
    } catch (error) {
      console.warn('MediaPipe hand detection skipped for current frame:', error)
      setIsDetecting(false)
      stabilizerRef.current.processMatch(null)
    }
  }, [isReady, speakText]);

  return {
    isReady,
    isDetecting,
    predictedGloss,
    confidence,
    lastSpoken,
    debugInfo,
    processVideoFrame
  };
}
