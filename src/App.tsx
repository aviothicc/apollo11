/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ChallengeModal,
  DialogueMessage,
  ExplorationHUD,
  HasselbladReticle,
  InspectOverlay,
  LaserRangingOverlay,
  ModelsModal,
  OutroScreen,
  TitleScreen,
} from './components/GameOverlays';
import { VisualLookModal } from './components/VisualLookModal';
import {
  ARTIFACTS,
  ArtifactId,
  GamePhase,
  getVisibleMarkersForObjective,
  MarkerId,
  OBJECTIVE_TO_MARKER,
  ObjectivePhase,
  VISUAL_PRESETS,
  VisualLookConfig,
} from './data/artifacts';
import { AudioManager } from './engine/AudioManager';
import { InputManager } from './engine/InputManager';
import { LunarEngine, TelemetryData } from './engine/LunarEngine';

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<LunarEngine | null>(null);
  const readPlaquePoint = useCallback(() => engineRef.current?.plaqueScreenPoint, []);

  const phaseRef = useRef<GamePhase>('title');
  const lockRoverRef = useRef(true);
  const introCancelRef = useRef({ cancelled: false });
  const autoTriggeredRef = useRef(false);
  const narrationStateRef = useRef<{ cancelled: boolean; step: 'neil' | 'scientific' }>({
    cancelled: false,
    step: 'neil',
  });

  const [phase, setPhase] = useState<GamePhase>('title');
  phaseRef.current = phase;

  const [isMuted, setIsMuted] = useState(false);
  const [modelsOpen, setModelsOpen] = useState(false);
  const [visualTunerOpen, setVisualTunerOpen] = useState(false);
  const [visualConfig, setVisualConfig] = useState<VisualLookConfig>({
    ...VISUAL_PRESETS.apollo_1969,
  });

  const [nearArtifact, setNearArtifact] = useState<MarkerId | null>(null);
  const [objective, setObjective] = useState<ObjectivePhase>('lander');
  const [interactionLocked, setInteractionLocked] = useState(false);
  const [isRangingMode, setIsRangingMode] = useState(false);
  const [laserCompleted, setLaserCompleted] = useState(false);
  const [narrationDone, setNarrationDone] = useState(false);
  const [inspectedArtifact, setInspectedArtifact] = useState<ArtifactId | null>(null);
  const [isLaserFiring, setIsLaserFiring] = useState(false);
  const [artifactsVisited, setArtifactsVisited] = useState<Record<ArtifactId, boolean>>({
    descent_stage: false,
    retroreflector: false,
    plaque: false,
  });
  const [telemetry, setTelemetry] = useState<TelemetryData>({
    speed: 0,
    heading: 0,
    distanceToTarget: 10,
    nearestArtifact: null,
    position: { x: 8, y: 0, z: 7 },
  });
  const [activeDialogue, setActiveDialogue] = useState<DialogueMessage | null>(null);
  const [isBootingRover, setIsBootingRover] = useState(false);
  const [outroProgress, setOutroProgress] = useState(0);

  lockRoverRef.current =
    phase === 'intro' ||
    phase === 'inspect' ||
    isRangingMode ||
    interactionLocked ||
    isBootingRover ||
    (phase === 'explore' && activeDialogue !== null);

  useEffect(() => {
    if (!mountRef.current) return;
    const engine = new LunarEngine(mountRef.current);
    engineRef.current = engine;

    engine.onTelemetryUpdate = (data) => {
      setTelemetry(data);
      AudioManager.updateRoverSpeed(data.speed / 10.4);
    };
    engine.onNearArtifact = (id) => {
      setNearArtifact(id);
    };
    engine.onRoverBootComplete = () => setIsBootingRover(false);
    engine.onIntroCameraSettled = () => {
      engine.beginRoverBoot();
      setIsBootingRover(engine.isRoverBooting());
      setPhase('explore');
    };

    let raf = 0;
    const pollInputs = () => {
      if (engineRef.current) {
        if (lockRoverRef.current) {
          engineRef.current.setRoverInputs(0, 0);
        } else {
          const { forward, turn } = InputManager.getInputs();
          engineRef.current.setRoverInputs(forward, turn);
        }
      }
      raf = requestAnimationFrame(pollInputs);
    };
    raf = requestAnimationFrame(pollInputs);

    return () => {
      cancelAnimationFrame(raf);
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    engineRef.current?.setArtifactsVisited(artifactsVisited);
  }, [artifactsVisited]);

  useEffect(() => {
    engineRef.current?.setVisibleMarkers(getVisibleMarkersForObjective(objective));
  }, [objective]);

  useEffect(() => {
    if (!engineRef.current) return;
    if (isRangingMode) {
      engineRef.current.setCameraMode({ mode: 'ranging' });
    } else if (phase === 'title') {
      engineRef.current.setCameraMode({ mode: 'title' });
    } else if (phase === 'intro') {
      engineRef.current.beginIntroFlyby();
    } else if (phase === 'explore') {
      engineRef.current.setCameraMode({ mode: 'explore' });
    } else if (phase === 'inspect' && inspectedArtifact) {
      engineRef.current.setCameraMode({ mode: 'inspect', targetArtifact: inspectedArtifact });
    } else if (phase === 'outro') {
      engineRef.current.setCameraMode({ mode: 'outro', outroProgress: 0 });
    }
  }, [phase, inspectedArtifact, isRangingMode]);

  const handleVisualConfigChange = (next: VisualLookConfig) => {
    setVisualConfig(next);
    engineRef.current?.applyVisualConfig(next);
  };

  const stopRoverForEvent = () => {
    lockRoverRef.current = true;
    setInteractionLocked(true);
    InputManager.setVirtualJoystick(0, 0);
    engineRef.current?.setRoverInputs(0, 0);
  };

  const enterLaserRanging = () => {
    stopRoverForEvent();
    setIsRangingMode(true);
  };

  const exitLaserRanging = () => {
    setIsRangingMode(false);
    setInteractionLocked(false);
    setLaserCompleted(true);
    autoTriggeredRef.current = false;
    setObjective((prev) => (prev === 'laser' ? 'plaque' : prev));
  };

  const startMission = () => {
    AudioManager.init();
    introCancelRef.current = { cancelled: false };
    setPhase('intro');
    InputManager.setVirtualJoystick(0, 0);
    setActiveDialogue({
      speaker: 'Neil Armstrong (Narrator-01)',
      text: 'Hey, Neil Armstrong here. On July 16, 1969, we rode a Saturn V built from math, sweat, and nerve. 384,000 km to test physics where mistakes could kill. We didn’t just chase a rock in the sky; we went to learn what people can do when they dare.',
    });
  };

  const handleIntroDialogueTyped = () => {
    if (!introCancelRef.current.cancelled && activeDialogue) {
      AudioManager.speakDialogue(
        activeDialogue.text,
        activeDialogue.speaker,
        () => {
          setActiveDialogue(null);
        },
        'intro_neil'
      );
    }
  };

  const skipIntroCinematic = () => {
    introCancelRef.current.cancelled = true;
    AudioManager.stopSpeaking();
    setActiveDialogue(null);
    engineRef.current?.cancelIntroFlyby();
    engineRef.current?.snapRoverReady();
    engineRef.current?.snapExploreCamera();
    setIsBootingRover(false);
    setPhase('explore');
    engineRef.current?.setCameraMode({ mode: 'explore' });
  };

  const inspectArtifact = (id: ArtifactId) => {
    setInspectedArtifact(id);
    setPhase('inspect');
    setArtifactsVisited((prev) => ({ ...prev, [id]: true }));
    const info = ARTIFACTS[id];
    narrationStateRef.current.cancelled = true;
    narrationStateRef.current = { cancelled: false, step: 'neil' };
    setNarrationDone(false);
    AudioManager.stopSpeaking();
    setActiveDialogue({
      speaker: 'Neil Armstrong (Narrator-01)',
      text: info.neilQuote,
    });
  };

  const handleInspectDialogueTyped = () => {
    const state = narrationStateRef.current;
    if (state.cancelled || !inspectedArtifact) return;
    const info = ARTIFACTS[inspectedArtifact];
    const currentStep = state.step;
    AudioManager.speakDialogue(
      currentStep === 'neil' ? info.neilQuote : info.scientificQuote,
      currentStep === 'neil' ? 'Neil Armstrong (Narrator-01)' : 'Scientific Voice',
      () => {
        if (state.cancelled || narrationStateRef.current !== state || state.step !== currentStep) {
          return;
        }
        if (currentStep === 'neil') {
          state.step = 'scientific';
          setActiveDialogue({
            speaker: 'Scientific Voice',
            text: info.scientificQuote,
          });
        } else {
          setNarrationDone(true);
        }
      },
      `${info.id}_${currentStep}`
    );
  };

  const closeInspection = () => {
    narrationStateRef.current.cancelled = true;
    AudioManager.stopSpeaking();
    setActiveDialogue(null);
    const finishedId = inspectedArtifact;
    setInspectedArtifact(null);
    setPhase('explore');
    setInteractionLocked(false);
    autoTriggeredRef.current = false;

    if (objective !== 'free' && finishedId) {
      if (finishedId === 'descent_stage') setObjective('retroreflector');
      else if (finishedId === 'retroreflector') setObjective('laser');
      else if (finishedId === 'plaque') setObjective('free');
    }
  };

  useEffect(() => {
    InputManager.setCallbacks(
      () => {
        if (phase === 'title') {
          startMission();
        } else if (phase === 'explore' && objective === 'free' && nearArtifact) {
          if (nearArtifact === 'laser_station') enterLaserRanging();
          else inspectArtifact(nearArtifact);
        }
      },
      () => {
        if (phase === 'intro') skipIntroCinematic();
        else if (phase === 'inspect') closeInspection();
      }
    );
  }, [phase, nearArtifact, objective]);

  useEffect(() => {
    if (phase !== 'explore' || objective === 'free' || autoTriggeredRef.current) return;
    const targetMarker = OBJECTIVE_TO_MARKER[objective];
    if (nearArtifact === targetMarker) {
      autoTriggeredRef.current = true;
      stopRoverForEvent();
      engineRef.current?.setVisibleMarkers([]);
      if (targetMarker === 'laser_station') enterLaserRanging();
      else inspectArtifact(targetMarker);
    }
  }, [phase, objective, nearArtifact]);

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    AudioManager.setMuted(next);
  };

  const triggerLaserPulse = () => {
    if (!engineRef.current) return;
    setIsLaserFiring(true);
    engineRef.current.fireLaser();
    AudioManager.playLaserPulse();
    setTimeout(() => {
      setIsLaserFiring(false);
    }, 3200);
  };

  const handleCompleteChallenge = () => {
    setPhase('outro');
    setOutroProgress(0);
    const msg1 =
      'Good work, explorer. You understand why we left these pieces behind: for science, for survival, and for peace. The lunar surface keeps our story safe.';
    setActiveDialogue({ speaker: 'Neil Armstrong (Narrator-01)', text: msg1 });
    AudioManager.speakDialogue(
      msg1,
      'Neil Armstrong (Narrator-01)',
      () => {
        const msg2 =
          "The footprints at Tranquility Base proved that humanity could leave Earth. But our journey didn't stop at the Moon. We aimed further—beyond the planets, into interstellar space.";
        setActiveDialogue({ speaker: 'Neil Armstrong (Narrator-01)', text: msg2 });
        AudioManager.speakDialogue(
          msg2,
          'Neil Armstrong (Narrator-01)',
          () => setActiveDialogue(null),
          'outro_voyager'
        );
      },
      'puzzle_complete_neil'
    );

    const start = performance.now();
    const timer = window.setInterval(() => {
      const elapsed = performance.now() - start;
      const p = Math.min(1, elapsed / 18000);
      setOutroProgress(p);
      engineRef.current?.setCameraMode({ mode: 'outro', outroProgress: p });
      if (p >= 1) window.clearInterval(timer);
    }, 50);
  };

  const handleReplay = () => {
    setArtifactsVisited({ descent_stage: false, retroreflector: false, plaque: false });
    setPhase('title');
    setActiveDialogue(null);
    setInspectedArtifact(null);
    narrationStateRef.current.cancelled = true;
    setNarrationDone(false);
    setObjective('lander');
    setInteractionLocked(false);
    setIsRangingMode(false);
    setLaserCompleted(false);
    autoTriggeredRef.current = false;
  };

  const canOpenChallenge = Object.values(artifactsVisited).filter(Boolean).length === 3;

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-black select-none">
      {/* WebGL 3D Viewport */}
      <div ref={mountRef} className="absolute inset-0 z-0 w-full h-full" />

      {/* Optional Apollo 11 Hasselblad 500EL Réseau Crosshairs */}
      {visualConfig.showHasselbladReticle && <HasselbladReticle />}

      {/* Title Screen */}
      {phase === 'title' && (
        <TitleScreen
          onStart={startMission}
          isMuted={isMuted}
          onToggleMute={toggleMute}
          onOpenModels={() => setModelsOpen(true)}
          onOpenVisualTuner={() => setVisualTunerOpen(true)}
          visualConfig={visualConfig}
        />
      )}

      {/* Intro Skip Button */}
      {phase === 'intro' && (
        <div className="absolute top-6 right-6 z-20 pointer-events-auto">
          <button
            onClick={skipIntroCinematic}
            className="px-4 py-2 bg-slate-900/85 hover:bg-slate-800 border border-slate-700 text-xs font-mono-num text-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            SKIP CINEMATIC [ESC]
          </button>
        </div>
      )}

      {/* Exploration HUD */}
      {(phase === 'explore' || phase === 'intro') && (
        <ExplorationHUD
          telemetry={telemetry}
          nearArtifact={nearArtifact}
          objective={objective}
          laserCompleted={laserCompleted}
          artifactsVisited={artifactsVisited}
          activeDialogue={activeDialogue}
          onInteract={() => {
            if (objective === 'free' && nearArtifact) {
              if (nearArtifact === 'laser_station') enterLaserRanging();
              else inspectArtifact(nearArtifact);
            }
          }}
          onJoystickMove={(f, t) => InputManager.setVirtualJoystick(f, t)}
          isMuted={isMuted}
          onToggleMute={toggleMute}
          onOpenChallenge={() => setPhase('puzzle')}
          canOpenChallenge={canOpenChallenge}
          onOpenModels={() => setModelsOpen(true)}
          onOpenVisualTuner={() => setVisualTunerOpen(true)}
          showJoystick={
            phase === 'explore' && !activeDialogue && !interactionLocked && !isBootingRover
          }
          typeDialogue={phase === 'intro'}
          onDialogueTyped={handleIntroDialogueTyped}
        />
      )}

      {/* Artifact Inspection Overlay */}
      {phase === 'inspect' && inspectedArtifact && (
        <InspectOverlay
          artifact={ARTIFACTS[inspectedArtifact]}
          dialogue={activeDialogue}
          narrationDone={narrationDone}
          onTyped={handleInspectDialogueTyped}
          onClose={closeInspection}
          readPlaquePoint={inspectedArtifact === 'plaque' ? readPlaquePoint : undefined}
        />
      )}

      {/* Laser Ranging Overlay */}
      {isRangingMode && (
        <LaserRangingOverlay
          isLaserFiring={isLaserFiring}
          onFire={triggerLaserPulse}
          onContinue={exitLaserRanging}
        />
      )}

      {/* Custom 3D Models Modal */}
      {modelsOpen && (
        <ModelsModal engine={engineRef.current} onClose={() => setModelsOpen(false)} />
      )}

      {/* Visual & Lighting Fixes Inspector Modal */}
      <VisualLookModal
        isOpen={visualTunerOpen}
        config={visualConfig}
        onChange={handleVisualConfigChange}
        onClose={() => setVisualTunerOpen(false)}
      />

      {/* Phase 3 Logic Challenge */}
      {phase === 'puzzle' && <ChallengeModal onComplete={handleCompleteChallenge} />}

      {/* Phase 4 Voyager Outro */}
      {phase === 'outro' && (
        <OutroScreen onReplay={handleReplay} outroProgress={outroProgress} />
      )}
    </div>
  );
}
