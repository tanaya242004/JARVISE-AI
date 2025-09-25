import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Grid, Effects, Environment, useGLTF } from '@react-three/drei'
import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import bgGif from './media/bg.gif'
import './index.css'
import cpmGif from './media/cpm.gif'



function playActivationSound() {
  // To avoid NotAllowedError, play sound only after user interaction
  if (document.hasFocus()) {
    const audio = new Audio('/media/jarvis-147563.mp3')
    audio.play().catch(err => console.error('Error playing activation sound', err))
  } else {
    // Defer playing sound until user clicks or presses a key
    const playOnInteraction = () => {
      const audio = new Audio('/media/jarvis-147563.mp3')
      audio.play().catch(err => console.error('Error playing activation sound', err))
      window.removeEventListener('click', playOnInteraction)
      window.removeEventListener('keydown', playOnInteraction)
    }
    window.addEventListener('click', playOnInteraction)
    window.addEventListener('keydown', playOnInteraction)
  }
}

function AnimatedBars({ analyser }) {
  const [values, setValues] = useState(() =>
    Array.from({ length: 60 }, () => 0)
  )
  useEffect(() => {
    if (!analyser) return
    const dataArray = new Uint8Array(analyser.frequencyBinCount)
    const id = setInterval(() => {
      analyser.getByteFrequencyData(dataArray)
      // Normalize values to 0-1 range
      const normalized = Array.from(dataArray).slice(0, 60).map(v => v / 255)
      setValues(normalized)
    }, 90)
    return () => clearInterval(id)
  }, [analyser])
  return (
    <div className="spectrum">
      <div className="spectrum-bars">
        {values.map((v, i) => (
          <div key={i} className="bar" style={{ height: `${10 + v * 90}%` }} />
        ))}
      </div>
    </div>
  )
}

function ClockWidget() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(id)
  }, [])
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  const date = now.toLocaleDateString([], { weekday: 'short', day: '2-digit', month: '2-digit' })
  return (
    <div className="hud-widget hud-round">
      <div>
        <div className="hud-clock-time">{time}</div>
        <div className="hud-clock-date">{date}</div>
      </div>
    </div>
  )
}

// removed honeycomb overlay

function DynamicRing() {
  const groupRef = useRef()
  const sweepRef = useRef()
  const orbitDotRef = useRef()

  const circleGeo = useMemo(() => new THREE.RingGeometry(2.4, 2.41, 256), [])
  const circleGeo2 = useMemo(() => new THREE.RingGeometry(2.0, 2.01, 256), [])
  const sweepGeo = useMemo(() => new THREE.RingGeometry(2.05, 2.35, 64, 1, 0, Math.PI / 4), [])
  const crosshairGeo = useMemo(() => {
    const positions = new Float32Array([
      -0.4, 0, 0, 0.4, 0, 0,
      0, -0.4, 0, 0, 0.4, 0,
    ])
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    return g
  }, [])

  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    if (groupRef.current) groupRef.current.rotation.x = Math.sin(t * 0.25) * 0.05
    if (sweepRef.current) sweepRef.current.rotation.z = -t * 0.8
    if (orbitDotRef.current) orbitDotRef.current.position.set(Math.cos(t) * 2.6, Math.sin(t) * 2.6, 0)
  })

  return (
    <group ref={groupRef} position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      {/* thin concentric circles */}
      <mesh geometry={circleGeo}>
        <meshBasicMaterial color="#ff8c3a" transparent opacity={0.4} side={THREE.DoubleSide} />
      </mesh>
      <mesh geometry={circleGeo2}>
        <meshBasicMaterial color="#ff7a1a" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>

      {/* rotating sweep arc */}
      <mesh ref={sweepRef} geometry={sweepGeo}>
        <meshBasicMaterial color="#ffa24c" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>

      {/* crosshair */}
      <lineSegments geometry={crosshairGeo}>
        <lineBasicMaterial color="#ffaa66" transparent opacity={0.7} />
      </lineSegments>

      {/* orbiting dot */}
      <mesh ref={orbitDotRef}>
        <circleGeometry args={[0.05, 16]} />
        <meshBasicMaterial color="#ffd1a3" />
      </mesh>
    </group>
  )
}

function Scene() {
  return (
    <>
      <Environment preset="city" background={false} />
      <Grid cellSize={0.8} sectionSize={12} sectionThickness={1} cellColor="#1b1b1b" sectionColor="#2a2a2a" fadeDistance={28} fadeStrength={2} infinite />
      <DynamicRing />
      <OrbitControls enablePan={false} minDistance={5} maxDistance={18} />
      <Effects />
    </>
  )
}

export default function App() {
  const [analyser, setAnalyser] = useState(null)
  const [listening, setListening] = useState(false)
  const [systemMessage, setSystemMessage] = useState('')
  const recognitionRef = useRef(null)
  const audioContextRef = useRef(null)
  const mediaStreamRef = useRef(null)

  useEffect(() => {
    if (!('webkitSpeechRecognition' in window || 'SpeechRecognition' in window)) {
      console.warn('Speech Recognition API not supported in this browser.')
      return
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    const recognition = new SpeechRecognition()
    recognitionRef.current = recognition
    recognition.continuous = true
    recognition.interimResults = false
    recognition.lang = 'en-US'

    recognition.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) {
          const transcript = event.results[i][0].transcript.trim().toLowerCase()
          if (transcript.includes('hello jarvis')) {
            if (!listening) {
              setListening(true)
              setSystemMessage('Jarvis Activated')
              navigator.mediaDevices.getUserMedia({ audio: true }).then(stream => {
                audioContextRef.current = new AudioContext()
                mediaStreamRef.current = stream
                const source = audioContextRef.current.createMediaStreamSource(stream)
                const analyserNode = audioContextRef.current.createAnalyser()
                analyserNode.fftSize = 128
                source.connect(analyserNode)
                setAnalyser(analyserNode)
                // Automatically stop after 10 seconds
                setTimeout(() => {
                  setListening(false)
                  setSystemMessage('')
                  if (recognitionRef.current) recognitionRef.current.stop()
                  if (audioContextRef.current) audioContextRef.current.close()
                  if (mediaStreamRef.current) {
                    mediaStreamRef.current.getTracks().forEach(track => track.stop())
                  }
                  setAnalyser(null)
                }, 10000)
              }).catch(err => {
                console.error('Error accessing microphone', err)
              })
              // Play activation sound
              playActivationSound()
            }
          } else if (transcript.includes('thank you jarvis')) {
            if (listening) {
              setListening(false)
              setSystemMessage('')
              if (recognitionRef.current) recognitionRef.current.stop()
              if (audioContextRef.current) audioContextRef.current.close()
              if (mediaStreamRef.current) {
                mediaStreamRef.current.getTracks().forEach(track => track.stop())
              }
              setAnalyser(null)
            }
          }
        }
      }
    }

    recognition.onerror = (event) => {
      console.error('Speech recognition error', event.error)
    }

    recognition.start()

    return () => {
      if (recognitionRef.current) recognitionRef.current.stop()
      if (audioContextRef.current) audioContextRef.current.close()
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [listening])

  return (
    <div className="app">
      <div className="bg-wrap">
        <img className="bg-media" src={bgGif} alt="background" />
      </div>
      <div className="canvas-wrap">
        <Canvas camera={{ position: [6, 6, 6], fov: 50 }} gl={{ alpha: true, antialias: true }} style={{ background: 'transparent' }}>
          <Suspense fallback={null}>
            <MinimalScene />
          </Suspense>
        </Canvas>
      </div>

      <div className="hud">
      <img src={cpmGif} alt="corner gif" className="corner-gif" />
        <div className="hud-grid" />
        <div className="hud-top">
          <ClockWidget />
          <div className="hud-widget">
            <div style={{ color: '#ffb000', fontSize: 12, marginBottom: 6 }}>STATUS</div>
            <div style={{ fontWeight: 700 }}>ONLINE</div>
          </div>
        </div>
        <div className="hud-bottom-left">
          <AnimatedBars analyser={analyser} />
        </div>
        <Reticle2D />
        <div className="glow-panel" />
      </div>

      {systemMessage && (
        <div className={`system-message-bottom-right ${systemMessage ? 'system-message-visible' : ''}`} aria-live="polite" role="alert">{systemMessage}</div>
      )}
    </div>
  )
}

function MinimalScene() {
  return (
    <>
      <Environment preset="city" background={false} />
      <Grid cellSize={0.8} sectionSize={12} sectionThickness={1} cellColor="#1b1b1b" sectionColor="#2a2a2a" fadeDistance={28} fadeStrength={2} infinite />
      <CenterModel />
      <Effects />
      <OrbitControls enablePan={false} enableZoom={false} enableRotate={false} />
    </>
  )
}

function CenterModel() {
  // Keep on-screen size and offset stable across resizes using viewport height
  const viewportHeight = useThree((s) => s.viewport.height)
  const baseRef = useRef({ height: null })
  if (baseRef.current.height == null) baseRef.current.height = viewportHeight

  // Tunables: base visual scale and offsets at initial mount
  const baseScale = 0.5
  const baseOffset = { x: 0.1, y: -1.3, z: 0 }

  // Derive invariant scale/position relative to current viewport
  const ratio = baseRef.current.height / viewportHeight
  const invariantScale = baseScale * ratio
  // When the viewport height is smaller than the initial (not fullscreen), nudge downward a bit
  const shrinkFactor = Math.max(0, 1 - Math.min(viewportHeight / baseRef.current.height, 1))
  const extraYOffset = -0.15 * (1 + ratio * 0.25) * shrinkFactor
  const invariantPosition = [
    baseOffset.x * ratio,
    baseOffset.y * ratio + extraYOffset,
    baseOffset.z,
  ]
  // Try loading a GLB at public/models/core.glb. Falls back to a TorusKnot if not found.
  let gltf
  try {
    // Public folder assets are served at root
    gltf = useGLTF('/models/core.glb')
  } catch (e) {
    gltf = null
  }

  if (gltf && gltf.scene) {
    return (
      <group position={invariantPosition} rotation={[-Math.PI / 2, 0, 0]} scale={invariantScale}>
        <primitive object={gltf.scene} />
      </group>
    )
  }

  return <CoreNode position={invariantPosition} scale={invariantScale} />
}

// Optional: Preload the model path so it loads as soon as possible
useGLTF.preload?.('/models/core.glb')

function CoreNode({ position = [0.1, -1.7, 0], scale = 0.5 }) {
  const group = useRef()
  const orbA = useRef()
  const orbB = useRef()
  const orbC = useRef()

  useFrame((state) => {
    const t = state.clock.getElapsedTime()
    if (group.current) group.current.rotation.z = t * 0.25
    if (orbA.current) orbA.current.position.set(Math.cos(t) * 1.8, Math.sin(t) * 1.2, 0)
    if (orbB.current) orbB.current.position.set(0, Math.cos(t * 0.8) * 1.6, Math.sin(t * 0.8) * 1.6)
    if (orbC.current) orbC.current.position.set(Math.sin(t * 1.3) * 1.4, 0, Math.cos(t * 1.3) * 1.4)
  })

  return (
    <group ref={group} position={position} rotation={[-Math.PI / 2, 0, 0]} scale={scale}>
      {/* Inner glow core */}
      <mesh>
        <icosahedronGeometry args={[0.7, 2]} />
        <meshStandardMaterial color="#ff8c3a" emissive="#ff5a00" emissiveIntensity={0.7} metalness={0.1} roughness={0.25} />
      </mesh>
      {/* Wireframe cage */}
      <mesh>
        <icosahedronGeometry args={[1.15, 0]} />
        <meshBasicMaterial color="#ffa24c" wireframe transparent opacity={0.45} />
      </mesh>
      {/* Orbiters */}
      <mesh ref={orbA}>
        <sphereGeometry args={[0.08, 16, 16]} />
        <meshBasicMaterial color="#ffd1a3" />
      </mesh>
      <mesh ref={orbB}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshBasicMaterial color="#ffc07a" />
      </mesh>
      <mesh ref={orbC}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshBasicMaterial color="#ffe0b8" />
      </mesh>
    </group>
  )
}

function Reticle2D() {
  return (
    <svg className="reticle" width="420" height="420" viewBox="0 0 420 420" fill="none">
      <defs>
        <linearGradient id="r" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="#ffb366" />
          <stop offset="100%" stopColor="#ff6a00" />
        </linearGradient>
      </defs>
      <g opacity="0.85">
        <circle cx="210" cy="210" r="150" stroke="url(#r)" strokeOpacity="0.15" />
        <circle cx="210" cy="210" r="115" stroke="url(#r)" strokeOpacity="0.25" />
        <circle cx="210" cy="210" r="80" stroke="url(#r)" strokeOpacity="0.35" />
      </g>
      <g className="rotate-slow" opacity="0.7">
        <path d="M210 110 A100 100 0 0 1 310 210" stroke="url(#r)" strokeWidth="2" />
        <path d="M210 310 A100 100 0 0 1 110 210" stroke="url(#r)" strokeWidth="2" />
      </g>
      <g opacity="0.8">
        <line x1="170" y1="210" x2="250" y2="210" stroke="#ff8c3a" />
        <line x1="210" y1="170" x2="210" y2="250" stroke="#ff8c3a" />
      </g>
      <g className="rotate-fast">
        <circle cx="310" cy="210" r="5" fill="#ffd1a3" />
      </g>
    </svg>
  )
}
