import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  Box,
  CheckCircle2,
  Compass,
  Play,
  Radio,
  RotateCcw,
  Sliders,
  Sparkles,
  Upload,
  Volume2,
  VolumeX,
  X,
  Zap,
} from 'lucide-react';
import {
  ARTIFACTS,
  ArtifactId,
  ArtifactInfo,
  CHALLENGE_DATA,
  MarkerId,
  ObjectivePhase,
  VisualLookConfig,
} from '../data/artifacts';
import { AudioManager } from '../engine/AudioManager';
import { LunarEngine, TelemetryData } from '../engine/LunarEngine';
import { ModelLoader } from '../engine/ModelLoader';

export interface DialogueMessage {
  speaker: string;
  text: string;
}

export function HasselbladReticle() {
  return (
    <div className="pointer-events-none fixed inset-0 z-10 overflow-hidden opacity-30">
      {/* Center Réseau Cross */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-6 h-6">
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-300/70 -translate-x-1/2" />
        <div className="absolute top-1/2 left-0 right-0 h-px bg-slate-300/70 -translate-y-1/2" />
      </div>
      {/* 4 Quadrant Réseau Crosses */}
      {[
        'left-1/4 top-1/4',
        'left-3/4 top-1/4',
        'left-1/4 top-3/4',
        'left-3/4 top-3/4',
      ].map((pos) => (
        <div key={pos} className={`absolute ${pos} -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5`}>
          <div className="absolute left-1/2 top-0 bottom-0 w-px bg-slate-400/60 -translate-x-1/2" />
          <div className="absolute top-1/2 left-0 right-0 h-px bg-slate-400/60 -translate-y-1/2" />
        </div>
      ))}
    </div>
  );
}

export function TitleScreen({
  onStart,
  isMuted,
  onToggleMute,
  onOpenModels,
  onOpenVisualTuner,
  visualConfig,
}: {
  onStart: () => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenModels: () => void;
  onOpenVisualTuner: () => void;
  visualConfig: VisualLookConfig;
}) {
  const highContrast = visualConfig.highContrastTitleScrim;

  return (
    <div
      className={`absolute inset-0 pointer-events-none flex flex-col justify-between p-8 md:p-12 z-20 transition-colors duration-300 ${
        highContrast
          ? 'bg-gradient-to-t from-black/90 via-black/45 to-black/25'
          : 'bg-transparent'
      }`}
    >
      {/* Top Bar */}
      <div className="flex justify-between items-center pointer-events-auto gap-4">
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 bg-amber-400 rounded-xs" />
          <span className="text-xs uppercase tracking-widest text-slate-200 font-mono-num font-semibold whitespace-nowrap">
            NOBOTARA-71 · HISTORIC SPACE SERIES
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenVisualTuner}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-amber-300 bg-slate-950/85 hover:bg-slate-900 border border-amber-500/50 rounded-md transition-colors cursor-pointer whitespace-nowrap"
            title="Inspect and tune the 3D visual & lighting fixes"
          >
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            <span>VISUAL FIXES</span>
          </button>

          <button
            onClick={onOpenModels}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-200 bg-slate-950/85 hover:bg-slate-900 border border-slate-700/80 rounded-md transition-colors cursor-pointer whitespace-nowrap"
            title="Import custom Blender 3D models"
          >
            <Box className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">3D MODELS</span>
          </button>

          <button
            onClick={onToggleMute}
            className="flex items-center gap-2 px-3 py-1.5 text-xs text-slate-200 bg-slate-950/85 hover:bg-slate-900 border border-slate-700/80 rounded-md transition-colors cursor-pointer whitespace-nowrap"
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            )}
            <span className="hidden sm:inline">{isMuted ? 'AUDIO OFF' : 'AUDIO ON'}</span>
          </button>
        </div>
      </div>

      {/* Main Hero Lockup */}
      <div className="max-w-2xl mt-auto mb-6">
        <div className="mb-4">
          <svg
            className="w-full max-w-lg h-auto"
            viewBox="0 0 520 80"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <text
              x="0"
              y="24"
              fill={highContrast ? '#fbbf24' : '#334155'}
              fontSize="13"
              letterSpacing="4"
              fontFamily="'Space Mono', monospace"
              fontWeight="bold"
            >
              MISSION 01 — JULY 20, 1969
            </text>
            <text
              x="0"
              y="68"
              fill={highContrast ? '#f8fafc' : '#0f172a'}
              fontSize="44"
              fontFamily="'Plus Jakarta Sans', sans-serif"
              fontWeight="800"
              letterSpacing="-1"
            >
              APOLLO 11
            </text>
          </svg>
        </div>

        <p
          className={`text-lg md:text-xl font-medium mb-3 tracking-wide ${
            highContrast ? 'text-amber-300' : 'text-amber-800'
          }`}
        >
          The mission that succeeded. The things it left behind.
        </p>

        <p
          className={`text-sm md:text-base leading-relaxed max-w-xl mb-8 ${
            highContrast ? 'text-slate-300' : 'text-slate-800'
          }`}
        >
          Pilot an autonomous lunar explorer rover across the Sea of Tranquility. Inspect the
          artifacts left behind at the historic landing site, discover the scientific reasons they
          remained, and conduct a live laser measurement between Earth and the Moon.
        </p>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 pointer-events-auto">
          <button
            onClick={onStart}
            className="flex items-center gap-3 px-8 py-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg shadow-lg transition-all duration-150 transform hover:-translate-y-0.5 active:translate-y-0 text-base tracking-wide cursor-pointer whitespace-nowrap"
          >
            <Play className="w-5 h-5 fill-slate-950" />
            <span>START MISSION</span>
          </button>
          <span
            className={`text-xs font-mono-num ${
              highContrast ? 'text-slate-400' : 'text-slate-700'
            }`}
          >
            Press [ENTER] or [SPACE] to launch
          </span>
        </div>
      </div>

      {/* Bottom Telemetry Strip */}
      <div
        className={`flex items-center justify-between text-xs font-mono-num border-t pt-4 ${
          highContrast ? 'text-slate-400 border-slate-800/80' : 'text-slate-800 border-slate-700/70'
        }`}
      >
        <span>SEA OF TRANQUILITY · 0.67408° N, 23.47297° E</span>
        <span>WASD Move · Space/E Interact · Esc Close</span>
      </div>
    </div>
  );
}

function VirtualJoystick({ onMove }: { onMove: (forward: number, turn: number) => void }) {
  const padRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);

  const updateStick = (clientX: number, clientY: number) => {
    if (!padRef.current) return;
    const rect = padRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = clientX - cx;
    const dy = clientY - cy;
    const dist = Math.hypot(dx, dy);
    let kx = dx;
    let ky = dy;
    if (dist > 48) {
      kx = (dx / dist) * 48;
      ky = (dy / dist) * 48;
    }
    setKnob({ x: kx, y: ky });
    onMove(-(ky / 48), -(kx / 48));
  };

  useEffect(() => {
    const handleUp = () => {
      if (dragging) {
        setDragging(false);
        setKnob({ x: 0, y: 0 });
        onMove(0, 0);
      }
    };
    window.addEventListener('pointerup', handleUp);
    return () => window.removeEventListener('pointerup', handleUp);
  }, [dragging, onMove]);

  return (
    <div className="relative select-none pointer-events-auto touch-none">
      <div
        ref={padRef}
        onPointerDown={(e) => {
          setDragging(true);
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          updateStick(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (dragging) updateStick(e.clientX, e.clientY);
        }}
        onPointerUp={() => {
          setDragging(false);
          setKnob({ x: 0, y: 0 });
          onMove(0, 0);
        }}
        className="w-28 h-28 rounded-full bg-slate-950/85 border-2 border-slate-700/80 flex items-center justify-center shadow-lg relative cursor-grab active:cursor-grabbing"
      >
        <div className="absolute top-2 text-[9px] font-mono-num text-slate-400 font-bold">W</div>
        <div className="absolute bottom-2 text-[9px] font-mono-num text-slate-400 font-bold">S</div>
        <div className="absolute left-2 text-[9px] font-mono-num text-slate-400 font-bold">A</div>
        <div className="absolute right-2 text-[9px] font-mono-num text-slate-400 font-bold">D</div>
        <div
          className="w-12 h-12 rounded-full bg-amber-500/90 border border-amber-300 shadow-md flex items-center justify-center transition-transform duration-75"
          style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
        >
          <div className="w-4 h-4 rounded-full bg-amber-200/50" />
        </div>
      </div>
      <div className="text-[10px] text-center text-slate-400 font-mono-num mt-1">JOYSTICK</div>
    </div>
  );
}

export function DialogueBox({
  message,
  typewriter,
  onTyped,
}: {
  message: DialogueMessage;
  typewriter: boolean;
  onTyped?: () => void;
}) {
  const [chars, setChars] = useState(typewriter ? 0 : message.text.length);
  const cbRef = useRef(onTyped);
  cbRef.current = onTyped;

  useEffect(() => {
    if (!typewriter) {
      setChars(message.text.length);
      return;
    }
    setChars(0);
    let idx = 0;
    let active = true;
    const timer = window.setInterval(() => {
      if (!active) return;
      idx += 1;
      if (idx % 4 === 1) AudioManager.playTypeBeep();
      if (idx >= message.text.length) {
        setChars(message.text.length);
        window.clearInterval(timer);
        cbRef.current?.();
      } else {
        setChars(idx);
      }
    }, 12);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [message.text, typewriter]);

  const visibleText = message.text.slice(0, chars);

  return (
    <div className="w-[min(36rem,calc(100vw-3rem))] bg-slate-950/92 border border-slate-700/80 rounded-lg p-4 shadow-xl">
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-slate-800">
        <div className="flex items-center gap-2">
          <Radio className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-bold font-mono-num text-amber-400 uppercase tracking-wider">
            {message.speaker}
          </span>
        </div>
        <span className="text-[10px] text-slate-400 font-mono-num">TRANSMISSION LINK ACTIVE</span>
      </div>
      <p className="relative text-sm md:text-base text-slate-100 font-medium leading-relaxed">
        {typewriter ? (
          <>
            <span className="invisible" aria-hidden="true">
              "{message.text}"
              <span className="dialogue-cursor" />
            </span>
            <span className="absolute inset-0">
              "{visibleText}"
              <span className="dialogue-cursor" aria-hidden="true" />
            </span>
          </>
        ) : (
          <>
            "{visibleText}"
            <span className="dialogue-cursor" aria-hidden="true" />
          </>
        )}
      </p>
    </div>
  );
}

export function ExplorationHUD({
  telemetry,
  nearArtifact,
  objective,
  laserCompleted,
  artifactsVisited,
  activeDialogue,
  onInteract,
  onJoystickMove,
  isMuted,
  onToggleMute,
  onOpenChallenge,
  canOpenChallenge,
  onOpenModels,
  onOpenVisualTuner,
  showJoystick = true,
  typeDialogue = false,
  onDialogueTyped,
}: {
  telemetry: TelemetryData;
  nearArtifact: MarkerId | null;
  objective: ObjectivePhase;
  laserCompleted: boolean;
  artifactsVisited: Record<ArtifactId, boolean>;
  activeDialogue: DialogueMessage | null;
  onInteract: () => void;
  onJoystickMove: (f: number, t: number) => void;
  isMuted: boolean;
  onToggleMute: () => void;
  onOpenChallenge: () => void;
  canOpenChallenge: boolean;
  onOpenModels: () => void;
  onOpenVisualTuner: () => void;
  showJoystick?: boolean;
  typeDialogue?: boolean;
  onDialogueTyped?: () => void;
}) {
  const visitedCount = Object.values(artifactsVisited).filter(Boolean).length;
  const artifactInfo =
    nearArtifact && nearArtifact !== 'laser_station' ? ARTIFACTS[nearArtifact] : null;

  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-4 md:p-6 z-10 overflow-hidden">
      {/* Top Row */}
      <div className="flex justify-between items-start gap-4 pointer-events-auto">
        <div className="bg-slate-950/90 border border-slate-800/80 rounded-lg p-3 max-w-sm">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-bold tracking-wider text-amber-400 font-mono-num uppercase">
              MISSION 01: APOLLO 11
            </span>
          </div>
          <div className="text-xs text-slate-300 font-mono-num flex items-center gap-2">
            <span>TRANQUILITY BASE</span>
            <span>·</span>
            <span>VEL: {telemetry.speed.toFixed(1)} m/s</span>
            <span>·</span>
            <span>HDG: {Math.round(telemetry.heading)}°</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="bg-slate-950/90 border border-slate-800/80 rounded-lg px-3 py-2 text-xs font-mono-num flex items-center gap-2">
            <span className="text-slate-400">ARTIFACTS:</span>
            <span
              className={`font-bold ${
                visitedCount === 3 ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {visitedCount}/3
            </span>
            {canOpenChallenge && (
              <button
                onClick={onOpenChallenge}
                className="ml-2 px-2.5 py-1 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded text-[11px] transition-colors cursor-pointer whitespace-nowrap"
              >
                SOLVE CHALLENGE
              </button>
            )}
          </div>

          <button
            onClick={onOpenVisualTuner}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-950/90 hover:bg-slate-900 border border-amber-500/50 rounded-lg text-xs font-mono-num text-amber-300 transition-colors cursor-pointer whitespace-nowrap"
            title="Adjust 3D lighting, regolith detail, and visual presets"
          >
            <Sliders className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">VISUAL FIXES</span>
          </button>

          <button
            onClick={onOpenModels}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-950/90 hover:bg-slate-900 border border-slate-800 rounded-lg text-xs font-mono-num text-slate-300 transition-colors cursor-pointer whitespace-nowrap"
            title="Replace 3D models with Blender assets"
          >
            <Box className="w-3.5 h-3.5 text-amber-400" />
            <span className="hidden sm:inline">3D MODELS</span>
          </button>

          <button
            onClick={onToggleMute}
            className="p-2.5 bg-slate-950/90 hover:bg-slate-900 border border-slate-800 rounded-lg text-slate-300 transition-colors cursor-pointer"
            title={isMuted ? 'Unmute Audio' : 'Mute Audio'}
          >
            {isMuted ? (
              <VolumeX className="w-4 h-4 text-rose-400" />
            ) : (
              <Volume2 className="w-4 h-4 text-emerald-400" />
            )}
          </button>
        </div>
      </div>

      {/* Center Top Objective Strip */}
      <div className="mx-auto bg-slate-950/90 border border-slate-800/80 rounded-lg px-4 py-1.5 flex items-center gap-4 text-xs font-mono-num text-slate-300 pointer-events-auto">
        <div className="flex items-center gap-1.5">
          <Compass className="w-3.5 h-3.5 text-emerald-400" />
          <span className="text-slate-400">ZONE:</span>
          <span className={`font-semibold ${nearArtifact ? 'text-emerald-300' : 'text-slate-200'}`}>
            {objective === 'free'
              ? nearArtifact === 'laser_station'
                ? 'LASER STATION [IN MARKER]'
                : artifactInfo
                ? `${artifactInfo.shortName} [IN MARKER]`
                : 'AREA MARKER'
              : {
                  lander: 'OBJECTIVE 1 · EAGLE DESCENT STAGE',
                  retroreflector: 'OBJECTIVE 2 · LASER RETROREFLECTOR',
                  laser: 'OBJECTIVE 3 · LASER RANGING',
                  plaque: 'OBJECTIVE 4 · COMMEMORATIVE PLAQUE',
                }[objective]}
          </span>
          {telemetry.distanceToTarget < 400 && (
            <span className="text-emerald-400 ml-1">
              ({telemetry.distanceToTarget.toFixed(1)}m)
            </span>
          )}
        </div>

        {objective === 'free' && (
          <>
            <div className="h-3 w-px bg-slate-800" />
            <div className="flex items-center gap-2 text-[11px]">
              <span
                className={
                  artifactsVisited.descent_stage ? 'text-emerald-400' : 'text-slate-400'
                }
              >
                Descent Stage {artifactsVisited.descent_stage && '✓'}
              </span>
              <span>·</span>
              <span
                className={
                  artifactsVisited.retroreflector ? 'text-emerald-400' : 'text-slate-400'
                }
              >
                Retroreflector {artifactsVisited.retroreflector && '✓'}
              </span>
              <span>·</span>
              <span className={laserCompleted ? 'text-emerald-400' : 'text-slate-400'}>
                Laser {laserCompleted && '✓'}
              </span>
              <span>·</span>
              <span className={artifactsVisited.plaque ? 'text-emerald-400' : 'text-slate-400'}>
                Plaque {artifactsVisited.plaque && '✓'}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Bottom Row */}
      <div className="flex justify-between items-end gap-4 pointer-events-auto">
        <div className="flex flex-col items-start gap-3">
          {activeDialogue && (
            <div className="mb-12">
              <DialogueBox
                message={activeDialogue}
                typewriter={typeDialogue}
                onTyped={onDialogueTyped}
              />
            </div>
          )}
          {showJoystick && (
            <div className="ml-6 mb-4 bg-slate-950/85 border border-slate-800/80 rounded-2xl p-2.5">
              <VirtualJoystick onMove={onJoystickMove} />
            </div>
          )}
        </div>

        {objective === 'free' && (artifactInfo || nearArtifact === 'laser_station') && (
          <div className="flex flex-col items-end gap-2 animate-bounce-subtle">
            <div className="flex items-center gap-2 px-3 py-1 bg-emerald-950/90 border border-emerald-500/60 rounded-md text-[11px] font-mono-num text-emerald-300 shadow-lg">
              <span>MARKER ZONE ENTERED</span>
            </div>
            <button
              onClick={onInteract}
              className="flex items-center gap-3 px-6 py-3.5 bg-emerald-500 hover:bg-emerald-400 active:bg-emerald-600 text-slate-950 font-bold rounded-lg shadow-xl text-sm md:text-base transition-all transform hover:-translate-y-0.5 cursor-pointer"
            >
              <span className="px-2 py-0.5 bg-slate-950 text-emerald-400 rounded text-xs font-mono-num font-bold">
                PRESS E
              </span>
              <span>
                {nearArtifact === 'laser_station'
                  ? 'FIRE LASER'
                  : artifactInfo?.actionLabel.toUpperCase()}
              </span>
            </button>
            <span className="text-xs text-emerald-300/80 font-mono-num">
              Press [SPACE] or [E] to begin
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function PlaqueCallout({
  readPoint,
}: {
  readPoint: () => { x: number; y: number; visible: boolean } | undefined;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const lineRef = useRef<SVGLineElement>(null);
  const dotRef = useRef<SVGCircleElement>(null);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      const pt = readPoint();
      const img = imgRef.current;
      const line = lineRef.current;
      const dot = dotRef.current;
      if (pt?.visible && img && line && dot) {
        const rect = img.getBoundingClientRect();
        const x1 = rect.right - rect.width * 0.08;
        const y1 = rect.top + rect.height * 0.42;
        line.setAttribute('x1', String(x1));
        line.setAttribute('y1', String(y1));
        line.setAttribute('x2', String(pt.x));
        line.setAttribute('y2', String(pt.y));
        dot.setAttribute('cx', String(pt.x));
        dot.setAttribute('cy', String(pt.y));
        line.style.opacity = '1';
        dot.style.opacity = '1';
      } else if (line && dot) {
        line.style.opacity = '0';
        dot.style.opacity = '0';
      }
      raf = requestAnimationFrame(update);
    };
    raf = requestAnimationFrame(update);
    return () => cancelAnimationFrame(raf);
  }, [readPoint]);

  return (
    <>
      <svg className="fixed inset-0 z-20 h-full w-full pointer-events-none" aria-hidden="true">
        <line ref={lineRef} stroke="#f8fafc" strokeWidth="1.5" strokeLinecap="round" />
        <circle ref={dotRef} r="4.5" fill="#f8fafc" />
      </svg>
      <img
        ref={imgRef}
        src="/assets/images/apollo11-plaque.jpg"
        referrerPolicy="no-referrer"
        alt="Apollo 11 commemorative plaque with Earth hemispheres and signatures"
        className="pointer-events-none w-[min(22rem,46vw)] max-h-[40vh] origin-bottom-left -rotate-6 rounded-md border border-slate-200/90 bg-slate-100 object-contain shadow-2xl"
      />
    </>
  );
}

export function InspectOverlay({
  artifact,
  dialogue,
  narrationDone,
  onTyped,
  onClose,
  readPlaquePoint,
}: {
  artifact: ArtifactInfo;
  dialogue: DialogueMessage | null;
  narrationDone: boolean;
  onTyped: () => void;
  onClose: () => void;
  readPlaquePoint?: () => { x: number; y: number; visible: boolean } | undefined;
}) {
  const [playingStep, setPlayingStep] = useState(false);

  return (
    <div className="absolute left-6 bottom-16 z-30 flex flex-col items-start gap-3 pointer-events-none">
      {artifact.id === 'plaque' && readPlaquePoint && (
        <PlaqueCallout readPoint={readPlaquePoint} />
      )}
      {dialogue && (
        <div className="pointer-events-auto">
          <DialogueBox message={dialogue} typewriter={!narrationDone} onTyped={onTyped} />
        </div>
      )}
      {narrationDone && artifact.id === 'plaque' && (
        <div className="pointer-events-auto w-[min(36rem,calc(100vw-3rem))] bg-slate-950/92 border border-slate-700/80 rounded-lg p-4 text-center space-y-3">
          <div className="text-[11px] font-mono-num text-slate-400">
            STAINLESS STEEL INSCRIPTION
          </div>
          <div className="text-sm md:text-base font-bold tracking-wider text-slate-100 font-mono-num leading-relaxed">
            HERE MEN FROM THE PLANET EARTH
            <br />
            FIRST SET FOOT UPON THE MOON
            <br />
            JULY 1969, A.D.
            <br />
            WE CAME IN PEACE FOR ALL MANKIND
          </div>
          <button
            onClick={() => {
              setPlayingStep(true);
              AudioManager.speakDialogue(
                "That's one small step for man, one giant leap for mankind.",
                'Neil Armstrong (Narrator-01)',
                () => setPlayingStep(false)
              );
            }}
            disabled={playingStep}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs cursor-pointer"
          >
            <Volume2 className="w-4 h-4" />
            {playingStep ? 'PLAYING HISTORIC AUDIO...' : "LISTEN: THAT'S ONE SMALL STEP"}
          </button>
        </div>
      )}
      {narrationDone && (
        <button
          onClick={onClose}
          className="pointer-events-auto flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-sm cursor-pointer"
        >
          <span>RESUME EXPLORATION</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}

export function LaserRangingOverlay({
  isLaserFiring,
  onFire,
  onContinue,
}: {
  isLaserFiring: boolean;
  onFire: () => void;
  onContinue: () => void;
}) {
  const [hasFired, setHasFired] = useState(false);
  const [completed, setCompleted] = useState(false);

  useEffect(() => {
    if (hasFired && !isLaserFiring) {
      setCompleted(true);
    }
  }, [hasFired, isLaserFiring]);

  return (
    <div className="absolute bottom-28 left-6 z-30 w-[min(32rem,calc(100vw-3rem))] pointer-events-auto">
      <div className="bg-slate-950/92 border border-emerald-700/70 rounded-xl p-4 shadow-2xl">
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-sm font-bold text-emerald-300 font-mono-num uppercase tracking-wide">
            Lunar Laser Ranging
          </h3>
        </div>
        <p className="text-sm text-slate-200 leading-relaxed mb-4">
          {completed
            ? 'The pulse left Earth, struck the retroreflector, and returned.'
            : isLaserFiring
            ? 'Transmitting a 532 nm pulse from McDonald Observatory.'
            : 'The reflector and Earth are in view. Fire the ranging laser.'}
        </p>

        {completed && (
          <div className="grid grid-cols-3 gap-2 mb-4 text-xs font-mono-num bg-slate-900/80 border border-emerald-900/60 p-3 rounded-lg">
            <div>
              <span className="text-slate-400 text-[10px]">ROUND-TRIP TIME</span>
              <div className="text-emerald-300 font-bold text-sm">2.56448 s</div>
            </div>
            <div>
              <span className="text-slate-400 text-[10px]">MEASURED DISTANCE</span>
              <div className="text-emerald-300 font-bold text-sm">384,402.1 km</div>
            </div>
            <div>
              <span className="text-slate-400 text-[10px]">ORBITAL RECESSION</span>
              <div className="text-emerald-300 font-bold text-sm">+3.8 cm / year</div>
            </div>
          </div>
        )}

        {completed ? (
          <button
            onClick={onContinue}
            className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-sm cursor-pointer"
          >
            <span>CONTINUE</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        ) : (
          <button
            onClick={() => {
              if (!hasFired) {
                setHasFired(true);
                onFire();
              }
            }}
            disabled={hasFired}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-60 text-slate-950 font-bold rounded-lg text-sm cursor-pointer"
          >
            <Zap className="w-4 h-4" />
            <span>{isLaserFiring ? 'TRANSMITTING...' : 'FIRE LASER'}</span>
          </button>
        )}
      </div>
    </div>
  );
}

export function ChallengeModal({ onComplete }: { onComplete: () => void }) {
  const [matches, setMatches] = useState<Record<string, string>>({});
  const [selectedArtifact, setSelectedArtifact] = useState<ArtifactId | null>('descent_stage');
  const [verified, setVerified] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const artifacts = CHALLENGE_DATA.artifacts;
  const reasons = CHALLENGE_DATA.reasons;

  const handleSelectReason = (reasonId: string) => {
    if (!selectedArtifact) return;
    AudioManager.playClickSound();
    const updated = { ...matches, [selectedArtifact]: reasonId };
    setMatches(updated);
    setErrorMsg(null);

    const nextUnmatched = artifacts.find((a) => !updated[a.id]);
    setSelectedArtifact(nextUnmatched ? nextUnmatched.id : null);

    if (Object.keys(updated).length === 3) {
      const ok =
        updated.descent_stage === 'reason_descent' &&
        updated.retroreflector === 'reason_retro' &&
        updated.plaque === 'reason_plaque';
      if (ok) {
        setVerified(true);
        AudioManager.playSuccessChime();
      } else {
        setErrorMsg(
          'One or more matches are incorrect. Review the historical mission facts and adjust your selections.'
        );
      }
    }
  };

  const handleClearArtifact = (id: ArtifactId) => {
    const next = { ...matches };
    delete next[id];
    setMatches(next);
    setSelectedArtifact(id);
    setVerified(false);
    setErrorMsg(null);
  };

  return (
    <div className="absolute inset-0 bg-slate-950/85 flex items-center justify-center p-4 md:p-8 z-30 pointer-events-auto">
      <div className="bg-slate-900 border border-slate-700 max-w-2xl w-full rounded-xl p-6 md:p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2 border-b border-slate-800 pb-5">
          <div className="text-xs font-mono-num font-bold text-amber-400 tracking-wider">
            PHASE 3 · LOGIC CHALLENGE
          </div>
          <h2 className="text-xl md:text-2xl font-bold text-slate-100">
            Why did these objects remain on the Moon?
          </h2>
          <p className="text-xs md:text-sm text-slate-400 max-w-md mx-auto">
            Match each historical Apollo 11 artifact with the factual reason it was left behind at
            Tranquility Base.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-3">
            <div className="text-xs font-mono-num text-slate-400 font-semibold mb-1">
              1. SELECT ARTIFACT
            </div>
            {artifacts.map((art) => {
              const matchedReasonId = matches[art.id];
              const matchedReason = reasons.find((r) => r.id === matchedReasonId);
              const isSelected = selectedArtifact === art.id;
              return (
                <div
                  key={art.id}
                  onClick={() => setSelectedArtifact(art.id)}
                  className={`p-3.5 rounded-lg border text-left cursor-pointer transition-all ${
                    isSelected
                      ? 'border-amber-400 bg-amber-500/10'
                      : matchedReason
                      ? 'border-emerald-700/70 bg-emerald-950/20'
                      : 'border-slate-700 bg-slate-800/60 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-slate-100">{art.name}</span>
                    {matchedReason && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleClearArtifact(art.id);
                        }}
                        className="text-[11px] font-mono-num text-slate-400 hover:text-rose-400"
                      >
                        CHANGE
                      </button>
                    )}
                  </div>
                  {matchedReason && (
                    <div className="mt-2 text-xs text-emerald-300 leading-snug">
                      → {matchedReason.text}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="space-y-3">
            <div className="text-xs font-mono-num text-slate-400 font-semibold mb-1">
              2. ASSIGN HISTORICAL PURPOSE
            </div>
            {reasons.map((r) => {
              const used = Object.values(matches).includes(r.id);
              return (
                <button
                  key={r.id}
                  disabled={!selectedArtifact}
                  onClick={() => handleSelectReason(r.id)}
                  className={`w-full p-3.5 rounded-lg border text-left text-xs md:text-sm leading-relaxed transition-all cursor-pointer ${
                    used
                      ? 'border-slate-800 bg-slate-900/40 text-slate-500'
                      : 'border-slate-700 bg-slate-800 hover:border-amber-400/70 text-slate-200'
                  }`}
                >
                  {r.text}
                </button>
              );
            })}
          </div>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-700/60 text-xs text-rose-200 text-center">
            {errorMsg}
          </div>
        )}

        {verified && (
          <div className="p-4 rounded-xl bg-emerald-950/40 border border-emerald-600/60 text-center space-y-3">
            <div className="flex items-center justify-center gap-2 text-emerald-400 font-mono-num text-xs font-bold">
              <CheckCircle2 className="w-4 h-4" />
              <span>CHALLENGE VERIFIED · MISSION COMPLETE</span>
            </div>
            <p className="text-xs md:text-sm text-slate-300 max-w-lg mx-auto">
              All three artifacts are correctly understood: the Descent Stage provided the launch
              platform to leave the Moon, the Retroreflector still bounces photons today, and the
              Plaque preserves humanity's message of peace.
            </p>
            <button
              onClick={onComplete}
              className="inline-flex items-center gap-2 px-8 py-3.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-sm transition-transform transform hover:-translate-y-0.5 cursor-pointer"
            >
              <span>PROCEED TO MISSION OUTRO</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export function OutroScreen({
  onReplay,
  outroProgress,
}: {
  onReplay: () => void;
  outroProgress: number;
}) {
  const showCard = outroProgress > 0.55;
  return (
    <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-8 md:p-12 z-20">
      <div className="flex justify-between items-center">
        <div className="bg-slate-950/80 border border-slate-800 rounded-lg px-4 py-2 text-xs font-mono-num text-slate-300">
          <span>MISSION 01: APOLLO 11 · COMPLETE</span>
        </div>
      </div>

      {showCard && (
        <div className="max-w-xl mx-auto my-auto bg-slate-950/90 border border-slate-700/80 rounded-2xl p-6 md:p-8 shadow-2xl text-center space-y-5 pointer-events-auto transition-all duration-700">
          <div className="inline-flex items-center gap-2 text-xs font-mono-num text-amber-300">
            <Sparkles className="w-3.5 h-3.5" />
            <span>TRANSITION TO DEEP SPACE</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-slate-100">Beyond the Moon</h2>
          <p className="text-sm md:text-base text-slate-300 leading-relaxed">
            The footprints at Tranquility Base proved that humanity could leave Earth. But our
            journey didn't stop at the Moon. We aimed further—beyond the planets, into interstellar
            space.
          </p>
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-xl text-left space-y-1">
            <div className="text-[11px] font-mono-num text-amber-400 font-bold">
              UPCOMING · MISSION 02
            </div>
            <div className="text-lg font-bold text-slate-100">VOYAGER 1: The Golden Record</div>
            <div className="text-xs text-slate-400">
              Traverse the edge of the heliosphere carrying humanity's sights, sounds, and
              greetings to the stars.
            </div>
          </div>
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              onClick={onReplay}
              className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-100 font-bold rounded-lg text-sm transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
              <span>REPLAY MISSION 01</span>
            </button>
          </div>
        </div>
      )}

      <div className="text-center text-xs text-slate-400 font-mono-num">
        {showCard ? (
          <span>VOYAGER 1 INTERSTELLAR PROBE · 24 BILLION KM FROM EARTH</span>
        ) : (
          <span>DEPARTING SEA OF TRANQUILITY · ACCELERATING TO DEEP SPACE...</span>
        )}
      </div>
    </div>
  );
}

const CUSTOM_SLOTS = [
  {
    type: 'rover',
    label: 'Lunar Explorer Rover',
    defaultFilename: 'public/models/rover.glb',
    description:
      'Player vehicle. Name wheel meshes with "wheel" or "tire" (e.g. Wheel_FL, Wheel_FR) for auto-rolling.',
  },
  {
    type: 'descent_stage',
    label: 'Eagle Descent Stage',
    defaultFilename: 'public/models/descent_stage.glb',
    description:
      'Apollo 11 lunar module base with 4 landing legs, ladder, and descent engine bell.',
  },
  {
    type: 'retroreflector',
    label: 'Laser Retroreflector (LRRR)',
    defaultFilename: 'public/models/retroreflector.glb',
    description: '100-prism corner cube pallet tilted towards Earth in the lunar sky.',
  },
  {
    type: 'voyager',
    label: 'Voyager 1 Interstellar Probe',
    defaultFilename: 'public/models/voyager.glb',
    description:
      'Phase 4 outro subject featuring the Golden Record, dish antenna, and magnetometer boom.',
  },
];

export function ModelsModal({
  engine,
  onClose,
}: {
  engine: LunarEngine | null;
  onClose: () => void;
}) {
  const [loadingSlot, setLoadingSlot] = useState<string | null>(null);
  const [status, setStatus] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [activeSlots, setActiveSlots] = useState<Record<string, boolean>>(
    engine?.getCustomActiveModels() ?? {}
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const targetSlotRef = useRef<string | null>(null);

  const handlePickSlot = (slotType: string) => {
    targetSlotRef.current = slotType;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    const slot = targetSlotRef.current;
    if (!file || !slot || !engine) return;
    if (!file.name.toLowerCase().endsWith('.glb') && !file.name.toLowerCase().endsWith('.gltf')) {
      setStatus({ type: 'error', text: 'Please select a glTF 2.0 file (.glb or .gltf)' });
      return;
    }
    setLoadingSlot(slot);
    setStatus(null);
    try {
      const loaded = await ModelLoader.loadFromFile(file, slot);
      engine.replaceModel(slot, loaded.scene, loaded.wheels);
      setActiveSlots((prev) => ({ ...prev, [slot]: true }));
      const wheelNote = loaded.wheels ? ` (${loaded.wheels.length} animated wheels detected)` : '';
      setStatus({
        type: 'success',
        text: `Loaded custom model for ${slot.replace('_', ' ')}${wheelNote}!`,
      });
    } catch (err) {
      setStatus({
        type: 'error',
        text: `Failed to load ${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`,
      });
    } finally {
      setLoadingSlot(null);
    }
  };

  const handleResetSlot = (slot: string) => {
    if (!engine) return;
    engine.resetModel(slot);
    setActiveSlots((prev) => ({ ...prev, [slot]: false }));
    setStatus({ type: 'success', text: `Reset ${slot.replace('_', ' ')} to procedural default.` });
  };

  return (
    <div className="absolute inset-0 bg-slate-950/85 flex items-center justify-center p-4 md:p-8 z-40 pointer-events-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        <div className="p-5 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900/95 z-10">
          <div className="flex items-center gap-3">
            <Box className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-lg font-bold text-slate-100">
                Custom 3D Models (Blender Integration)
              </h2>
              <p className="text-xs text-slate-400 font-mono-num">
                IMPORT .GLB / .GLTF ASSETS DIRECTLY INTO THE 3D GAME
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept=".glb,.gltf"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="p-5 space-y-4">
          {status && (
            <div
              className={`p-3 rounded-lg border text-xs font-mono-num ${
                status.type === 'success'
                  ? 'bg-emerald-950/50 border-emerald-700 text-emerald-300'
                  : 'bg-rose-950/50 border-rose-700 text-rose-300'
              }`}
            >
              {status.text}
            </div>
          )}

          <div className="space-y-3">
            {CUSTOM_SLOTS.map((slot) => {
              const isCustom = !!activeSlots[slot.type];
              return (
                <div
                  key={slot.type}
                  className="p-4 rounded-lg bg-slate-950/70 border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-slate-100">{slot.label}</span>
                      <span className="text-[11px] font-mono-num text-slate-400">
                        · {isCustom ? 'GLB Model Active' : 'Procedural Default'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400">{slot.description}</p>
                    <div className="text-[11px] font-mono-num text-amber-400/80">
                      Auto-loads from: <code>{slot.defaultFilename}</code>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handlePickSlot(slot.type)}
                      disabled={loadingSlot === slot.type}
                      className="flex items-center gap-1.5 px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs cursor-pointer whitespace-nowrap"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>{loadingSlot === slot.type ? 'LOADING...' : 'UPLOAD .GLB'}</span>
                    </button>
                    {isCustom && (
                      <button
                        onClick={() => handleResetSlot(slot.type)}
                        className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs cursor-pointer"
                      >
                        RESET
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
