import React, { useRef, useEffect, useState } from 'react';
import * as THREE from 'three';
import { useAppStore } from '../stores/appStore';

interface Avatar3DProps {
  isVisible: boolean;
  signSequence?: string[];
  currentSign?: string;
  onSignComplete?: () => void;
}

const Avatar3D: React.FC<Avatar3DProps> = ({ 
  isVisible, 
  signSequence = [], 
  currentSign,
  onSignComplete 
}) => {
  const mountRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const avatarRef = useRef<THREE.Group | null>(null);
  const animationRef = useRef<number | null>(null);
  
  const [isAnimating, setIsAnimating] = useState(false);
  const { settings } = useAppStore();

  // GSL sign animations mapping
  const signAnimations: Record<string, (avatar: THREE.Group) => void> = {
    'HELLO': (avatar) => {
      // Wave animation - right hand wave
      const rightHand = avatar.getObjectByName('rightHand');
      if (rightHand) {
        const waveAnimation = () => {
          const time = Date.now() * 0.005;
          rightHand.rotation.z = Math.sin(time) * 0.3;
          rightHand.rotation.x = Math.cos(time * 0.5) * 0.1;
        };
        
        const animate = () => {
          waveAnimation();
          if (isAnimating) {
            animationRef.current = requestAnimationFrame(animate);
          }
        };
        
        setIsAnimating(true);
        animate();
        
        // Stop after 2 seconds
        setTimeout(() => {
          setIsAnimating(false);
          if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
          }
          rightHand.rotation.set(0, 0, 0);
          onSignComplete?.();
        }, 2000);
      }
    },
    
    'THANK_YOU': (avatar) => {
      // Thank you gesture - hands together near chin
      const leftHand = avatar.getObjectByName('leftHand');
      const rightHand = avatar.getObjectByName('rightHand');
      
      if (leftHand && rightHand) {
        const thankYouAnimation = () => {
          const time = Date.now() * 0.003;
          const baseY = 0.8; // Near chin level
          
          leftHand.position.set(-0.1, baseY + Math.sin(time) * 0.05, 0.3);
          rightHand.position.set(0.1, baseY + Math.sin(time) * 0.05, 0.3);
          
          // Slight bow motion
          avatar.rotation.x = Math.sin(time * 0.5) * 0.1;
        };
        
        const animate = () => {
          thankYouAnimation();
          if (isAnimating) {
            animationRef.current = requestAnimationFrame(animate);
          }
        };
        
        setIsAnimating(true);
        animate();
        
        setTimeout(() => {
          setIsAnimating(false);
          if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
          }
          avatar.rotation.x = 0;
          onSignComplete?.();
        }, 2000);
      }
    },
    
    'PLEASE': (avatar) => {
      // Please gesture - circular motion on chest
      const rightHand = avatar.getObjectByName('rightHand');
      if (rightHand) {
        const pleaseAnimation = () => {
          const time = Date.now() * 0.004;
          const centerX = 0;
          const centerY = 0.5;
          const radius = 0.1;
          
          rightHand.position.set(
            centerX + Math.cos(time) * radius,
            centerY + Math.sin(time) * radius,
            0.2
          );
        };
        
        const animate = () => {
          pleaseAnimation();
          if (isAnimating) {
            animationRef.current = requestAnimationFrame(animate);
          }
        };
        
        setIsAnimating(true);
        animate();
        
        setTimeout(() => {
          setIsAnimating(false);
          if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
          }
          rightHand.position.set(0.3, 0, 0);
          onSignComplete?.();
        }, 2000);
      }
    },
    
    'YES': (avatar) => {
      // Nodding animation
      const head = avatar.getObjectByName('head');
      if (head) {
        const nodAnimation = () => {
          const time = Date.now() * 0.008;
          head.rotation.x = Math.sin(time) * 0.2;
        };
        
        const animate = () => {
          nodAnimation();
          if (isAnimating) {
            animationRef.current = requestAnimationFrame(animate);
          }
        };
        
        setIsAnimating(true);
        animate();
        
        setTimeout(() => {
          setIsAnimating(false);
          if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
          }
          head.rotation.x = 0;
          onSignComplete?.();
        }, 1500);
      }
    },
    
    'NO': (avatar) => {
      // Head shake animation
      const head = avatar.getObjectByName('head');
      if (head) {
        const shakeAnimation = () => {
          const time = Date.now() * 0.012;
          head.rotation.y = Math.sin(time) * 0.3;
        };
        
        const animate = () => {
          shakeAnimation();
          if (isAnimating) {
            animationRef.current = requestAnimationFrame(animate);
          }
        };
        
        setIsAnimating(true);
        animate();
        
        setTimeout(() => {
          setIsAnimating(false);
          if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
          }
          head.rotation.y = 0;
          onSignComplete?.();
        }, 1500);
      }
    },
    
    'WHO': (avatar) => {
      // Who gesture - pointing and questioning expression
      const rightHand = avatar.getObjectByName('rightHand');
      if (rightHand) {
        const whoAnimation = () => {
          const time = Date.now() * 0.006;
          
          // Pointing gesture
          rightHand.position.set(
            0.5 + Math.sin(time) * 0.1,
            0.8,
            0.2
          );
          
          // Slight questioning tilt
          avatar.rotation.z = Math.sin(time * 0.5) * 0.05;
        };
        
        const animate = () => {
          whoAnimation();
          if (isAnimating) {
            animationRef.current = requestAnimationFrame(animate);
          }
        };
        
        setIsAnimating(true);
        animate();
        
        setTimeout(() => {
          setIsAnimating(false);
          if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
          }
          avatar.rotation.z = 0;
          rightHand.position.set(0.3, 0, 0);
          onSignComplete?.();
        }, 2000);
      }
    },
    
    'WHAT': (avatar) => {
      // What gesture - palms up questioning
      const leftHand = avatar.getObjectByName('leftHand');
      const rightHand = avatar.getObjectByName('rightHand');
      
      if (leftHand && rightHand) {
        const whatAnimation = () => {
          const time = Date.now() * 0.005;
          
          // Palms up gesture
          leftHand.position.set(-0.3, 0.6 + Math.sin(time) * 0.05, 0.2);
          rightHand.position.set(0.3, 0.6 + Math.sin(time) * 0.05, 0.2);
          
          leftHand.rotation.x = Math.PI / 2;
          rightHand.rotation.x = Math.PI / 2;
        };
        
        const animate = () => {
          whatAnimation();
          if (isAnimating) {
            animationRef.current = requestAnimationFrame(animate);
          }
        };
        
        setIsAnimating(true);
        animate();
        
        setTimeout(() => {
          setIsAnimating(false);
          if (animationRef.current) {
            cancelAnimationFrame(animationRef.current);
          }
          leftHand.rotation.x = 0;
          rightHand.rotation.x = 0;
          leftHand.position.set(-0.3, 0, 0);
          rightHand.position.set(0.3, 0, 0);
          onSignComplete?.();
        }, 2000);
      }
    }
  };

  // Create 3D avatar
  const createAvatar = (): THREE.Group => {
    const avatar = new THREE.Group();
    
    // Head
    const headGeometry = new THREE.SphereGeometry(0.15, 16, 16);
    const headMaterial = new THREE.MeshPhongMaterial({ 
      color: settings.highContrast ? 0xffff00 : 0xffdbac 
    });
    const head = new THREE.Mesh(headGeometry, headMaterial);
    head.position.set(0, 1.6, 0);
    head.name = 'head';
    avatar.add(head);
    
    // Eyes
    const eyeGeometry = new THREE.SphereGeometry(0.03, 8, 8);
    const eyeMaterial = new THREE.MeshPhongMaterial({ color: 0x000000 });
    
    const leftEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    leftEye.position.set(-0.05, 1.65, 0.12);
    avatar.add(leftEye);
    
    const rightEye = new THREE.Mesh(eyeGeometry, eyeMaterial);
    rightEye.position.set(0.05, 1.65, 0.12);
    avatar.add(rightEye);
    
    // Body
    const bodyGeometry = new THREE.CylinderGeometry(0.12, 0.15, 0.8, 8);
    const bodyMaterial = new THREE.MeshPhongMaterial({ 
      color: settings.highContrast ? 0x0000ff : 0x4169e1 
    });
    const body = new THREE.Mesh(bodyGeometry, bodyMaterial);
    body.position.set(0, 1.0, 0);
    avatar.add(body);
    
    // Arms
    const armGeometry = new THREE.CylinderGeometry(0.04, 0.04, 0.6, 8);
    const armMaterial = new THREE.MeshPhongMaterial({ 
      color: settings.highContrast ? 0xffff00 : 0xffdbac 
    });
    
    // Left arm
    const leftArm = new THREE.Mesh(armGeometry, armMaterial);
    leftArm.position.set(-0.2, 1.1, 0);
    leftArm.rotation.z = Math.PI / 6;
    avatar.add(leftArm);
    
    // Right arm
    const rightArm = new THREE.Mesh(armGeometry, armMaterial);
    rightArm.position.set(0.2, 1.1, 0);
    rightArm.rotation.z = -Math.PI / 6;
    avatar.add(rightArm);
    
    // Hands
    const handGeometry = new THREE.SphereGeometry(0.06, 8, 8);
    const handMaterial = new THREE.MeshPhongMaterial({ 
      color: settings.highContrast ? 0xffff00 : 0xffdbac 
    });
    
    // Left hand
    const leftHand = new THREE.Mesh(handGeometry, handMaterial);
    leftHand.position.set(-0.35, 0.7, 0);
    leftHand.name = 'leftHand';
    avatar.add(leftHand);
    
    // Right hand
    const rightHand = new THREE.Mesh(handGeometry, handMaterial);
    rightHand.position.set(0.35, 0.7, 0);
    rightHand.name = 'rightHand';
    avatar.add(rightHand);
    
    return avatar;
  };

  // Initialize Three.js scene
  useEffect(() => {
    if (!mountRef.current || !isVisible) return;

    // Scene setup
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(settings.highContrast ? 0x000000 : 0xf0f0f0);
    sceneRef.current = scene;

    // Camera setup
    const camera = new THREE.PerspectiveCamera(
      75,
      mountRef.current.clientWidth / mountRef.current.clientHeight,
      0.1,
      1000
    );
    camera.position.set(0, 1, 3);
    cameraRef.current = camera;

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    // Lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(2, 2, 2);
    directionalLight.castShadow = true;
    directionalLight.shadow.mapSize.width = 2048;
    directionalLight.shadow.mapSize.height = 2048;
    scene.add(directionalLight);

    // Create avatar
    const avatar = createAvatar();
    avatar.castShadow = true;
    avatar.receiveShadow = true;
    avatarRef.current = avatar;
    scene.add(avatar);

    // Ground plane
    const groundGeometry = new THREE.PlaneGeometry(10, 10);
    const groundMaterial = new THREE.MeshLambertMaterial({ 
      color: settings.highContrast ? 0x333333 : 0xcccccc 
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.5;
    ground.receiveShadow = true;
    scene.add(ground);

    // Add renderer to DOM
    mountRef.current.appendChild(renderer.domElement);

    // Animation loop
    const animate = () => {
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
      requestAnimationFrame(animate);
    };
    animate();

    // Handle resize
    const handleResize = () => {
      if (mountRef.current && cameraRef.current && rendererRef.current) {
        const width = mountRef.current.clientWidth;
        const height = mountRef.current.clientHeight;
        
        cameraRef.current.aspect = width / height;
        cameraRef.current.updateProjectionMatrix();
        rendererRef.current.setSize(width, height);
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      if (mountRef.current && renderer.domElement) {
        mountRef.current.removeChild(renderer.domElement);
      }
      renderer.dispose();
    };
  }, [isVisible, settings.highContrast]);

  // Handle sign animations
  useEffect(() => {
    if (currentSign && avatarRef.current && !isAnimating) {
      const animationFunction = signAnimations[currentSign];
      if (animationFunction) {
        animationFunction(avatarRef.current);
      }
    }
  }, [currentSign, isAnimating]);

  // Handle sign sequence
  useEffect(() => {
    if (signSequence.length > 0 && !isAnimating) {
      const currentSignIndex = 0;
      const sign = signSequence[currentSignIndex];
      
      if (sign && avatarRef.current) {
        const animationFunction = signAnimations[sign];
        if (animationFunction) {
          animationFunction(avatarRef.current);
        }
      }
    }
  }, [signSequence, isAnimating]);

  if (!isVisible) {
    return null;
  }

  return (
    <div 
      ref={mountRef} 
      className={`w-full h-96 rounded-lg border-2 ${
        settings.highContrast 
          ? 'border-yellow-400 bg-black' 
          : 'border-gray-300 bg-white'
      }`}
      style={{ minHeight: '384px' }}
    />
  );
};

export default Avatar3D;