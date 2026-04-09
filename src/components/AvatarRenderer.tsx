import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { useAppStore, useAccessibilitySettings } from '@/stores/appStore';

interface AvatarRendererProps {
  signSequence: string[];
  isActive: boolean;
  onAnimationComplete?: () => void;
}

interface SignAnimation {
  sign: string;
  handPositions: THREE.Vector3[];
  handRotations: THREE.Euler[];
  duration: number;
  keyframes: number;
}

const AvatarRenderer: React.FC<AvatarRendererProps> = ({ 
  signSequence, 
  isActive, 
  onAnimationComplete 
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const avatarRef = useRef<THREE.Group | null>(null);
  const leftHandRef = useRef<THREE.Group | null>(null);
  const rightHandRef = useRef<THREE.Group | null>(null);
  const animationRef = useRef<number | null>(null);
  
  const accessibility = useAccessibilitySettings();
  const [isLoading, setIsLoading] = useState(true);
  const [currentSign, setCurrentSign] = useState('');

  // GSL sign animation data (simplified)
  const signAnimations: Record<string, SignAnimation> = {
    'HELLO': {
      sign: 'HELLO',
      handPositions: [
        new THREE.Vector3(-0.2, 1.2, 0.3),
        new THREE.Vector3(0.2, 1.2, 0.3),
        new THREE.Vector3(-0.2, 1.2, 0.3)
      ],
      handRotations: [
        new THREE.Euler(0, 0, 0),
        new THREE.Euler(0.2, 0, 0),
        new THREE.Euler(0, 0, 0)
      ],
      duration: 1500,
      keyframes: 3
    },
    'THANK_YOU': {
      sign: 'THANK_YOU',
      handPositions: [
        new THREE.Vector3(0, 1.0, 0.2),
        new THREE.Vector3(0, 1.1, 0.1),
        new THREE.Vector3(0, 1.0, 0.2)
      ],
      handRotations: [
        new THREE.Euler(0, 0, 0),
        new THREE.Euler(-0.3, 0, 0),
        new THREE.Euler(0, 0, 0)
      ],
      duration: 1200,
      keyframes: 3
    },
    'YES': {
      sign: 'YES',
      handPositions: [
        new THREE.Vector3(0, 1.1, 0.3),
        new THREE.Vector3(0, 1.1, 0.3),
        new THREE.Vector3(0, 1.1, 0.3)
      ],
      handRotations: [
        new THREE.Euler(0, 0, 0),
        new THREE.Euler(0, 0, 0.3),
        new THREE.Euler(0, 0, -0.3)
      ],
      duration: 800,
      keyframes: 3
    },
    'NO': {
      sign: 'NO',
      handPositions: [
        new THREE.Vector3(0, 1.1, 0.3),
        new THREE.Vector3(0.1, 1.1, 0.3),
        new THREE.Vector3(-0.1, 1.1, 0.3)
      ],
      handRotations: [
        new THREE.Euler(0, 0, 0),
        new THREE.Euler(0, 0, 0),
        new THREE.Euler(0, 0, 0)
      ],
      duration: 1000,
      keyframes: 3
    }
  };

  // Default/rest position
  const defaultHandPositions = {
    left: new THREE.Vector3(-0.3, 0.8, 0.2),
    right: new THREE.Vector3(0.3, 0.8, 0.2)
  };

  const defaultHandRotations = {
    left: new THREE.Euler(0, 0, 0),
    right: new THREE.Euler(0, 0, 0)
  };

  useEffect(() => {
    if (!mountRef.current) return;

    // Initialize Three.js scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(accessibility.highContrast ? 0x000000 : 0x1a1a2e);
    sceneRef.current = scene;

    // Initialize camera
    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 1, 3);
    cameraRef.current = camera;

    // Initialize renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    mountRef.current.appendChild(renderer.domElement);

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(5, 10, 5);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Create avatar
    createAvatar(scene);

    setIsLoading(false);

    // Handle window resize
    const handleResize = () => {
      if (!mountRef.current || !camera || !renderer) return;
      
      const width = mountRef.current.clientWidth;
      const height = mountRef.current.clientHeight;
      
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    };

    window.addEventListener('resize', handleResize);

    // Animation loop
    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);
      
      if (renderer && scene && camera) {
        // Rotate avatar slightly for natural movement
        if (avatarRef.current) {
          avatarRef.current.rotation.y = Math.sin(Date.now() * 0.001) * 0.05;
        }
        
        renderer.render(scene, camera);
      }
    };
    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, []);

  // Handle sign sequence changes
  useEffect(() => {
    if (isActive && signSequence.length > 0) {
      animateSignSequence(signSequence);
    }
  }, [signSequence, isActive]);

  const createAvatar = (scene: THREE.Scene) => {
    const avatar = new THREE.Group();
    avatarRef.current = avatar;

    // Create torso
    const torsoGeometry = new THREE.CapsuleGeometry(0.3, 0.8, 4, 8);
    const torsoMaterial = new THREE.MeshPhongMaterial({ 
      color: accessibility.highContrast ? 0xffffff : 0x4a90e2 
    });
    const torso = new THREE.Mesh(torsoGeometry, torsoMaterial);
    torso.position.set(0, 0.5, 0);
    torso.castShadow = true;
    avatar.add(torso);

    // Create head
    const headGeometry = new THREE.SphereGeometry(0.15, 16, 16);
    const headMaterial = new THREE.MeshPhongMaterial({ 
      color: accessibility.highContrast ? 0xffffff : 0xfdbcb4 
    });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.set(0, 1.0, 0);
    head.castShadow = true;
    avatar.add(head);

    // Create left hand
    const leftHand = createHand('left');
    leftHand.position.copy(defaultHandPositions.left);
    leftHandRef.current = leftHand;
    avatar.add(leftHand);

    // Create right hand
    const rightHand = createHand('right');
    rightHand.position.copy(defaultHandPositions.right);
    rightHandRef.current = rightHand;
    avatar.add(rightHand);

    scene.add(avatar);
  };

  const createHand = (side: 'left' | 'right') => {
    const hand = new THREE.Group();
    
    // Palm
    const palmGeometry = new THREE.BoxGeometry(0.08, 0.12, 0.02);
    const palmMaterial = new THREE.MeshPhongMaterial({ 
      color: accessibility.highContrast ? 0xffffff : 0xfdbcb4 
    });
    const palm = new THREE.Mesh(palmGeometry, palmMaterial);
    palm.castShadow = true;
    hand.add(palm);

    // Fingers (simplified)
    const fingerGeometry = new THREE.CapsuleGeometry(0.008, 0.08, 4, 8);
    const fingerMaterial = new THREE.MeshPhongMaterial({ 
      color: accessibility.highContrast ? 0xffffff : 0xfdbcb4 
    });

    for (let i = 0; i < 4; i++) {
      const finger = new THREE.Mesh(fingerGeometry, fingerMaterial);
      finger.position.set((i - 1.5) * 0.02, 0.06, 0);
      finger.rotation.z = (i - 1.5) * 0.1;
      finger.castShadow = true;
      hand.add(finger);
    }

    // Thumb
    const thumbGeometry = new THREE.CapsuleGeometry(0.01, 0.06, 4, 8);
    const thumb = new THREE.Mesh(thumbGeometry, fingerMaterial);
    thumb.position.set(side === 'left' ? -0.04 : 0.04, 0.02, 0);
    thumb.rotation.z = side === 'left' ? 0.5 : -0.5;
    thumb.castShadow = true;
    hand.add(thumb);

    return hand;
  };

  const animateSignSequence = async (sequence: string[]) => {
    if (!leftHandRef.current || !rightHandRef.current) return;

    setCurrentSign(sequence[0] || '');

    for (const sign of sequence) {
      if (!isActive) break;
      
      const animation = signAnimations[sign];
      if (animation) {
        await animateSign(animation);
        
        // Pause between signs
        await new Promise(resolve => setTimeout(resolve, 300));
      }
    }

    // Return to default position
    returnToDefaultPosition();
    
    if (onAnimationComplete) {
      onAnimationComplete();
    }
  };

  const animateSign = (animation: SignAnimation): Promise<void> => {
    return new Promise((resolve) => {
      if (!leftHandRef.current || !rightHandRef.current) {
        resolve();
        return;
      }

      const startTime = Date.now();
      const duration = animation.duration;

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);

        // Interpolate positions and rotations
        const keyframeIndex = Math.floor(progress * (animation.keyframes - 1));
        const keyframeProgress = (progress * (animation.keyframes - 1)) % 1;

        if (animation.handPositions[keyframeIndex] && animation.handRotations[keyframeIndex]) {
          const currentPos = animation.handPositions[keyframeIndex];
          const currentRot = animation.handRotations[keyframeIndex];

          // Animate right hand (primary)
          rightHandRef.current!.position.copy(currentPos);
          rightHandRef.current!.rotation.copy(currentRot);

          // Mirror for left hand in some cases
          if (shouldMirrorSign(animation.sign)) {
            const mirroredPos = currentPos.clone();
            mirroredPos.x = -mirroredPos.x;
            
            const mirroredRot = currentRot.clone();
            mirroredRot.y = -mirroredRot.y;
            mirroredRot.z = -mirroredRot.z;
            
            leftHandRef.current!.position.copy(mirroredPos);
            leftHandRef.current!.rotation.copy(mirroredRot);
          }
        }

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };

      animate();
    });
  };

  const shouldMirrorSign = (sign: string): boolean => {
    // Signs that should be mirrored for left hand
    const mirrorSigns = ['HELLO', 'THANK_YOU', 'YES', 'NO'];
    return mirrorSigns.includes(sign);
  };

  const returnToDefaultPosition = () => {
    if (!leftHandRef.current || !rightHandRef.current) return;

    const duration = 500;
    const startTime = Date.now();

    const startLeftPos = leftHandRef.current.position.clone();
    const startRightPos = rightHandRef.current.position.clone();
    const startLeftRot = leftHandRef.current.rotation.clone();
    const startRightRot = rightHandRef.current.rotation.clone();

    const animate = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easeInOutCubic(progress);

      // Interpolate positions
      leftHandRef.current!.position.lerpVectors(
        startLeftPos,
        defaultHandPositions.left,
        eased
      );

      rightHandRef.current!.position.lerpVectors(
        startRightPos,
        defaultHandPositions.right,
        eased
      );

      // Interpolate rotations
      const startLeftQuat = new THREE.Quaternion().setFromEuler(startLeftRot);
      const endLeftQuat = new THREE.Quaternion().setFromEuler(defaultHandRotations.left);
      startLeftQuat.slerp(endLeftQuat, eased);
      leftHandRef.current!.rotation.setFromQuaternion(startLeftQuat);

      const startRightQuat = new THREE.Quaternion().setFromEuler(startRightRot);
      const endRightQuat = new THREE.Quaternion().setFromEuler(defaultHandRotations.right);
      startRightQuat.slerp(endRightQuat, eased);
      rightHandRef.current!.rotation.setFromQuaternion(startRightQuat);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    animate();
  };

  const easeInOutCubic = (t: number): number => {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  };

  return (
    <div className="relative w-full h-full group">
      <div 
        ref={mountRef} 
        className={`w-full h-full rounded-3xl overflow-hidden transition-all duration-700 ${
          accessibility.highContrast 
            ? 'border-4 border-yellow-400 bg-black' 
            : 'glass shadow-glass border border-white/20'
        }`}
        style={{ 
          minHeight: '400px',
          background: accessibility.highContrast 
            ? '#000000' 
            : 'linear-gradient(135deg, rgba(26, 26, 46, 0.4) 0%, rgba(22, 33, 62, 0.4) 100%)'
        }}
      />
      
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 backdrop-blur-md rounded-3xl z-10">
          <div className="text-center">
            <div className="relative w-16 h-16 mx-auto mb-6">
              <div className="absolute inset-0 border-4 border-blue-500/20 rounded-full"></div>
              <div className="absolute inset-0 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            </div>
            <p className={`${accessibility.largeText ? 'text-xl' : 'text-lg'} text-white font-medium animate-pulse`}>
              Preparing 3D Avatar
            </p>
          </div>
        </div>
      )}
      
      {currentSign && isActive && (
        <div className="absolute top-4 left-4 animate-fade-in z-20">
          <div className="glass px-4 py-2 rounded-2xl border-white/20 shadow-lg">
            <p className={`${accessibility.largeText ? 'text-lg' : 'text-sm'} font-bold text-white tracking-wide`}>
              {currentSign.replace('_', ' ')}
            </p>
          </div>
        </div>
      )}
      
      {!isActive && !isLoading && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 animate-slide-up z-20">
          <div className="glass px-6 py-2 rounded-full border-white/20 shadow-xl flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
            <p className={`${accessibility.largeText ? 'text-base' : 'text-xs'} text-white font-bold uppercase tracking-widest`}>
              System Ready
            </p>
          </div>
        </div>
      )}

      {/* Background Glow */}
      {!accessibility.highContrast && (
        <div className="absolute -z-10 inset-0 pointer-events-none overflow-hidden rounded-3xl">
          <div className="absolute top-1/4 -left-1/4 w-1/2 h-1/2 bg-blue-500/10 blur-[100px] animate-pulse-slow" />
          <div className="absolute bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-purple-500/10 blur-[100px] animate-pulse-slow" />
        </div>
      )}
    </div>
  );
};

export default AvatarRenderer;
