import React, { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { useAppStore } from '../stores/appStore'

interface AvatarPrimitive {
  direction?: string
  repetition?: string
  handshape?: string
  location?: string
  two_hands?: boolean
  facial?: boolean
  can_animate?: boolean
}

interface Avatar3DProps {
  isVisible: boolean
  signSequence?: string[]
  primitiveSequence?: Array<AvatarPrimitive | null>
  currentSign?: string
  currentSignIndex?: number
  onSignComplete?: () => void
}

interface AvatarRig {
  root: THREE.Group
  torso: THREE.Group
  head: THREE.Group
  leftShoulder: THREE.Group
  leftElbow: THREE.Group
  leftWrist: THREE.Group
  rightShoulder: THREE.Group
  rightElbow: THREE.Group
  rightWrist: THREE.Group
}

interface PoseTarget {
  leftShoulder: THREE.Euler
  leftElbow: THREE.Euler
  leftWrist: THREE.Euler
  rightShoulder: THREE.Euler
  rightElbow: THREE.Euler
  rightWrist: THREE.Euler
  head: THREE.Euler
  torso: THREE.Euler
}

const clonePose = (p: PoseTarget): PoseTarget => ({
  leftShoulder: p.leftShoulder.clone(),
  leftElbow: p.leftElbow.clone(),
  leftWrist: p.leftWrist.clone(),
  rightShoulder: p.rightShoulder.clone(),
  rightElbow: p.rightElbow.clone(),
  rightWrist: p.rightWrist.clone(),
  head: p.head.clone(),
  torso: p.torso.clone(),
})

const IDLE_POSE: PoseTarget = {
  leftShoulder: new THREE.Euler(0.2, 0.1, 0.55),
  leftElbow: new THREE.Euler(0.35, 0, -0.2),
  leftWrist: new THREE.Euler(0.05, 0, 0),
  rightShoulder: new THREE.Euler(0.2, -0.1, -0.55),
  rightElbow: new THREE.Euler(0.35, 0, 0.2),
  rightWrist: new THREE.Euler(0.05, 0, 0),
  head: new THREE.Euler(0, 0, 0),
  torso: new THREE.Euler(0, 0, 0),
}

const makePose = (overrides: Partial<PoseTarget>): PoseTarget => ({
  ...clonePose(IDLE_POSE),
  ...overrides,
})

const SIGN_POSES: Record<string, PoseTarget> = {
  HELLO: makePose({
    rightShoulder: new THREE.Euler(-0.45, -0.2, -0.95),
    rightElbow: new THREE.Euler(0.3, 0.1, 0.6),
    rightWrist: new THREE.Euler(0.25, 0.1, 0.45),
    head: new THREE.Euler(0.03, 0, 0),
  }),
  THANK_YOU: makePose({
    rightShoulder: new THREE.Euler(-0.25, -0.05, -0.55),
    rightElbow: new THREE.Euler(0.1, 0, 1.2),
    rightWrist: new THREE.Euler(0.2, 0, 0.4),
    leftShoulder: new THREE.Euler(0.15, 0.1, 0.35),
    head: new THREE.Euler(0.08, 0, 0),
    torso: new THREE.Euler(0.05, 0, 0),
  }),
  PLEASE: makePose({
    rightShoulder: new THREE.Euler(-0.25, -0.05, -0.35),
    rightElbow: new THREE.Euler(0.65, 0.2, 0.75),
    rightWrist: new THREE.Euler(0.3, 0, 0.8),
    leftShoulder: new THREE.Euler(0.18, 0.1, 0.45),
  }),
  YES: makePose({
    rightShoulder: new THREE.Euler(-0.05, -0.15, -0.8),
    rightElbow: new THREE.Euler(1.0, 0, 0.1),
    rightWrist: new THREE.Euler(0.7, 0, 0.2),
    head: new THREE.Euler(0.22, 0, 0),
  }),
  NO: makePose({
    rightShoulder: new THREE.Euler(-0.18, -0.1, -0.5),
    rightElbow: new THREE.Euler(0.45, 0, 0.95),
    rightWrist: new THREE.Euler(0.5, 0.25, 0.2),
    head: new THREE.Euler(0, 0.25, 0),
  }),
  WHO: makePose({
    rightShoulder: new THREE.Euler(-0.12, -0.2, -0.8),
    rightElbow: new THREE.Euler(0.18, 0, 1.05),
    rightWrist: new THREE.Euler(0.15, 0.15, 0.5),
    leftShoulder: new THREE.Euler(0.2, 0.08, 0.45),
    head: new THREE.Euler(0, 0.1, 0),
  }),
  WHAT: makePose({
    leftShoulder: new THREE.Euler(-0.1, 0.25, 0.85),
    leftElbow: new THREE.Euler(0.45, 0.1, -0.9),
    leftWrist: new THREE.Euler(0.5, -0.2, -0.45),
    rightShoulder: new THREE.Euler(-0.1, -0.25, -0.85),
    rightElbow: new THREE.Euler(0.45, -0.1, 0.9),
    rightWrist: new THREE.Euler(0.5, 0.2, 0.45),
    head: new THREE.Euler(0.05, 0, 0),
  }),
}

const applyPrimitiveInfluence = (base: PoseTarget, primitive: AvatarPrimitive | null): PoseTarget => {
  if (!primitive) return base

  const pose = clonePose(base)
  const location = String(primitive.location || 'NEUTRAL').toUpperCase()
  const handshape = String(primitive.handshape || 'UNKNOWN').toUpperCase()
  const direction = String(primitive.direction || 'NONE').toUpperCase()
  const twoHands = Boolean(primitive.two_hands)
  const facial = Boolean(primitive.facial)

  if (location === 'HEAD' || location === 'FACE' || location === 'CHIN') {
    pose.rightShoulder.x -= 0.18
    pose.rightElbow.z += 0.35
    pose.rightWrist.x += 0.22
    if (twoHands) {
      pose.leftShoulder.x -= 0.16
      pose.leftElbow.z -= 0.22
      pose.leftWrist.x += 0.2
    }
  } else if (location === 'CHEST' || location === 'TORSO') {
    pose.rightShoulder.x -= 0.05
    pose.rightElbow.z += 0.15
    if (twoHands) {
      pose.leftShoulder.x -= 0.05
      pose.leftElbow.z -= 0.12
    }
  } else if (location === 'NEUTRAL') {
    pose.rightShoulder.x += 0.05
    pose.rightElbow.x += 0.1
  }

  if (handshape === 'POINT') {
    pose.rightWrist.z += 0.35
    pose.rightElbow.y += 0.12
  } else if (handshape === 'FIST') {
    pose.rightWrist.x += 0.25
  } else if (handshape === 'CURVED') {
    pose.rightWrist.z += 0.18
    pose.rightWrist.x += 0.08
  } else if (handshape === 'OPEN' || handshape === 'FLAT') {
    pose.rightWrist.x -= 0.05
    pose.rightWrist.z += 0.1
  }

  if (direction === 'UP') {
    pose.rightShoulder.x -= 0.12
    pose.torso.x -= 0.03
  } else if (direction === 'DOWN') {
    pose.rightShoulder.x += 0.1
    pose.torso.x += 0.03
  } else if (direction === 'LEFT') {
    pose.rightShoulder.y += 0.2
  } else if (direction === 'RIGHT') {
    pose.rightShoulder.y -= 0.2
  } else if (direction === 'FORWARD') {
    pose.rightElbow.y += 0.25
    pose.rightWrist.y += 0.1
  } else if (direction === 'CIRCULAR' || direction === 'TAP') {
    pose.rightWrist.z += 0.2
  }

  if (!twoHands) {
    pose.leftShoulder = IDLE_POSE.leftShoulder.clone()
    pose.leftElbow = IDLE_POSE.leftElbow.clone()
    pose.leftWrist = IDLE_POSE.leftWrist.clone()
  }

  if (facial) {
    pose.head.x += 0.08
    pose.head.y += 0.05
  }

  if (primitive.can_animate === false) {
    pose.torso.x *= 0.5
    pose.head.x *= 0.6
  }

  return pose
}

const blendPose = (from: PoseTarget, to: PoseTarget, factor: number): PoseTarget => ({
  leftShoulder: new THREE.Euler(
    from.leftShoulder.x + (to.leftShoulder.x - from.leftShoulder.x) * factor,
    from.leftShoulder.y + (to.leftShoulder.y - from.leftShoulder.y) * factor,
    from.leftShoulder.z + (to.leftShoulder.z - from.leftShoulder.z) * factor,
  ),
  leftElbow: new THREE.Euler(
    from.leftElbow.x + (to.leftElbow.x - from.leftElbow.x) * factor,
    from.leftElbow.y + (to.leftElbow.y - from.leftElbow.y) * factor,
    from.leftElbow.z + (to.leftElbow.z - from.leftElbow.z) * factor,
  ),
  leftWrist: new THREE.Euler(
    from.leftWrist.x + (to.leftWrist.x - from.leftWrist.x) * factor,
    from.leftWrist.y + (to.leftWrist.y - from.leftWrist.y) * factor,
    from.leftWrist.z + (to.leftWrist.z - from.leftWrist.z) * factor,
  ),
  rightShoulder: new THREE.Euler(
    from.rightShoulder.x + (to.rightShoulder.x - from.rightShoulder.x) * factor,
    from.rightShoulder.y + (to.rightShoulder.y - from.rightShoulder.y) * factor,
    from.rightShoulder.z + (to.rightShoulder.z - from.rightShoulder.z) * factor,
  ),
  rightElbow: new THREE.Euler(
    from.rightElbow.x + (to.rightElbow.x - from.rightElbow.x) * factor,
    from.rightElbow.y + (to.rightElbow.y - from.rightElbow.y) * factor,
    from.rightElbow.z + (to.rightElbow.z - from.rightElbow.z) * factor,
  ),
  rightWrist: new THREE.Euler(
    from.rightWrist.x + (to.rightWrist.x - from.rightWrist.x) * factor,
    from.rightWrist.y + (to.rightWrist.y - from.rightWrist.y) * factor,
    from.rightWrist.z + (to.rightWrist.z - from.rightWrist.z) * factor,
  ),
  head: new THREE.Euler(
    from.head.x + (to.head.x - from.head.x) * factor,
    from.head.y + (to.head.y - from.head.y) * factor,
    from.head.z + (to.head.z - from.head.z) * factor,
  ),
  torso: new THREE.Euler(
    from.torso.x + (to.torso.x - from.torso.x) * factor,
    from.torso.y + (to.torso.y - from.torso.y) * factor,
    from.torso.z + (to.torso.z - from.torso.z) * factor,
  ),
})

const easeInOutCubic = (value: number) => {
  const t = Math.max(0, Math.min(1, value))
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

const Avatar3D: React.FC<Avatar3DProps> = ({
  isVisible,
  signSequence = [],
  primitiveSequence = [],
  currentSign,
  currentSignIndex,
  onSignComplete,
}) => {
  const mountRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rigRef = useRef<AvatarRig | null>(null)
  const animationRef = useRef<number | null>(null)
  const clockRef = useRef<THREE.Clock>(new THREE.Clock())
  const sequenceIndexRef = useRef(0)
  const targetPoseRef = useRef<PoseTarget>(IDLE_POSE)
  const activePrimitiveRef = useRef<AvatarPrimitive | null>(null)
  const lastPoseRef = useRef<PoseTarget>(clonePose(IDLE_POSE))
  const phaseRef = useRef<'idle' | 'entry' | 'hold' | 'exit'>('idle')
  const phaseStartRef = useRef<number>(0)
  const lastMotionKeyRef = useRef('')
  const activeLabelRef = useRef('')

  const { settings } = useAppStore()
  const highContrast = settings.accessibility.highContrast

  const activeIndex = typeof currentSignIndex === 'number' ? currentSignIndex : -1
  const activeLabel = useMemo(() => {
    if (activeIndex >= 0 && signSequence[activeIndex]) {
      return String(signSequence[activeIndex] || '').toUpperCase()
    }
    return currentSign ? currentSign.toUpperCase() : ''
  }, [activeIndex, currentSign, signSequence])

  const activePrimitive = useMemo(() => {
    if (activeIndex >= 0) {
      return primitiveSequence[activeIndex] || null
    }
    return null
  }, [activeIndex, primitiveSequence])

  const startMotion = (label: string, primitive: AvatarPrimitive | null) => {
    const base = SIGN_POSES[label] ? clonePose(SIGN_POSES[label]) : clonePose(IDLE_POSE)
    const target = applyPrimitiveInfluence(base, primitive)
    const previous = clonePose(lastPoseRef.current)
    targetPoseRef.current = target
    lastPoseRef.current = clonePose(previous)
    activePrimitiveRef.current = primitive
    activeLabelRef.current = label
    phaseRef.current = label ? 'entry' : 'exit'
    phaseStartRef.current = performance.now()
  }

  const createAvatar = (): AvatarRig => {
    const root = new THREE.Group()

    const skinColor = highContrast ? 0xfbf067 : 0xf2c7a4
    const clothColor = highContrast ? 0x1f49ff : 0x3359c9

    const skin = new THREE.MeshStandardMaterial({ color: skinColor, roughness: 0.55, metalness: 0.05 })
    const cloth = new THREE.MeshStandardMaterial({ color: clothColor, roughness: 0.7, metalness: 0.03 })
    const hair = new THREE.MeshStandardMaterial({ color: highContrast ? 0xdddddd : 0x2c2424, roughness: 0.9 })

    const torso = new THREE.Group()
    const chest = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 0.75, 10, 18), cloth)
    chest.castShadow = true
    chest.position.y = 0.9
    torso.add(chest)

    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.12, 14), skin)
    neck.position.y = 1.48
    neck.castShadow = true
    torso.add(neck)

    const head = new THREE.Group()
    head.position.set(0, 1.7, 0)

    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.2, 24, 24), skin)
    skull.castShadow = true
    head.add(skull)

    const hairCap = new THREE.Mesh(new THREE.SphereGeometry(0.203, 24, 24, 0, Math.PI * 2, 0, Math.PI * 0.62), hair)
    hairCap.position.y = 0.02
    head.add(hairCap)

    const eyeGeo = new THREE.SphereGeometry(0.015, 12, 12)
    const eyeMat = new THREE.MeshStandardMaterial({ color: 0x111111 })
    const leftEye = new THREE.Mesh(eyeGeo, eyeMat)
    leftEye.position.set(-0.055, 0.03, 0.175)
    const rightEye = new THREE.Mesh(eyeGeo, eyeMat)
    rightEye.position.set(0.055, 0.03, 0.175)
    head.add(leftEye, rightEye)

    const shoulderPivot = (x: number, isLeft: boolean) => {
      const shoulder = new THREE.Group()
      shoulder.position.set(x, 1.3, 0)

      const upperArm = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.34, 8, 12), skin)
      upperArm.rotation.z = isLeft ? Math.PI / 2 : -Math.PI / 2
      upperArm.position.set(isLeft ? -0.19 : 0.19, -0.02, 0)
      upperArm.castShadow = true
      shoulder.add(upperArm)

      const elbow = new THREE.Group()
      elbow.position.set(isLeft ? -0.37 : 0.37, -0.02, 0)
      shoulder.add(elbow)

      const forearm = new THREE.Mesh(new THREE.CapsuleGeometry(0.048, 0.3, 8, 12), skin)
      forearm.rotation.z = isLeft ? Math.PI / 2 : -Math.PI / 2
      forearm.position.set(isLeft ? -0.17 : 0.17, 0, 0)
      forearm.castShadow = true
      elbow.add(forearm)

      const wrist = new THREE.Group()
      wrist.position.set(isLeft ? -0.34 : 0.34, 0, 0)
      elbow.add(wrist)

      const palm = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.07, 0.03), skin)
      palm.position.set(isLeft ? -0.07 : 0.07, 0, 0)
      palm.castShadow = true
      wrist.add(palm)

      for (let i = 0; i < 4; i += 1) {
        const finger = new THREE.Mesh(new THREE.BoxGeometry(0.042, 0.012, 0.012), skin)
        finger.position.set(isLeft ? -0.13 : 0.13, 0.024 - i * 0.016, 0.004)
        finger.castShadow = true
        wrist.add(finger)
      }

      const thumb = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.012, 0.012), skin)
      thumb.position.set(isLeft ? -0.09 : 0.09, -0.04, 0.012)
      thumb.rotation.z = isLeft ? -0.5 : 0.5
      wrist.add(thumb)

      return { shoulder, elbow, wrist }
    }

    const left = shoulderPivot(-0.25, true)
    const right = shoulderPivot(0.25, false)

    torso.add(left.shoulder)
    torso.add(right.shoulder)
    root.add(torso)
    root.add(head)

    return {
      root,
      torso,
      head,
      leftShoulder: left.shoulder,
      leftElbow: left.elbow,
      leftWrist: left.wrist,
      rightShoulder: right.shoulder,
      rightElbow: right.elbow,
      rightWrist: right.wrist,
    }
  }

  const lerpEuler = (node: THREE.Object3D, target: THREE.Euler, factor: number) => {
    node.rotation.x += (target.x - node.rotation.x) * factor
    node.rotation.y += (target.y - node.rotation.y) * factor
    node.rotation.z += (target.z - node.rotation.z) * factor
  }

  useEffect(() => {
    if (!mountRef.current || !isVisible) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(highContrast ? 0x000000 : 0xe7ebf4)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(44, mountRef.current.clientWidth / mountRef.current.clientHeight, 0.1, 100)
    camera.position.set(0, 1.35, 4.15)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mountRef.current.clientWidth, mountRef.current.clientHeight)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    rendererRef.current = renderer

    const fill = new THREE.AmbientLight(0xffffff, 0.58)
    const key = new THREE.DirectionalLight(0xffffff, 1.05)
    key.position.set(2.7, 3.1, 3.8)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)

    const rim = new THREE.DirectionalLight(0xaac6ff, 0.35)
    rim.position.set(-2.5, 2.2, -2)

    scene.add(fill, key, rim)

    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(2.2, 48),
      new THREE.MeshStandardMaterial({ color: highContrast ? 0x1e1e1e : 0xd5dce9, roughness: 0.9 })
    )
    floor.rotation.x = -Math.PI / 2
    floor.position.y = -0.05
    floor.receiveShadow = true
    scene.add(floor)

    const rig = createAvatar()
    rigRef.current = rig
    scene.add(rig.root)

    mountRef.current.appendChild(renderer.domElement)

    const animate = () => {
      const sceneLocal = sceneRef.current
      const cameraLocal = cameraRef.current
      const rendererLocal = rendererRef.current
      const rigLocal = rigRef.current
      if (!sceneLocal || !cameraLocal || !rendererLocal || !rigLocal) return

      const delta = Math.min(clockRef.current.getDelta(), 0.05)
      const smooth = Math.min(1, delta * 7)
      const now = performance.now()
      const speedScale = Math.max(0.7, Math.min(1.5, settings.translation.signSpeed || 1))
      const entryDuration = 220 / speedScale
      const holdDuration = 900 / speedScale
      const exitDuration = 220 / speedScale

      const phase = phaseRef.current
      const elapsed = now - phaseStartRef.current
      let target = targetPoseRef.current

      if (phase === 'entry') {
        const blend = easeInOutCubic(elapsed / entryDuration)
        target = blendPose(lastPoseRef.current, targetPoseRef.current, blend)
        if (elapsed >= entryDuration) {
          phaseRef.current = 'hold'
          phaseStartRef.current = now
          lastPoseRef.current = clonePose(targetPoseRef.current)
        }
      } else if (phase === 'hold') {
        target = targetPoseRef.current
        if (!activeLabelRef.current) {
          phaseRef.current = 'exit'
          phaseStartRef.current = now
          lastPoseRef.current = clonePose(targetPoseRef.current)
          targetPoseRef.current = clonePose(IDLE_POSE)
        }
      } else if (phase === 'exit') {
        const blend = easeInOutCubic(elapsed / exitDuration)
        target = blendPose(lastPoseRef.current, targetPoseRef.current, blend)
        if (elapsed >= exitDuration) {
          phaseRef.current = 'idle'
          lastPoseRef.current = clonePose(targetPoseRef.current)
        }
      }

      lerpEuler(rigLocal.leftShoulder, target.leftShoulder, smooth)
      lerpEuler(rigLocal.leftElbow, target.leftElbow, smooth)
      lerpEuler(rigLocal.leftWrist, target.leftWrist, smooth)
      lerpEuler(rigLocal.rightShoulder, target.rightShoulder, smooth)
      lerpEuler(rigLocal.rightElbow, target.rightElbow, smooth)
      lerpEuler(rigLocal.rightWrist, target.rightWrist, smooth)
      lerpEuler(rigLocal.head, target.head, smooth)
      lerpEuler(rigLocal.torso, target.torso, smooth)

      rigLocal.torso.position.y = phase === 'hold' ? 0 : Math.sin(clockRef.current.elapsedTime * 1.2) * 0.004
      rigLocal.head.position.y = 1.7 + (phase === 'hold' ? 0 : Math.sin(clockRef.current.elapsedTime * 1.4 + 0.4) * 0.003)

      rendererLocal.render(sceneLocal, cameraLocal)
      animationRef.current = requestAnimationFrame(animate)
    }

    animationRef.current = requestAnimationFrame(animate)

    const onResize = () => {
      if (!mountRef.current || !cameraRef.current || !rendererRef.current) return
      const width = mountRef.current.clientWidth
      const height = mountRef.current.clientHeight
      cameraRef.current.aspect = width / height
      cameraRef.current.updateProjectionMatrix()
      rendererRef.current.setSize(width, height)
    }

    window.addEventListener('resize', onResize)

    return () => {
      window.removeEventListener('resize', onResize)
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
        animationRef.current = null
      }
      if (mountRef.current && renderer.domElement.parentElement === mountRef.current) {
        mountRef.current.removeChild(renderer.domElement)
      }
      renderer.dispose()
      scene.clear()
    }
  }, [isVisible, highContrast])

  useEffect(() => {
    if (!isVisible) return
    const motionKey = `${activeIndex}:${activeLabel}`
    if (motionKey === lastMotionKeyRef.current) return
    lastMotionKeyRef.current = motionKey

    if (!activeLabel) {
      startMotion('', null)
      return
    }

    sequenceIndexRef.current = activeIndex >= 0 ? activeIndex : 0
    startMotion(activeLabel, activePrimitive)
    onSignComplete?.()
  }, [activeIndex, activeLabel, activePrimitive, isVisible, onSignComplete])

  useEffect(() => {
    if (!currentSign || !isVisible) return
    if (currentSignIndex !== undefined) return
    const normalizedCurrent = currentSign.toUpperCase()
    const primitiveIndex = signSequence.findIndex((label) => label.toUpperCase() === normalizedCurrent)
    const primitive = primitiveIndex >= 0 ? (primitiveSequence[primitiveIndex] || null) : null
    startMotion(normalizedCurrent, primitive)
  }, [currentSign, currentSignIndex, isVisible, primitiveSequence, signSequence])

  if (!isVisible) return null

  return (
    <div
      ref={mountRef}
      className={`w-full h-full rounded-3xl overflow-hidden transition-all duration-500 ${highContrast
        ? 'border-4 border-yellow-400 bg-black'
        : 'border border-white/15 shadow-xl'
      }`}
    />
  )
}

export default Avatar3D
