import React from 'react';
import { Check, Eye, RotateCcw, Sliders, Sun, X } from 'lucide-react';
import { LookPresetId, VISUAL_PRESETS, VisualLookConfig } from '../data/artifacts';

const PRESET_META: {
  id: LookPresetId;
  title: string;
  subtitle: string;
}[] = [
  {
    id: 'apollo_1969',
    title: 'Apollo 11 Archival 1969 (Recommended)',
    subtitle:
      'Low 16° morning Sun, zero indoor studio wash on regolith, crisp micro-grit & visible footprints',
  },
  {
    id: 'cinematic_contrast',
    title: 'Cinematic Deep Vacuum Contrast',
    subtitle:
      'Dramatic 11° grazing Sun angle, razor-sharp crater shadows, heightened Kapton gold specular',
  },
  {
    id: 'earthshine_plus',
    title: 'High-Visibility Earthshine',
    subtitle:
      '22° Sun elevation with brighter blue Earthshine fill for effortless terrain navigation',
  },
  {
    id: 'original_buggy',
    title: 'Original Netlify Look (Before Fixes)',
    subtitle:
      'Reproduces the original washed-out RoomEnvironment reflection, 56° noon sun, hidden footprints & dark title text',
  },
];

export function VisualLookModal({
  isOpen,
  config,
  onChange,
  onClose,
}: {
  isOpen: boolean;
  config: VisualLookConfig;
  onChange: (next: VisualLookConfig) => void;
  onClose: () => void;
}) {
  if (!isOpen) return null;

  const selectPreset = (id: LookPresetId) => {
    onChange({ ...VISUAL_PRESETS[id] });
  };

  const updateField = <K extends keyof VisualLookConfig>(key: K, val: VisualLookConfig[K]) => {
    onChange({
      ...config,
      [key]: val,
    });
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 md:p-6 pointer-events-auto">
      <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl flex flex-col">
        {/* Header */}
        <div className="p-5 border-b border-slate-800 flex items-center justify-between sticky top-0 bg-slate-900/95 z-10">
          <div className="flex items-center gap-3">
            <Sliders className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-lg font-bold text-slate-100">
                Visual & Lighting Look-Dev Inspector
              </h2>
              <p className="text-xs text-slate-400 font-mono-num">
                COMPARE & TUNE THE 6 VISUAL FIXES LIVE IN THE 3D SCENE
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

        <div className="p-5 space-y-6">
          {/* Presets */}
          <div className="space-y-2.5">
            <div className="text-xs font-mono-num font-bold text-amber-400 uppercase tracking-wider">
              1. Visual Presets (Click to Compare Before vs. After)
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {PRESET_META.map((p) => {
                const active = config.preset === p.id;
                return (
                  <button
                    key={p.id}
                    onClick={() => selectPreset(p.id)}
                    className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer ${
                      active
                        ? 'border-amber-400 bg-amber-500/10'
                        : 'border-slate-800 bg-slate-950/70 hover:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-bold text-xs text-slate-100">{p.title}</span>
                      {active && <Check className="w-4 h-4 text-amber-400 shrink-0" />}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-relaxed">{p.subtitle}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Sliders */}
          <div className="space-y-4 bg-slate-950/70 border border-slate-800 rounded-xl p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs font-mono-num font-bold text-slate-200 flex items-center gap-1.5">
                <Sun className="w-4 h-4 text-amber-400" />
                <span>2. Real-Time Shader & Lighting Parameters</span>
              </span>
              <button
                onClick={() => selectPreset('apollo_1969')}
                className="inline-flex items-center gap-1 text-[11px] font-mono-num text-amber-400 hover:text-amber-300 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset to Apollo 1969</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <label className="space-y-1.5">
                <div className="flex justify-between font-mono-num">
                  <span className="text-slate-300">Sun Elevation Angle</span>
                  <span className="text-amber-400">{config.sunElevationDeg.toFixed(0)}°</span>
                </div>
                <input
                  type="range"
                  min={5}
                  max={65}
                  step={1}
                  value={config.sunElevationDeg}
                  onChange={(e) => updateField('sunElevationDeg', Number(e.target.value))}
                  className="w-full accent-amber-400"
                />
                <div className="text-[10px] text-slate-500">
                  Low angle (11°–18°) casts long Apollo 11 morning shadows
                </div>
              </label>

              <label className="space-y-1.5">
                <div className="flex justify-between font-mono-num">
                  <span className="text-slate-300">Regolith Studio Env-Wash</span>
                  <span className="text-amber-400">{config.regolithEnvIntensity.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={config.regolithEnvIntensity}
                  onChange={(e) => updateField('regolithEnvIntensity', Number(e.target.value))}
                  className="w-full accent-amber-400"
                />
                <div className="text-[10px] text-slate-500">
                  0.04 suppresses white RoomEnvironment glare on lunar soil
                </div>
              </label>

              <label className="space-y-1.5">
                <div className="flex justify-between font-mono-num">
                  <span className="text-slate-300">Micro-Regolith Grit Bump</span>
                  <span className="text-amber-400">{config.microGritBump.toFixed(3)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={0.08}
                  step={0.005}
                  value={config.microGritBump}
                  onChange={(e) => updateField('microGritBump', Number(e.target.value))}
                  className="w-full accent-amber-400"
                />
                <div className="text-[10px] text-slate-500">
                  Adds 72×72 tiled close-up basalt dust grain & pockmarks
                </div>
              </label>

              <label className="space-y-1.5">
                <div className="flex justify-between font-mono-num">
                  <span className="text-slate-300">Sun Intensity</span>
                  <span className="text-amber-400">{config.sunIntensity.toFixed(1)}</span>
                </div>
                <input
                  type="range"
                  min={1.5}
                  max={5.5}
                  step={0.1}
                  value={config.sunIntensity}
                  onChange={(e) => updateField('sunIntensity', Number(e.target.value))}
                  className="w-full accent-amber-400"
                />
                <div className="text-[10px] text-slate-500">
                  Controls key sunlight contrast against vacuum shadows
                </div>
              </label>
            </div>

            {/* Toggles */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-800/80 text-xs">
              <label className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer">
                <span className="text-slate-200">Astronaut Bootprints (71 meshes)</span>
                <input
                  type="checkbox"
                  checked={config.showFootprints}
                  onChange={(e) => updateField('showFootprints', e.target.checked)}
                  className="accent-amber-400 w-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer">
                <span className="text-slate-200">Title Screen Contrast Scrim & White Text</span>
                <input
                  type="checkbox"
                  checked={config.highContrastTitleScrim}
                  onChange={(e) => updateField('highContrastTitleScrim', e.target.checked)}
                  className="accent-amber-400 w-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer">
                <span className="text-slate-200">Solar Corona Horizon Glow</span>
                <input
                  type="checkbox"
                  checked={config.showSolarCorona}
                  onChange={(e) => updateField('showSolarCorona', e.target.checked)}
                  className="accent-amber-400 w-4 h-4"
                />
              </label>

              <label className="flex items-center justify-between p-2.5 rounded-lg bg-slate-900 border border-slate-800 cursor-pointer">
                <span className="text-slate-200">Hasselblad 500EL Réseau Crosshairs</span>
                <input
                  type="checkbox"
                  checked={config.showHasselbladReticle}
                  onChange={(e) => updateField('showHasselbladReticle', e.target.checked)}
                  className="accent-amber-400 w-4 h-4"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-800 bg-slate-950/70 flex justify-between items-center">
          <span className="text-[11px] text-slate-400 font-mono-num flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-amber-400" />
            <span>Changes apply immediately to the live 3D WebGL viewport</span>
          </span>
          <button
            onClick={onClose}
            className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-lg text-xs transition-colors cursor-pointer"
          >
            DONE
          </button>
        </div>
      </div>
    </div>
  );
}
