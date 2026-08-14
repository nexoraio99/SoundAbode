import React, { useEffect, useRef, useState, useCallback } from 'react';
import styles from './SoundabodeLiveConsole.module.css';

export interface LiveConsoleTrack {
  id: string;
  name: string;
  artist: string;
  bpm: number;
  genre: string;
  url: string;
}

export const SHARED_TRACKS: LiveConsoleTrack[] = [
  {
    id: '1',
    name: 'The Lesson (La Leçon)',
    artist: 'Switch Disco',
    genre: 'House / Dance',
    bpm: 125,
    url: 'https://raw.githubusercontent.com/nexoraio99/cdn-soundabode-assets/main/01.%20Switch%20Disco%20-%20The%20Lesson%20(La%20Lec%CC%A7on)%20(La%20Lec%CC%A7on).mp3',
  },
  {
    id: '2',
    name: "Let's Ride Away (MEDUZA Remix)",
    artist: 'MEDUZA',
    genre: 'Melodic Techno',
    bpm: 126,
    url: "https://raw.githubusercontent.com/nexoraio99/cdn-soundabode-assets/main/02%20-%20Let's%20Ride%20Away%20(MEDUZA%20For%20Tim%20Remix).mp3",
  },
  {
    id: '3',
    name: 'AMENO (Extended)',
    artist: 'ERA / Remix',
    genre: 'Techno',
    bpm: 126,
    url: 'https://raw.githubusercontent.com/nexoraio99/cdn-soundabode-assets/main/AMENO%20(Extended).mp3',
  },
  {
    id: '4',
    name: 'Feel The Stream (Original Mix)',
    artist: 'Carbon',
    genre: 'Minimal / Deep Tech',
    bpm: 127,
    url: 'https://raw.githubusercontent.com/nexoraio99/cdn-soundabode-assets/main/Carbon%20-%20Feel%20The%20Stream%20(Original%20Mix)%20%5B4DJsonline.com%5D.mp3',
  },
  {
    id: '5',
    name: 'DIGITAL ANIMAL',
    artist: 'DONT BLINK',
    genre: 'Tech House',
    bpm: 126,
    url: 'https://raw.githubusercontent.com/nexoraio99/cdn-soundabode-assets/main/Dont%20Blink%20%E2%80%93%20DIGITAL%20ANIMAL.mp3',
  },
  {
    id: '6',
    name: 'Drip (Original Mix)',
    artist: 'Henri Bergmann, Tobak',
    genre: 'Indie Dance',
    bpm: 124,
    url: 'https://raw.githubusercontent.com/nexoraio99/cdn-soundabode-assets/main/Henri%20Bergmann%2C%20Tobak%20-%20Drip%20(Original%20Mix).mp3',
  },
  {
    id: '7',
    name: 'Rave Reverend (Original Mix)',
    artist: 'Marca Frequency',
    genre: 'Peak Time Techno',
    bpm: 130,
    url: 'https://raw.githubusercontent.com/nexoraio99/cdn-soundabode-assets/main/Marca%20Frequency%20%E2%80%93%20Rave%20Reverend%20-%20Original%20Mix.mp3',
  },
  {
    id: '8',
    name: 'Activator',
    artist: 'Script',
    genre: 'Techno',
    bpm: 128,
    url: 'https://raw.githubusercontent.com/nexoraio99/cdn-soundabode-assets/main/Script%20%E2%80%93%20Activator.mp3',
  },
];

interface PadDef {
  keyName: string;
  hotkey: string;
  sound: string;
}

const PAD_KITS: Record<string, { name: string; pads: PadDef[] }> = {
  edm: {
    name: 'EDM & House Drum Kit',
    pads: [
      { keyName: 'KICK', hotkey: 'Q', sound: 'kick' },
      { keyName: 'SNARE', hotkey: 'W', sound: 'snare' },
      { keyName: 'CL HAT', hotkey: 'E', sound: 'chat' },
      { keyName: 'OP HAT', hotkey: 'R', sound: 'ohat' },
      { keyName: 'CLAP', hotkey: 'A', sound: 'clap' },
      { keyName: 'LOW TOM', hotkey: 'S', sound: 'tom' },
      { keyName: 'RIMSHOT', hotkey: 'D', sound: 'rim' },
      { keyName: 'CRASH', hotkey: 'F', sound: 'crash' },
    ],
  },
  techno: {
    name: 'Techno & Acid Rave Kit',
    pads: [
      { keyName: 'SUB KICK', hotkey: 'Q', sound: 'kick' },
      { keyName: 'TECH SNARE', hotkey: 'W', sound: 'snare' },
      { keyName: 'ACID CHAT', hotkey: 'E', sound: 'chat' },
      { keyName: 'RIDE CYMB', hotkey: 'R', sound: 'crash' },
      { keyName: 'ACID STAB', hotkey: 'A', sound: 'acid_stab' },
      { keyName: 'SUB BASS', hotkey: 'S', sound: 'sub_bass' },
      { keyName: 'SIREN FX', hotkey: 'D', sound: 'siren_fx' },
      { keyName: 'NOISE HIT', hotkey: 'F', sound: 'laser' },
    ],
  },
  trap: {
    name: 'Trap & 808 Hip-Hop Kit',
    pads: [
      { keyName: '808 KICK', hotkey: 'Q', sound: 'sub_bass' },
      { keyName: 'TRAP SNARE', hotkey: 'W', sound: 'snare' },
      { keyName: '808 HAT', hotkey: 'E', sound: 'chat' },
      { keyName: 'AIRHORN', hotkey: 'R', sound: 'airhorn' },
      { keyName: 'CLAP HIT', hotkey: 'A', sound: 'clap' },
      { keyName: 'LASER FX', hotkey: 'S', sound: 'laser' },
      { keyName: 'SIREN FX', hotkey: 'D', sound: 'siren_fx' },
      { keyName: 'REV CRASH', hotkey: 'F', sound: 'crash' },
    ],
  },
  dj_fx: {
    name: 'DJ Scratch & Vocal FX Kit',
    pads: [
      { keyName: 'AIRHORN', hotkey: 'Q', sound: 'airhorn' },
      { keyName: 'SCRATCH 1', hotkey: 'W', sound: 'scratch_fast' },
      { keyName: 'SCRATCH 2', hotkey: 'E', sound: 'scratch_slow' },
      { keyName: 'REWIND', hotkey: 'R', sound: 'rewind' },
      { keyName: 'LASER SHOT', hotkey: 'A', sound: 'laser' },
      { keyName: 'BASS DROP', hotkey: 'S', sound: 'sub_bass' },
      { keyName: 'ACID STAB', hotkey: 'D', sound: 'acid_stab' },
      { keyName: 'SIREN FX', hotkey: 'F', sound: 'siren_fx' },
    ],
  },
};

export type PadMode = 'HOT_CUE' | 'BEAT_LOOP' | 'SAMPLER' | 'BEAT_JUMP';

interface RotaryKnobProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  defaultValue?: number;
  onChange: (val: number) => void;
  size?: 'sm' | 'md' | 'lg';
}

const RotaryKnob: React.FC<RotaryKnobProps> = ({
  label,
  value,
  min,
  max,
  step = 1,
  unit = '',
  defaultValue = 0,
  onChange,
  size = 'md',
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const dragStartY = useRef<number>(0);
  const startVal = useRef<number>(value);

  const angle = Math.max(-135, Math.min(135, ((value - min) / (max - min)) * 270 - 135));

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    setIsDragging(true);
    dragStartY.current = e.clientY;
    startVal.current = value;
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const deltaY = dragStartY.current - e.clientY;
    const range = max - min;
    const change = (deltaY / 120) * range;
    let newVal = startVal.current + change;
    newVal = Math.max(min, Math.min(max, newVal));
    if (step >= 1) newVal = Math.round(newVal);
    else if (step > 0) newVal = Math.round(newVal / step) * step;
    onChange(parseFloat(newVal.toFixed(2)));
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isDragging) {
      e.currentTarget.releasePointerCapture(e.pointerId);
      setIsDragging(false);
    }
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? step || 1 : -(step || 1);
    let newVal = value + delta;
    newVal = Math.max(min, Math.min(max, newVal));
    onChange(parseFloat(newVal.toFixed(2)));
  };

  const handleDoubleClick = () => {
    onChange(defaultValue);
  };

  return (
    <div className={`${styles.knobContainer} ${styles[`knob_${size}`]}`}>
      <div
        className={`${styles.knobBody} ${isDragging ? styles.knobDragging : ''}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onWheel={handleWheel}
        onDoubleClick={handleDoubleClick}
        title={`${label}: ${value > 0 ? '+' : ''}${value}${unit} (Double-click to reset)`}
      >
        <div className={styles.knobCap} style={{ transform: `rotate(${angle}deg)` }}>
          <div className={styles.knobDot} />
        </div>
      </div>
      <span className={styles.knobLabel}>{label}</span>
    </div>
  );
};

export interface SoundabodeLiveConsoleProps {
  showLibrary?: boolean;
}

interface AudioGraphNodes {
  sourceNode: MediaElementAudioSourceNode | null;
  trimGain: GainNode;
  lowFilter: BiquadFilterNode;
  midFilter: BiquadFilterNode;
  highFilter: BiquadFilterNode;
  soundColorFilter: BiquadFilterNode;
  chFaderGain: GainNode;
  xfaderGain: GainNode;
  analyser: AnalyserNode;
}

interface LoopState {
  active: boolean;
  inTime: number;
  outTime: number;
  duration: number;
}

export const SoundabodeLiveConsole: React.FC<SoundabodeLiveConsoleProps> = ({ showLibrary = true }) => {
  const outerRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number>(1);
  const [scaledHeight, setScaledHeight] = useState<number | undefined>(undefined);
  const scaleRef = useRef<number>(1);
  const scaledHeightRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    if (!outerRef.current) return;

    let rafId: number;

    const handleResize = () => {
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        if (!outerRef.current || !innerRef.current) return;
        const containerWidth = outerRef.current.clientWidth;
        const baseWidth = 1040;

        let newScale = 1;
        let newScaledHeight: number | undefined = undefined;

        if (containerWidth > 0 && containerWidth < baseWidth) {
          newScale = containerWidth / baseWidth;
          const unscaledHeight = innerRef.current.scrollHeight || innerRef.current.offsetHeight;
          newScaledHeight = Math.round(unscaledHeight * newScale);
        }

        if (Math.abs(scaleRef.current - newScale) > 0.002) {
          scaleRef.current = newScale;
          setScale(newScale);
        }

        if (
          (scaledHeightRef.current === undefined && newScaledHeight !== undefined) ||
          (scaledHeightRef.current !== undefined && newScaledHeight === undefined) ||
          (scaledHeightRef.current !== undefined &&
            newScaledHeight !== undefined &&
            Math.abs(scaledHeightRef.current - newScaledHeight) > 3)
        ) {
          scaledHeightRef.current = newScaledHeight;
          setScaledHeight(newScaledHeight);
        }
      });
    };

    const observer = new ResizeObserver(() => {
      handleResize();
    });

    observer.observe(outerRef.current);
    handleResize();

    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, []);

  const [selectedLibraryTrack, setSelectedLibraryTrack] = useState<LiveConsoleTrack>(SHARED_TRACKS[0]);
  const [trackA, setTrackA] = useState<LiveConsoleTrack>(SHARED_TRACKS[0]);
  const [trackB, setTrackB] = useState<LiveConsoleTrack>(SHARED_TRACKS[1]);

  const [isPlayingA, setIsPlayingA] = useState(false);
  const [isPlayingB, setIsPlayingB] = useState(false);
  const [pitchA, setPitchA] = useState(0);
  const [pitchB, setPitchB] = useState(0);
  const [volA, setVolA] = useState(0.85);
  const [volB, setVolB] = useState(0.85);
  const [xfaderVal, setXfaderVal] = useState(50);
  const [activePad, setActivePad] = useState<string | null>(null);
  const [selectedPack, setSelectedPack] = useState<'edm' | 'techno' | 'trap' | 'dj_fx'>('edm');
  const [padModeA, setPadModeA] = useState<PadMode>('SAMPLER');
  const [padModeB, setPadModeB] = useState<PadMode>('SAMPLER');

  // Channel EQ & Filter States
  const [trimA, setTrimA] = useState(0);
  const [hiA, setHiA] = useState(0);
  const [midA, setMidA] = useState(0);
  const [lowA, setLowA] = useState(0);
  const [filterA, setFilterA] = useState(0);

  const [trimB, setTrimB] = useState(0);
  const [hiB, setHiB] = useState(0);
  const [midB, setMidB] = useState(0);
  const [lowB, setLowB] = useState(0);
  const [filterB, setFilterB] = useState(0);

  // Cue Points & Previewing States
  const [cuePointA, setCuePointA] = useState(0);
  const [cuePointB, setCuePointB] = useState(0);
  const [isCueingA, setIsCueingA] = useState(false);
  const [isCueingB, setIsCueingB] = useState(false);

  // Beat Looping States
  const [loopA, setLoopA] = useState<LoopState>({ active: false, inTime: 0, outTime: 0, duration: 4 });
  const [loopB, setLoopB] = useState<LoopState>({ active: false, inTime: 0, outTime: 0, duration: 4 });
  const [manualLoopStepA, setManualLoopStepA] = useState<'IDLE' | 'IN_SET'>('IDLE');
  const [manualLoopStepB, setManualLoopStepB] = useState<'IDLE' | 'IN_SET'>('IDLE');

  // Master Deck & Sync
  const [masterDeck, setMasterDeck] = useState<'A' | 'B'>('A');

  // Quantize & Beat Grid States (ON by default on pioneer pro gear)
  const [quantizeA, setQuantizeA] = useState(true);
  const [quantizeB, setQuantizeB] = useState(true);

  // Hot Cues (8 per deck)
  const [hotCuesA, setHotCuesA] = useState<(number | null)[]>(Array(8).fill(null));
  const [hotCuesB, setHotCuesB] = useState<(number | null)[]>(Array(8).fill(null));

  // Headphone Cues
  const [cueHeadphoneA, setCueHeadphoneA] = useState(true);
  const [cueHeadphoneB, setCueHeadphoneB] = useState(true);

  // Refs for animation & event callbacks (prevents listener stacking & frame drops)
  const isPlayingARef = useRef(false);
  const isPlayingBRef = useRef(false);
  isPlayingARef.current = isPlayingA;
  isPlayingBRef.current = isPlayingB;

  const trackARef = useRef(trackA);
  const trackBRef = useRef(trackB);
  trackARef.current = trackA;
  trackBRef.current = trackB;

  const loopARef = useRef(loopA);
  const loopBRef = useRef(loopB);
  loopARef.current = loopA;
  loopBRef.current = loopB;

  const hotCuesARef = useRef(hotCuesA);
  const hotCuesBRef = useRef(hotCuesB);
  hotCuesARef.current = hotCuesA;
  hotCuesBRef.current = hotCuesB;

  // Audio Context & Nodes Refs
  const audioCtxRef = useRef<AudioContext | null>(null);
  const masterGainRef = useRef<GainNode | null>(null);
  const audioARef = useRef<HTMLAudioElement | null>(null);
  const audioBRef = useRef<HTMLAudioElement | null>(null);
  const graphARef = useRef<AudioGraphNodes | null>(null);
  const graphBRef = useRef<AudioGraphNodes | null>(null);

  // Nudge / Tempo pitch bend state refs
  const pitchNudgeARef = useRef(0);
  const pitchNudgeBRef = useRef(0);

  // DOM Refs
  const platterARef = useRef<HTMLDivElement>(null);
  const platterBRef = useRef<HTMLDivElement>(null);
  const vuARef = useRef<HTMLDivElement>(null);
  const vuBRef = useRef<HTMLDivElement>(null);
  const waveformCanvasARef = useRef<HTMLCanvasElement | null>(null);
  const waveformCanvasBRef = useRef<HTMLCanvasElement | null>(null);

  // Real PCM Audio Buffer Peaks Cache
  const realPeaksRef = useRef<Record<string, number[]>>({});

  // Waveform canvas dragging & scratching refs
  const isScratchingWaveformARef = useRef(false);
  const isScratchingWaveformBRef = useRef(false);
  const lastWaveformXARef = useRef(0);
  const lastWaveformXBRef = useRef(0);

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      audioCtxRef.current = new AudioCtx();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  const getMasterGain = useCallback(() => {
    const ctx = getAudioContext();
    if (!masterGainRef.current) {
      const g = ctx.createGain();
      g.gain.value = 0.9;
      g.connect(ctx.destination);
      masterGainRef.current = g;
    }
    return masterGainRef.current;
  }, [getAudioContext]);

  // Quantize Helper (Snaps timestamps to 1/16th beat grid when Quantize is ON)
  const getQuantizedTime = useCallback(
    (deck: 'A' | 'B', rawTime: number) => {
      const isQuantizeOn = deck === 'A' ? quantizeA : quantizeB;
      if (!isQuantizeOn) return rawTime;

      const currentTrack = deck === 'A' ? trackA : trackB;
      const currentPitch = deck === 'A' ? pitchA : pitchB;
      const currentBpm = Math.max(40, currentTrack.bpm * Math.pow(2, currentPitch / 96));
      const secPerBeat = 60 / currentBpm;
      const subBeat = secPerBeat / 4;

      const quantized = Math.round(rawTime / subBeat) * subBeat;
      return Math.max(0, parseFloat(quantized.toFixed(4)));
    },
    [quantizeA, quantizeB, trackA, trackB, pitchA, pitchB]
  );

  // Setup Web Audio Node Chain for a Deck
  const initAudioGraph = useCallback((deck: 'A' | 'B', audioEl: HTMLAudioElement) => {
    const ctx = getAudioContext();
    const masterGain = getMasterGain();

    const graphRef = deck === 'A' ? graphARef : graphBRef;
    if (graphRef.current) return graphRef.current;

    let sourceNode: MediaElementAudioSourceNode | null = null;
    try {
      sourceNode = ctx.createMediaElementSource(audioEl);
    } catch {
      // Source node already attached
    }

    const trimGain = ctx.createGain();
    const lowFilter = ctx.createBiquadFilter();
    lowFilter.type = 'lowshelf';
    lowFilter.frequency.value = 250;

    const midFilter = ctx.createBiquadFilter();
    midFilter.type = 'peaking';
    midFilter.frequency.value = 1000;
    midFilter.Q.value = 1.0;

    const highFilter = ctx.createBiquadFilter();
    highFilter.type = 'highshelf';
    highFilter.frequency.value = 3200;

    const soundColorFilter = ctx.createBiquadFilter();
    soundColorFilter.type = 'lowpass';
    soundColorFilter.frequency.value = 20000;

    const chFaderGain = ctx.createGain();
    const xfaderGain = ctx.createGain();

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 64;
    analyser.smoothingTimeConstant = 0.8;

    if (sourceNode) {
      sourceNode
        .connect(trimGain)
        .connect(lowFilter)
        .connect(midFilter)
        .connect(highFilter)
        .connect(soundColorFilter)
        .connect(chFaderGain)
        .connect(xfaderGain)
        .connect(analyser)
        .connect(masterGain);
    }

    const graph: AudioGraphNodes = {
      sourceNode,
      trimGain,
      lowFilter,
      midFilter,
      highFilter,
      soundColorFilter,
      chFaderGain,
      xfaderGain,
      analyser,
    };

    graphRef.current = graph;
    return graph;
  }, [getAudioContext, getMasterGain]);

  // Fetch & decode real PCM AudioBuffer peaks
  useEffect(() => {
    let cancelled = false;

    const fetchPeaks = async (url: string) => {
      if (realPeaksRef.current[url]) return;
      try {
        const response = await fetch(url);
        const buffer = await response.arrayBuffer();
        const ctx = getAudioContext();
        const audioBuffer = await ctx.decodeAudioData(buffer);
        const channelData = audioBuffer.getChannelData(0);

        const numBins = 300;
        const samplesPerBin = Math.floor(channelData.length / numBins);
        const peaks: number[] = [];

        for (let i = 0; i < numBins; i++) {
          const start = i * samplesPerBin;
          let maxVal = 0;
          for (let j = 0; j < samplesPerBin; j += 16) {
            const v = Math.abs(channelData[start + j] || 0);
            if (v > maxVal) maxVal = v;
          }
          peaks.push(maxVal);
        }

        if (!cancelled) {
          realPeaksRef.current[url] = peaks;
        }
      } catch {
        const numBins = 300;
        const peaks: number[] = [];
        for (let i = 0; i < numBins; i++) {
          const val = Math.abs(Math.sin(i * 0.14) * 0.75 + Math.cos(i * 0.28) * 0.25);
          peaks.push(val);
        }
        if (!cancelled) {
          realPeaksRef.current[url] = peaks;
        }
      }
    };

    if (trackA?.url) fetchPeaks(trackA.url);
    if (trackB?.url) fetchPeaks(trackB.url);

    return () => {
      cancelled = true;
    };
  }, [trackA, trackB, getAudioContext]);

  // Sync HTML5 Audio Elements & Web Audio Nodes for Deck A
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!audioARef.current) {
      audioARef.current = new Audio();
      audioARef.current.crossOrigin = 'anonymous';
      audioARef.current.loop = false;
    }
    const a = audioARef.current;
    if (a.src !== trackA.url) {
      a.src = trackA.url;
      a.load();
      setCuePointA(0);
      setLoopA((prev) => ({ ...prev, active: false }));
    }

    initAudioGraph('A', a);
    const graph = graphARef.current;

    const xFactorA = (100 - xfaderVal) / 100;
    const trimGainVal = Math.pow(10, trimA / 20);
    const effectiveRateA = Math.max(0.5, Math.min(2, Math.pow(2, (pitchA + pitchNudgeARef.current) / 96)));

    a.playbackRate = effectiveRateA;

    if (graph) {
      const ctx = getAudioContext();
      const t = ctx.currentTime;
      graph.trimGain.gain.setTargetAtTime(trimGainVal, t, 0.01);
      graph.lowFilter.gain.setTargetAtTime(lowA, t, 0.01);
      graph.midFilter.gain.setTargetAtTime(midA, t, 0.01);
      graph.highFilter.gain.setTargetAtTime(hiA, t, 0.01);

      if (filterA < 0) {
        graph.soundColorFilter.type = 'lowpass';
        const cutoff = 20000 * Math.pow(10, (filterA / 50) * 2.4);
        graph.soundColorFilter.frequency.setTargetAtTime(Math.max(60, cutoff), t, 0.01);
      } else if (filterA > 0) {
        graph.soundColorFilter.type = 'highpass';
        const cutoff = 20 * Math.pow(10, (filterA / 50) * 2.7);
        graph.soundColorFilter.frequency.setTargetAtTime(Math.min(12000, cutoff), t, 0.01);
      } else {
        graph.soundColorFilter.type = 'lowpass';
        graph.soundColorFilter.frequency.setTargetAtTime(20000, t, 0.01);
      }

      graph.chFaderGain.gain.setTargetAtTime(volA, t, 0.01);
      graph.xfaderGain.gain.setTargetAtTime(xFactorA, t, 0.01);
    } else {
      a.volume = Math.max(0, Math.min(1, volA * xFactorA * trimGainVal));
    }

    if (isPlayingA) {
      a.play().catch(() => {});
    } else if (!isCueingA) {
      a.pause();
    }
  }, [trackA, isPlayingA, volA, pitchA, xfaderVal, trimA, hiA, midA, lowA, filterA, isCueingA, initAudioGraph, getAudioContext]);

  // Sync HTML5 Audio Elements & Web Audio Nodes for Deck B
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!audioBRef.current) {
      audioBRef.current = new Audio();
      audioBRef.current.crossOrigin = 'anonymous';
      audioBRef.current.loop = false;
    }
    const b = audioBRef.current;
    if (b.src !== trackB.url) {
      b.src = trackB.url;
      b.load();
      setCuePointB(0);
      setLoopB((prev) => ({ ...prev, active: false }));
    }

    initAudioGraph('B', b);
    const graph = graphBRef.current;

    const xFactorB = xfaderVal / 100;
    const trimGainVal = Math.pow(10, trimB / 20);
    const effectiveRateB = Math.max(0.5, Math.min(2, Math.pow(2, (pitchB + pitchNudgeBRef.current) / 96)));

    b.playbackRate = effectiveRateB;

    if (graph) {
      const ctx = getAudioContext();
      const t = ctx.currentTime;
      graph.trimGain.gain.setTargetAtTime(trimGainVal, t, 0.01);
      graph.lowFilter.gain.setTargetAtTime(lowB, t, 0.01);
      graph.midFilter.gain.setTargetAtTime(midB, t, 0.01);
      graph.highFilter.gain.setTargetAtTime(hiB, t, 0.01);

      if (filterB < 0) {
        graph.soundColorFilter.type = 'lowpass';
        const cutoff = 20000 * Math.pow(10, (filterB / 50) * 2.4);
        graph.soundColorFilter.frequency.setTargetAtTime(Math.max(60, cutoff), t, 0.01);
      } else if (filterB > 0) {
        graph.soundColorFilter.type = 'highpass';
        const cutoff = 20 * Math.pow(10, (filterB / 50) * 2.7);
        graph.soundColorFilter.frequency.setTargetAtTime(Math.min(12000, cutoff), t, 0.01);
      } else {
        graph.soundColorFilter.type = 'lowpass';
        graph.soundColorFilter.frequency.setTargetAtTime(20000, t, 0.01);
      }

      graph.chFaderGain.gain.setTargetAtTime(volB, t, 0.01);
      graph.xfaderGain.gain.setTargetAtTime(xFactorB, t, 0.01);
    } else {
      b.volume = Math.max(0, Math.min(1, volB * xFactorB * trimGainVal));
    }

    if (isPlayingB) {
      b.play().catch(() => {});
    } else if (!isCueingB) {
      b.pause();
    }
  }, [trackB, isPlayingB, volB, pitchB, xfaderVal, trimB, hiB, midB, lowB, filterB, isCueingB, initAudioGraph, getAudioContext]);

  // Audio Looping enforce check in time update
  useEffect(() => {
    const a = audioARef.current;
    if (!a) return;
    const handleTimeUpdateA = () => {
      const currentLoopA = loopARef.current;
      if (currentLoopA.active && currentLoopA.outTime > currentLoopA.inTime && a.currentTime >= currentLoopA.outTime) {
        a.currentTime = currentLoopA.inTime;
      }
    };
    a.addEventListener('timeupdate', handleTimeUpdateA);
    return () => a.removeEventListener('timeupdate', handleTimeUpdateA);
  }, []);

  useEffect(() => {
    const b = audioBRef.current;
    if (!b) return;
    const handleTimeUpdateB = () => {
      const currentLoopB = loopBRef.current;
      if (currentLoopB.active && currentLoopB.outTime > currentLoopB.inTime && b.currentTime >= currentLoopB.outTime) {
        b.currentTime = currentLoopB.inTime;
      }
    };
    b.addEventListener('timeupdate', handleTimeUpdateB);
    return () => b.removeEventListener('timeupdate', handleTimeUpdateB);
  }, []);

  // Single Stable 60FPS Real-Time Waveforms & Dynamic VU Meter Animation Loop
  useEffect(() => {
    let animId: number;
    let lastPerfTime = performance.now();
    let smoothTimeA = 0;
    let smoothTimeB = 0;

    const dataArrayA = new Uint8Array(32);
    const dataArrayB = new Uint8Array(32);

    const render = () => {
      const now = performance.now();
      const dt = Math.min(0.1, (now - lastPerfTime) / 1000);
      lastPerfTime = now;

      const activeA = isPlayingARef.current;
      const activeB = isPlayingBRef.current;
      const curTrackA = trackARef.current;
      const curTrackB = trackBRef.current;
      const curLoopA = loopARef.current;
      const curLoopB = loopBRef.current;
      const curCuesA = hotCuesARef.current;
      const curCuesB = hotCuesBRef.current;

      // High-precision smooth real-time clock interpolation for Deck A
      const audioA = audioARef.current;
      const rawTimeA = audioA ? audioA.currentTime : 0;
      if (activeA && audioA && !audioA.paused) {
        const rateA = audioA.playbackRate || 1;
        smoothTimeA += dt * rateA;
        if (Math.abs(smoothTimeA - rawTimeA) > 0.06) {
          smoothTimeA = rawTimeA;
        }
      } else {
        smoothTimeA = rawTimeA;
      }
      const curTimeA = smoothTimeA;

      // High-precision smooth real-time clock interpolation for Deck B
      const audioB = audioBRef.current;
      const rawTimeB = audioB ? audioB.currentTime : 0;
      if (activeB && audioB && !audioB.paused) {
        const rateB = audioB.playbackRate || 1;
        smoothTimeB += dt * rateB;
        if (Math.abs(smoothTimeB - rawTimeB) > 0.06) {
          smoothTimeB = rawTimeB;
        }
      } else {
        smoothTimeB = rawTimeB;
      }
      const curTimeB = smoothTimeB;

      // --- VU Meter & Live Spectrum Deck A ---
      let livePulseA = 0;
      const graphA = graphARef.current;
      if (vuARef.current) {
        if (activeA && graphA?.analyser) {
          graphA.analyser.getByteFrequencyData(dataArrayA);
          let sum = 0;
          for (let i = 0; i < 32; i++) sum += dataArrayA[i];
          const avg = sum / 32;
          const pct = Math.min(100, Math.max(8, (avg / 180) * 100));
          vuARef.current.style.height = `${pct}%`;
          livePulseA = Math.min(0.4, (avg / 255) * 0.4);
        } else if (!activeA) {
          vuARef.current.style.height = '0%';
        }
      }

      // --- VU Meter & Live Spectrum Deck B ---
      let livePulseB = 0;
      const graphB = graphBRef.current;
      if (vuBRef.current) {
        if (activeB && graphB?.analyser) {
          graphB.analyser.getByteFrequencyData(dataArrayB);
          let sum = 0;
          for (let i = 0; i < 32; i++) sum += dataArrayB[i];
          const avg = sum / 32;
          const pct = Math.min(100, Math.max(8, (avg / 180) * 100));
          vuBRef.current.style.height = `${pct}%`;
          livePulseB = Math.min(0.4, (avg / 255) * 0.4);
        } else if (!activeB) {
          vuBRef.current.style.height = '0%';
        }
      }

      // --- Render Deck A Waveform (Real-Time 60FPS) ---
      const canvasA = waveformCanvasARef.current;
      if (canvasA) {
        const ctx = canvasA.getContext('2d');
        if (ctx) {
          const w = canvasA.width;
          const h = canvasA.height;
          const centerX = w / 2;

          ctx.fillStyle = '#090b0f';
          ctx.fillRect(0, 0, w, h);

          const durA = audioA && audioA.duration && !isNaN(audioA.duration) && audioA.duration > 0 ? audioA.duration : 180;
          
          const bpmA = Math.max(40, curTrackA.bpm);
          const secPerBeatA = 60 / bpmA;
          const viewWindowA = 16 * secPerBeatA; // 4 Bars (16 Beats) visible window

          const startTimeA = curTimeA - viewWindowA / 2;
          const endTimeA = curTimeA + viewWindowA / 2;

          const peaks = realPeaksRef.current[curTrackA.url] || [];
          const totalPeaks = peaks.length || 300;

          // 1. Draw 4-Beat Grid Lines & Bar Markers (Bright White & Amber)
          const firstBeatA = Math.floor(startTimeA / secPerBeatA) * secPerBeatA;
          for (let bTime = firstBeatA; bTime <= endTimeA; bTime += secPerBeatA) {
            const beatX = centerX + ((bTime - curTimeA) / viewWindowA) * w;
            if (beatX >= 0 && beatX <= w) {
              const beatIndex = Math.round(bTime / secPerBeatA);
              const isBarStart = beatIndex % 4 === 0;

              if (isBarStart) {
                // Solid Amber Bar Start Grid Line
                ctx.strokeStyle = '#f59e0b';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(beatX, 0);
                ctx.lineTo(beatX, h);
                ctx.stroke();

                ctx.fillStyle = '#f59e0b';
                ctx.font = '8px monospace';
                ctx.fillText(`B${Math.max(1, Math.floor(beatIndex / 4) + 1)}`, beatX + 2, h - 3);
              } else {
                // Bright Solid White Grid Lines for Beats 2, 3, 4
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(beatX, 0);
                ctx.lineTo(beatX, h);
                ctx.stroke();

                // Crisp White Top Grid Dot
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(beatX, 2, 1.5, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          }

          // 2. Zero Center Line
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, h / 2);
          ctx.lineTo(w, h / 2);
          ctx.stroke();

          // 3. Draw Waveform Bars across Real-Time Window
          const numBarsToDraw = 64;
          const barWidth = w / numBarsToDraw;
          const barSpacing = 1.5;

          for (let i = 0; i < numBarsToDraw; i++) {
            const sampleTime = startTimeA + (i / numBarsToDraw) * viewWindowA;
            const peakIdx = Math.floor((sampleTime / durA) * totalPeaks);
            let peakVal = (peakIdx >= 0 && peakIdx < totalPeaks) ? (peaks[peakIdx] !== undefined ? peaks[peakIdx] : 0.2) : 0.08;
            
            // Dynamic Live Web Audio Spectrum pulse modulation at playhead
            const x = i * barWidth;
            if (activeA && Math.abs(x - centerX) < 24) {
              peakVal *= (1 + livePulseA);
            }

            const barHeight = Math.max(3, peakVal * (h * 0.82));
            const y = (h - barHeight) / 2;

            if (x < centerX) {
              ctx.fillStyle = '#ef4444'; // Played section
            } else {
              ctx.fillStyle = '#38bdf8'; // Upcoming section
            }

            ctx.fillRect(x, y, Math.max(1, barWidth - barSpacing), barHeight);
          }

          // 4. Render Active Loop Region Highlight if Active
          if (curLoopA.active && durA > 0) {
            const loopInX = centerX + ((curLoopA.inTime - curTimeA) / viewWindowA) * w;
            const loopOutX = centerX + ((curLoopA.outTime - curTimeA) / viewWindowA) * w;
            const renderLeft = Math.max(0, loopInX);
            const renderRight = Math.min(w, loopOutX);
            if (renderRight > renderLeft) {
              ctx.fillStyle = 'rgba(245, 158, 11, 0.3)';
              ctx.fillRect(renderLeft, 0, renderRight - renderLeft, h);
              ctx.strokeStyle = '#f59e0b';
              ctx.lineWidth = 1.5;
              ctx.strokeRect(renderLeft, 0, renderRight - renderLeft, h);
            }
          }

          // 5. Hot Cue Markers
          curCuesA.forEach((cueTime, idx) => {
            if (cueTime !== null && durA > 0) {
              const cueX = centerX + ((cueTime - curTimeA) / viewWindowA) * w;
              if (cueX >= 0 && cueX <= w) {
                ctx.fillStyle = '#22c55e';
                ctx.beginPath();
                ctx.arc(cueX, 6, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#000000';
                ctx.font = '7px monospace';
                ctx.fillText(String(idx + 1), cueX - 2, 8);
              }
            }
          });

          // 6. Stationary Center Playhead
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(centerX - 1, 0, 2, h);

          // 7. Time Elapsed & Remaining Overlay
          ctx.fillStyle = '#f3f4f6';
          ctx.font = '9px monospace';
          const elapsedMins = Math.floor(curTimeA / 60);
          const elapsedSecs = Math.floor(curTimeA % 60);
          const remTotal = Math.max(0, durA - curTimeA);
          const remMins = Math.floor(remTotal / 60);
          const remSecs = Math.floor(remTotal % 60);

          ctx.fillText(`${String(elapsedMins).padStart(2, '0')}:${String(elapsedSecs).padStart(2, '0')}`, 4, 11);
          ctx.fillText(`-${String(remMins).padStart(2, '0')}:${String(remSecs).padStart(2, '0')}`, w - 38, 11);
        }
      }

      // --- Render Deck B Waveform (Real-Time 60FPS) ---
      const canvasB = waveformCanvasBRef.current;
      if (canvasB) {
        const ctx = canvasB.getContext('2d');
        if (ctx) {
          const w = canvasB.width;
          const h = canvasB.height;
          const centerX = w / 2;

          ctx.fillStyle = '#090b0f';
          ctx.fillRect(0, 0, w, h);

          const durB = audioB && audioB.duration && !isNaN(audioB.duration) && audioB.duration > 0 ? audioB.duration : 180;

          const bpmB = Math.max(40, curTrackB.bpm);
          const secPerBeatB = 60 / bpmB;
          const viewWindowB = 16 * secPerBeatB; // 4 Bars (16 Beats) visible window

          const startTimeB = curTimeB - viewWindowB / 2;
          const endTimeB = curTimeB + viewWindowB / 2;

          const peaks = realPeaksRef.current[curTrackB.url] || [];
          const totalPeaks = peaks.length || 300;

          // 1. Draw 4-Beat Grid Lines & Bar Markers (Bright White & Amber)
          const firstBeatB = Math.floor(startTimeB / secPerBeatB) * secPerBeatB;
          for (let bTime = firstBeatB; bTime <= endTimeB; bTime += secPerBeatB) {
            const beatX = centerX + ((bTime - curTimeB) / viewWindowB) * w;
            if (beatX >= 0 && beatX <= w) {
              const beatIndex = Math.round(bTime / secPerBeatB);
              const isBarStart = beatIndex % 4 === 0;

              if (isBarStart) {
                // Solid Amber Bar Start Grid Line
                ctx.strokeStyle = '#f59e0b';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.moveTo(beatX, 0);
                ctx.lineTo(beatX, h);
                ctx.stroke();

                ctx.fillStyle = '#f59e0b';
                ctx.font = '8px monospace';
                ctx.fillText(`B${Math.max(1, Math.floor(beatIndex / 4) + 1)}`, beatX + 2, h - 3);
              } else {
                // Bright Solid White Grid Lines for Beats 2, 3, 4
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.moveTo(beatX, 0);
                ctx.lineTo(beatX, h);
                ctx.stroke();

                // Crisp White Top Grid Dot
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(beatX, 2, 1.5, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          }

          // 2. Zero Center Line
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(0, h / 2);
          ctx.lineTo(w, h / 2);
          ctx.stroke();

          // 3. Draw Waveform Bars across Real-Time Window
          const numBarsToDraw = 64;
          const barWidth = w / numBarsToDraw;
          const barSpacing = 1.5;

          for (let i = 0; i < numBarsToDraw; i++) {
            const sampleTime = startTimeB + (i / numBarsToDraw) * viewWindowB;
            const peakIdx = Math.floor((sampleTime / durB) * totalPeaks);
            let peakVal = (peakIdx >= 0 && peakIdx < totalPeaks) ? (peaks[peakIdx] !== undefined ? peaks[peakIdx] : 0.2) : 0.08;

            // Dynamic Live Web Audio Spectrum pulse modulation at playhead
            const x = i * barWidth;
            if (activeB && Math.abs(x - centerX) < 24) {
              peakVal *= (1 + livePulseB);
            }

            const barHeight = Math.max(3, peakVal * (h * 0.82));
            const y = (h - barHeight) / 2;

            if (x < centerX) {
              ctx.fillStyle = '#ef4444'; // Played section
            } else {
              ctx.fillStyle = '#38bdf8'; // Upcoming section
            }

            ctx.fillRect(x, y, Math.max(1, barWidth - barSpacing), barHeight);
          }

          // 4. Render Active Loop Region Highlight if Active
          if (curLoopB.active && durB > 0) {
            const loopInX = centerX + ((curLoopB.inTime - curTimeB) / viewWindowB) * w;
            const loopOutX = centerX + ((curLoopB.outTime - curTimeB) / viewWindowB) * w;
            const renderLeft = Math.max(0, loopInX);
            const renderRight = Math.min(w, loopOutX);
            if (renderRight > renderLeft) {
              ctx.fillStyle = 'rgba(245, 158, 11, 0.3)';
              ctx.fillRect(renderLeft, 0, renderRight - renderLeft, h);
              ctx.strokeStyle = '#f59e0b';
              ctx.lineWidth = 1.5;
              ctx.strokeRect(renderLeft, 0, renderRight - renderLeft, h);
            }
          }

          // 5. Hot Cue Markers
          curCuesB.forEach((cueTime, idx) => {
            if (cueTime !== null && durB > 0) {
              const cueX = centerX + ((cueTime - curTimeB) / viewWindowB) * w;
              if (cueX >= 0 && cueX <= w) {
                ctx.fillStyle = '#22c55e';
                ctx.beginPath();
                ctx.arc(cueX, 6, 4, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#000000';
                ctx.font = '7px monospace';
                ctx.fillText(String(idx + 1), cueX - 2, 8);
              }
            }
          });

          // 6. Stationary Center Playhead
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(centerX - 1, 0, 2, h);

          // 7. Time Elapsed & Remaining Overlay
          ctx.fillStyle = '#f3f4f6';
          ctx.font = '9px monospace';
          const elapsedMins = Math.floor(curTimeB / 60);
          const elapsedSecs = Math.floor(curTimeB % 60);
          const remTotal = Math.max(0, durB - curTimeB);
          const remMins = Math.floor(remTotal / 60);
          const remSecs = Math.floor(remTotal % 60);

          ctx.fillText(`${String(elapsedMins).padStart(2, '0')}:${String(elapsedSecs).padStart(2, '0')}`, 4, 11);
          ctx.fillText(`-${String(remMins).padStart(2, '0')}:${String(remSecs).padStart(2, '0')}`, w - 38, 11);
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animId);
  }, []);

  // --- Sound Synthesis Utilities for Drum Pads ---
  const noiseBuffer = (c: AudioContext, dur: number) => {
    const n = c.sampleRate * dur;
    const buf = c.createBuffer(1, n, c.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  };

  const playKick = (dest: AudioNode) => {
    const c = getAudioContext();
    const t = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(150, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    gain.gain.setValueAtTime(1, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    osc.connect(gain).connect(dest);
    osc.start(t);
    osc.stop(t + 0.34);
  };

  const playSnare = (dest: AudioNode) => {
    const c = getAudioContext();
    const t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c, 0.2);
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 0.7;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.9, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
    src.connect(bp).connect(gain).connect(dest);

    const osc = c.createOscillator();
    const og = c.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 190;
    og.gain.setValueAtTime(0.5, t);
    og.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
    osc.connect(og).connect(dest);

    src.start(t);
    src.stop(t + 0.2);
    osc.start(t);
    osc.stop(t + 0.1);
  };

  const playHat = (dest: AudioNode, open: boolean) => {
    const c = getAudioContext();
    const t = c.currentTime;
    const src = c.createBufferSource();
    const dur = open ? 0.28 : 0.06;
    src.buffer = noiseBuffer(c, dur);
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 7000;
    const gain = c.createGain();
    gain.gain.setValueAtTime(open ? 0.5 : 0.55, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
    src.connect(hp).connect(gain).connect(dest);
    src.start(t);
    src.stop(t + dur);
  };

  const playClap = (dest: AudioNode) => {
    const c = getAudioContext();
    const t = c.currentTime;
    for (let i = 0; i < 3; i++) {
      const src = c.createBufferSource();
      src.buffer = noiseBuffer(c, 0.12);
      const bp = c.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1200;
      const gain = c.createGain();
      const start = t + i * 0.012;
      gain.gain.setValueAtTime(0.5, start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.1);
      src.connect(bp).connect(gain).connect(dest);
      src.start(start);
      src.stop(start + 0.12);
    }
  };

  const playTom = (dest: AudioNode) => {
    const c = getAudioContext();
    const t = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(90, t + 0.22);
    gain.gain.setValueAtTime(0.8, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
    osc.connect(gain).connect(dest);
    osc.start(t);
    osc.stop(t + 0.3);
  };

  const playRim = (dest: AudioNode) => {
    const c = getAudioContext();
    const t = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1400, t);
    osc.frequency.exponentialRampToValueAtTime(400, t + 0.03);
    gain.gain.setValueAtTime(0.7, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.035);
    osc.connect(gain).connect(dest);
    osc.start(t);
    osc.stop(t + 0.04);
  };

  const playCrash = (dest: AudioNode) => {
    const c = getAudioContext();
    const t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = noiseBuffer(c, 0.8);
    const hp = c.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 5000;
    const gain = c.createGain();
    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.75);
    src.connect(hp).connect(gain).connect(dest);
    src.start(t);
    src.stop(t + 0.8);
  };

  const playAirhorn = (dest: AudioNode) => {
    const c = getAudioContext();
    const t = c.currentTime;
    const osc1 = c.createOscillator();
    const osc2 = c.createOscillator();
    const gain = c.createGain();
    osc1.type = 'sawtooth';
    osc2.type = 'sawtooth';
    osc1.frequency.setValueAtTime(784, t);
    osc2.frequency.setValueAtTime(1046.5, t);
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(dest);
    osc1.start(t);
    osc2.start(t);
    osc1.stop(t + 0.36);
    osc2.stop(t + 0.36);
  };

  const playAcidStab = (dest: AudioNode) => {
    const c = getAudioContext();
    const t = c.currentTime;
    const osc = c.createOscillator();
    const filter = c.createBiquadFilter();
    const gain = c.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(110, t);
    filter.type = 'lowpass';
    filter.Q.value = 8;
    filter.frequency.setValueAtTime(3200, t);
    filter.frequency.exponentialRampToValueAtTime(250, t + 0.25);
    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
    osc.connect(filter).connect(gain).connect(dest);
    osc.start(t);
    osc.stop(t + 0.3);
  };

  const playSubBass = (dest: AudioNode) => {
    const c = getAudioContext();
    const t = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(130, t);
    osc.frequency.exponentialRampToValueAtTime(42, t + 0.45);
    gain.gain.setValueAtTime(0.85, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
    osc.connect(gain).connect(dest);
    osc.start(t);
    osc.stop(t + 0.52);
  };

  const playLaser = (dest: AudioNode) => {
    const c = getAudioContext();
    const t = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(2400, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.15);
    gain.gain.setValueAtTime(0.6, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(gain).connect(dest);
    osc.start(t);
    osc.stop(t + 0.18);
  };

  const playSiren = (dest: AudioNode) => {
    const c = getAudioContext();
    const t = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(600, t);
    osc.frequency.linearRampToValueAtTime(1200, t + 0.15);
    osc.frequency.linearRampToValueAtTime(600, t + 0.3);
    gain.gain.setValueAtTime(0.4, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
    osc.connect(gain).connect(dest);
    osc.start(t);
    osc.stop(t + 0.35);
  };

  const playRewind = (dest: AudioNode) => {
    const c = getAudioContext();
    const t = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(1800, t);
    osc.frequency.exponentialRampToValueAtTime(200, t + 0.35);
    gain.gain.setValueAtTime(0.5, t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
    osc.connect(gain).connect(dest);
    osc.start(t);
    osc.stop(t + 0.4);
  };

  // Throttled Scratch Sound trigger
  const lastScratchTimeRef = useRef(0);
  const playScratchThrottled = (dest: AudioNode, speed: number) => {
    const now = Date.now();
    if (now - lastScratchTimeRef.current < 60) return;
    lastScratchTimeRef.current = now;

    const c = getAudioContext();
    const t = c.currentTime;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = 'sawtooth';
    const baseFreq = 220 + Math.abs(speed) * 35;
    osc.frequency.setValueAtTime(baseFreq, t);
    osc.frequency.linearRampToValueAtTime(baseFreq * (speed > 0 ? 1.4 : 0.6), t + 0.08);

    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 1200 + Math.abs(speed) * 40;
    filter.Q.value = 3;

    gain.gain.setValueAtTime(Math.min(0.7, Math.abs(speed) * 0.08), t);
    gain.gain.exponentialRampToValueAtTime(0.001, t + 0.09);

    osc.connect(filter).connect(gain).connect(dest);
    osc.start(t);
    osc.stop(t + 0.1);
  };

  const triggerPadSample = (sound: string) => {
    getAudioContext();
    setActivePad(sound);
    setTimeout(() => setActivePad(null), 120);

    const dest = getMasterGain();
    if (sound === 'kick') playKick(dest);
    else if (sound === 'snare') playSnare(dest);
    else if (sound === 'chat') playHat(dest, false);
    else if (sound === 'ohat') playHat(dest, true);
    else if (sound === 'clap') playClap(dest);
    else if (sound === 'tom') playTom(dest);
    else if (sound === 'rim') playRim(dest);
    else if (sound === 'crash') playCrash(dest);
    else if (sound === 'airhorn') playAirhorn(dest);
    else if (sound === 'acid_stab') playAcidStab(dest);
    else if (sound === 'sub_bass') playSubBass(dest);
    else if (sound === 'laser') playLaser(dest);
    else if (sound === 'siren_fx') playSiren(dest);
    else if (sound === 'rewind') playRewind(dest);
    else if (sound === 'scratch_fast') playScratchThrottled(dest, 8);
    else if (sound === 'scratch_slow') playScratchThrottled(dest, -4);
  };

  // Performance Pad Execution per Mode (Deck A & Deck B)
  const handlePadPress = (deck: 'A' | 'B', padIdx: number, sampleSound: string) => {
    getAudioContext();
    const mode = deck === 'A' ? padModeA : padModeB;
    const audio = deck === 'A' ? audioARef.current : audioBRef.current;
    const setHotCues = deck === 'A' ? setHotCuesA : setHotCuesB;
    const hotCues = deck === 'A' ? hotCuesA : hotCuesB;
    const currentBpm = deck === 'A' ? trackA.bpm * Math.pow(2, pitchA / 96) : trackB.bpm * Math.pow(2, pitchB / 96);
    const setLoop = deck === 'A' ? setLoopA : setLoopB;

    if (mode === 'SAMPLER') {
      triggerPadSample(sampleSound);
    } else if (mode === 'HOT_CUE') {
      if (!audio) return;
      const targetCue = hotCues[padIdx];
      if (targetCue === null) {
        // Set Hot Cue at quantized current position
        const newCues = [...hotCues];
        newCues[padIdx] = getQuantizedTime(deck, audio.currentTime);
        setHotCues(newCues);
      } else {
        // Jump to Hot Cue position (quantized)
        audio.currentTime = getQuantizedTime(deck, targetCue);
        if (deck === 'A' && !isPlayingA) {
          setIsPlayingA(true);
        } else if (deck === 'B' && !isPlayingB) {
          setIsPlayingB(true);
        }
      }
    } else if (mode === 'BEAT_LOOP') {
      if (!audio) return;
      const beatMultipliers = [0.0625, 0.125, 0.25, 0.5, 1, 2, 4, 8];
      const beats = beatMultipliers[padIdx] || 4;
      const loopDur = beats * (60 / currentBpm);
      const qIn = getQuantizedTime(deck, audio.currentTime);
      setLoop({
        active: true,
        inTime: qIn,
        outTime: qIn + loopDur,
        duration: loopDur,
      });
    } else if (mode === 'BEAT_JUMP') {
      if (!audio) return;
      const jumpSteps = [-8, -4, -2, -1, 1, 2, 4, 8];
      const stepBeats = jumpSteps[padIdx] || 1;
      const jumpSecs = stepBeats * (60 / currentBpm);
      const newTime = Math.max(0, Math.min(audio.duration || 180, audio.currentTime + jumpSecs));
      audio.currentTime = newTime;
    }
  };

  // Toggle Play / Pause
  const togglePlayA = () => {
    getAudioContext();
    if (isPlayingA) {
      setIsPlayingA(false);
      if (platterARef.current) platterARef.current.style.animationPlayState = 'paused';
    } else {
      setIsPlayingA(true);
      if (platterARef.current) platterARef.current.style.animationPlayState = 'running';
    }
  };

  const togglePlayB = () => {
    getAudioContext();
    if (isPlayingB) {
      setIsPlayingB(false);
      if (platterBRef.current) platterBRef.current.style.animationPlayState = 'paused';
    } else {
      setIsPlayingB(true);
      if (platterBRef.current) platterBRef.current.style.animationPlayState = 'running';
    }
  };

  // Interactive Waveform Dragging & Scratching Handlers for Deck A
  const handleWaveformPointerDownA = (e: React.PointerEvent<HTMLCanvasElement>) => {
    getAudioContext();
    const canvas = waveformCanvasARef.current;
    const audio = audioARef.current;
    if (!canvas || !audio) return;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {}
    isScratchingWaveformARef.current = true;
    lastWaveformXARef.current = e.clientX;
  };

  const handleWaveformPointerMoveA = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isScratchingWaveformARef.current) return;
    const canvas = waveformCanvasARef.current;
    const audio = audioARef.current;
    if (!canvas || !audio) return;

    const dx = e.clientX - lastWaveformXARef.current;
    lastWaveformXARef.current = e.clientX;

    if (Math.abs(dx) > 0.4) {
      const bpmA = Math.max(40, trackA.bpm);
      const secPerBeatA = 60 / bpmA;
      const viewWindowA = 16 * secPerBeatA;
      const timeChange = -(dx / canvas.width) * viewWindowA;
      const newTime = Math.max(0, Math.min(audio.duration || 180, audio.currentTime + timeChange));
      audio.currentTime = newTime;

      // Real-time audio scratch sound feedback
      playScratchThrottled(getMasterGain(), dx * 0.5);
    }
  };

  const handleWaveformPointerUpA = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isScratchingWaveformARef.current) {
      isScratchingWaveformARef.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  // Interactive Waveform Dragging & Scratching Handlers for Deck B
  const handleWaveformPointerDownB = (e: React.PointerEvent<HTMLCanvasElement>) => {
    getAudioContext();
    const canvas = waveformCanvasBRef.current;
    const audio = audioBRef.current;
    if (!canvas || !audio) return;
    try {
      canvas.setPointerCapture(e.pointerId);
    } catch {}
    isScratchingWaveformBRef.current = true;
    lastWaveformXBRef.current = e.clientX;
  };

  const handleWaveformPointerMoveB = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isScratchingWaveformBRef.current) return;
    const canvas = waveformCanvasBRef.current;
    const audio = audioBRef.current;
    if (!canvas || !audio) return;

    const dx = e.clientX - lastWaveformXBRef.current;
    lastWaveformXBRef.current = e.clientX;

    if (Math.abs(dx) > 0.4) {
      const bpmB = Math.max(40, trackB.bpm);
      const secPerBeatB = 60 / bpmB;
      const viewWindowB = 16 * secPerBeatB;
      const timeChange = -(dx / canvas.width) * viewWindowB;
      const newTime = Math.max(0, Math.min(audio.duration || 180, audio.currentTime + timeChange));
      audio.currentTime = newTime;

      // Real-time audio scratch sound feedback
      playScratchThrottled(getMasterGain(), dx * 0.5);
    }
  };

  const handleWaveformPointerUpB = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isScratchingWaveformBRef.current) {
      isScratchingWaveformBRef.current = false;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  // Pioneer CDJ Master Cue Handlers (Sets starting point bookmark when paused / jumps & stops when playing)
  const handleCuePointerDownA = () => {
    getAudioContext();
    const a = audioARef.current;
    if (!a) return;
    if (isPlayingA) {
      setIsPlayingA(false);
      a.pause();
      a.currentTime = cuePointA;
    } else {
      const qCue = getQuantizedTime('A', a.currentTime);
      setCuePointA(qCue);
      a.currentTime = qCue;
      setIsCueingA(true);
      a.play().catch(() => {});
    }
  };

  const handleCuePointerUpA = () => {
    if (isCueingA) {
      const a = audioARef.current;
      if (a) {
        a.pause();
        a.currentTime = cuePointA;
      }
      setIsCueingA(false);
    }
  };

  const handleCuePointerDownB = () => {
    getAudioContext();
    const b = audioBRef.current;
    if (!b) return;
    if (isPlayingB) {
      setIsPlayingB(false);
      b.pause();
      b.currentTime = cuePointB;
    } else {
      const qCue = getQuantizedTime('B', b.currentTime);
      setCuePointB(qCue);
      b.currentTime = qCue;
      setIsCueingB(true);
      b.play().catch(() => {});
    }
  };

  const handleCuePointerUpB = () => {
    if (isCueingB) {
      const b = audioBRef.current;
      if (b) {
        b.pause();
        b.currentTime = cuePointB;
      }
      setIsCueingB(false);
    }
  };

  // Auto & Manual Beat Looping Controls
  const toggle4BeatLoopA = () => {
    const a = audioARef.current;
    if (!a) return;
    if (loopA.active) {
      setLoopA((prev) => ({ ...prev, active: false }));
    } else {
      const bpmA = trackA.bpm * Math.pow(2, pitchA / 96);
      const dur = 4 * (60 / bpmA);
      const qIn = getQuantizedTime('A', a.currentTime);
      setLoopA({
        active: true,
        inTime: qIn,
        outTime: qIn + dur,
        duration: dur,
      });
    }
  };

  const toggle4BeatLoopB = () => {
    const b = audioBRef.current;
    if (!b) return;
    if (loopB.active) {
      setLoopB((prev) => ({ ...prev, active: false }));
    } else {
      const bpmB = trackB.bpm * Math.pow(2, pitchB / 96);
      const dur = 4 * (60 / bpmB);
      const qIn = getQuantizedTime('B', b.currentTime);
      setLoopB({
        active: true,
        inTime: qIn,
        outTime: qIn + dur,
        duration: dur,
      });
    }
  };

  const handleManualInOutA = () => {
    const a = audioARef.current;
    if (!a) return;
    if (!loopA.active && manualLoopStepA === 'IDLE') {
      setLoopA({ active: false, inTime: a.currentTime, outTime: a.currentTime + 4, duration: 4 });
      setManualLoopStepA('IN_SET');
    } else if (!loopA.active && manualLoopStepA === 'IN_SET') {
      const outT = Math.max(a.currentTime, loopA.inTime + 0.2);
      const dur = outT - loopA.inTime;
      setLoopA({ active: true, inTime: loopA.inTime, outTime: outT, duration: dur });
      setManualLoopStepA('IDLE');
    } else {
      setLoopA((prev) => ({ ...prev, active: false }));
      setManualLoopStepA('IDLE');
    }
  };

  const handleManualInOutB = () => {
    const b = audioBRef.current;
    if (!b) return;
    if (!loopB.active && manualLoopStepB === 'IDLE') {
      setLoopB({ active: false, inTime: b.currentTime, outTime: b.currentTime + 4, duration: 4 });
      setManualLoopStepB('IN_SET');
    } else if (!loopB.active && manualLoopStepB === 'IN_SET') {
      const outT = Math.max(b.currentTime, loopB.inTime + 0.2);
      const dur = outT - loopB.inTime;
      setLoopB({ active: true, inTime: loopB.inTime, outTime: outT, duration: dur });
      setManualLoopStepB('IDLE');
    } else {
      setLoopB((prev) => ({ ...prev, active: false }));
      setManualLoopStepB('IDLE');
    }
  };

  const handleLoopCallHalveA = () => {
    if (!loopA.active) return;
    const newDur = Math.max(0.125, loopA.duration / 2);
    setLoopA({ ...loopA, duration: newDur, outTime: loopA.inTime + newDur });
  };

  const handleLoopCallDoubleA = () => {
    if (!loopA.active) return;
    const newDur = Math.min(64, loopA.duration * 2);
    setLoopA({ ...loopA, duration: newDur, outTime: loopA.inTime + newDur });
  };

  const handleLoopCallHalveB = () => {
    if (!loopB.active) return;
    const newDur = Math.max(0.125, loopB.duration / 2);
    setLoopB({ ...loopB, duration: newDur, outTime: loopB.inTime + newDur });
  };

  const handleLoopCallDoubleB = () => {
    if (!loopB.active) return;
    const newDur = Math.min(64, loopB.duration * 2);
    setLoopB({ ...loopB, duration: newDur, outTime: loopB.inTime + newDur });
  };

  // Perfect Beat SYNC to Master Deck (Tempo & Beat Grid Alignment)
  const handleSyncA = () => {
    getAudioContext();
    const a = audioARef.current;
    const b = audioBRef.current;
    if (!a || !b) return;

    setMasterDeck('B');

    // 1. Calculate Master Deck B Effective BPM
    const effectiveBpmB = trackB.bpm * Math.pow(2, pitchB / 96);
    
    // 2. Calculate Exact Pitch for Deck A to match Effective BPM B
    const neededPitchA = 96 * Math.log2(effectiveBpmB / trackA.bpm);
    const clampedPitchA = parseFloat(Math.max(-16, Math.min(16, neededPitchA)).toFixed(2));
    setPitchA(clampedPitchA);

    const effectiveRateA = Math.pow(2, clampedPitchA / 96);
    a.playbackRate = effectiveRateA;

    // 3. Align Beat Grid Phase (Millisecond Beat Alignment)
    const secPerBeat = 60 / effectiveBpmB;
    const masterBeatPhase = b.currentTime % secPerBeat;
    const incomingBeatPhase = a.currentTime % secPerBeat;
    
    let phaseDiff = masterBeatPhase - incomingBeatPhase;
    if (phaseDiff > secPerBeat / 2) phaseDiff -= secPerBeat;
    else if (phaseDiff < -secPerBeat / 2) phaseDiff += secPerBeat;

    a.currentTime = Math.max(0, Math.min(a.duration || 180, a.currentTime + phaseDiff));
  };

  const handleSyncB = () => {
    getAudioContext();
    const a = audioARef.current;
    const b = audioBRef.current;
    if (!a || !b) return;

    setMasterDeck('A');

    // 1. Calculate Master Deck A Effective BPM
    const effectiveBpmA = trackA.bpm * Math.pow(2, pitchA / 96);

    // 2. Calculate Exact Pitch for Deck B to match Effective BPM A
    const neededPitchB = 96 * Math.log2(effectiveBpmA / trackB.bpm);
    const clampedPitchB = parseFloat(Math.max(-16, Math.min(16, neededPitchB)).toFixed(2));
    setPitchB(clampedPitchB);

    const effectiveRateB = Math.pow(2, clampedPitchB / 96);
    b.playbackRate = effectiveRateB;

    // 3. Align Beat Grid Phase (Millisecond Beat Alignment)
    const secPerBeat = 60 / effectiveBpmA;
    const masterBeatPhase = a.currentTime % secPerBeat;
    const incomingBeatPhase = b.currentTime % secPerBeat;

    let phaseDiff = masterBeatPhase - incomingBeatPhase;
    if (phaseDiff > secPerBeat / 2) phaseDiff -= secPerBeat;
    else if (phaseDiff < -secPerBeat / 2) phaseDiff += secPerBeat;

    b.currentTime = Math.max(0, Math.min(b.duration || 180, b.currentTime + phaseDiff));
  };

  // Pitch Handlers
  const handlePitchA = (val: number) => {
    setPitchA(val);
    if (platterARef.current) {
      const rateA = Math.max(0.5, Math.min(2, Math.pow(2, val / 96)));
      platterARef.current.style.animationDuration = `${3.6 / rateA}s`;
    }
  };

  const handlePitchB = (val: number) => {
    setPitchB(val);
    if (platterBRef.current) {
      const rateB = Math.max(0.5, Math.min(2, Math.pow(2, val / 96)));
      platterBRef.current.style.animationDuration = `${3.6 / rateB}s`;
    }
  };

  // Stable Platter Interaction Setup Attached ONCE on Mount
  useEffect(() => {
    const setupPlatter = (platterEl: HTMLDivElement | null, deck: 'A' | 'B') => {
      if (!platterEl) return () => {};
      let dragging = false;
      let isScratchZone = false;
      let lastAngle = 0;
      let center = { x: 0, y: 0 };

      const getAngle = (e: PointerEvent) => {
        return Math.atan2(e.clientY - center.y, e.clientX - center.x) * (180 / Math.PI);
      };

      const onPointerDown = (e: PointerEvent) => {
        getAudioContext();
        dragging = true;
        const rect = platterEl.getBoundingClientRect();
        center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
        const distFromCenter = Math.hypot(e.clientX - center.x, e.clientY - center.y);

        isScratchZone = distFromCenter < rect.width * 0.38;
        lastAngle = getAngle(e);
        platterEl.style.animationPlayState = 'paused';
        platterEl.setPointerCapture(e.pointerId);
      };

      const onPointerMove = (e: PointerEvent) => {
        if (!dragging) return;
        const angle = getAngle(e);
        let delta = angle - lastAngle;
        if (delta > 180) delta -= 360;
        if (delta < -180) delta += 360;
        lastAngle = angle;

        const current = platterEl.style.transform.match(/-?\d+(\.\d+)?/);
        const curDeg = current ? parseFloat(current[0]) : 0;
        platterEl.style.transform = `rotate(${curDeg + delta}deg)`;

        if (isScratchZone) {
          const audio = deck === 'A' ? audioARef.current : audioBRef.current;
          if (audio && audio.duration) {
            audio.currentTime = Math.max(0, Math.min(audio.duration, audio.currentTime + delta * 0.04));
          }
          if (Math.abs(delta) > 0.4) {
            playScratchThrottled(getMasterGain(), delta * 8);
          }
        } else {
          const nudgeRef = deck === 'A' ? pitchNudgeARef : pitchNudgeBRef;
          nudgeRef.current = delta > 0 ? 3.5 : -3.5;
          setTimeout(() => {
            nudgeRef.current = 0;
          }, 150);
        }
      };

      const onPointerUp = (e: PointerEvent) => {
        if (!dragging) return;
        dragging = false;
        try {
          platterEl.releasePointerCapture(e.pointerId);
        } catch {
          // Pointer capture released automatically
        }
        const active = deck === 'A' ? isPlayingARef.current : isPlayingBRef.current;
        if (active) {
          platterEl.style.animationPlayState = 'running';
        }
      };

      platterEl.addEventListener('pointerdown', onPointerDown);
      platterEl.addEventListener('pointermove', onPointerMove);
      platterEl.addEventListener('pointerup', onPointerUp);
      platterEl.addEventListener('pointercancel', onPointerUp);

      return () => {
        platterEl.removeEventListener('pointerdown', onPointerDown);
        platterEl.removeEventListener('pointermove', onPointerMove);
        platterEl.removeEventListener('pointerup', onPointerUp);
        platterEl.removeEventListener('pointercancel', onPointerUp);
      };
    };

    const cleanA = setupPlatter(platterARef.current, 'A');
    const cleanB = setupPlatter(platterBRef.current, 'B');

    return () => {
      cleanA();
      cleanB();
    };
  }, [getAudioContext, getMasterGain]);

  // Keyboard Hotkeys listener for drum pads
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat || e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return;
      const key = e.key.toUpperCase();
      const activeKitPads = PAD_KITS[selectedPack]?.pads || PAD_KITS.edm.pads;
      const padIdx = activeKitPads.findIndex((p) => p.hotkey === key);
      if (padIdx !== -1) {
        const pad = activeKitPads[padIdx];
        handlePadPress('A', padIdx, pad.sound);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedPack, padModeA, padModeB, hotCuesA, hotCuesB, isPlayingA, isPlayingB, trackA, trackB, pitchA, pitchB]);

  // Load Track into Deck A or B
  const loadTrackToDeckA = (t: LiveConsoleTrack) => {
    setTrackA(t);
    setCuePointA(0);
    setLoopA((prev) => ({ ...prev, active: false }));
    if (audioARef.current) {
      audioARef.current.currentTime = 0;
    }
  };

  const loadTrackToDeckB = (t: LiveConsoleTrack) => {
    setTrackB(t);
    setCuePointB(0);
    setLoopB((prev) => ({ ...prev, active: false }));
    if (audioBRef.current) {
      audioBRef.current.currentTime = 0;
    }
  };

  const currentBpmA = Math.round(trackA.bpm * Math.pow(2, pitchA / 96));
  const currentBpmB = Math.round(trackB.bpm * Math.pow(2, pitchB / 96));

  const currentPads = PAD_KITS[selectedPack]?.pads || PAD_KITS.edm.pads;
  const leftPads = currentPads.slice(0, 4);
  const rightPads = currentPads.slice(4, 8);

  const getPadLabel = (mode: PadMode, idx: number, defaultName: string) => {
    if (mode === 'HOT_CUE') return `CUE ${idx + 1}`;
    if (mode === 'BEAT_LOOP') {
      const labels = ['1/16', '1/8', '1/4', '1/2', '1BEAT', '2BEAT', '4BEAT', '8BEAT'];
      return labels[idx] || 'LOOP';
    }
    if (mode === 'BEAT_JUMP') {
      const labels = ['-8B', '-4B', '-2B', '-1B', '+1B', '+2B', '+4B', '+8B'];
      return labels[idx] || 'JUMP';
    }
    return defaultName;
  };

  return (
    <div
      ref={outerRef}
      className={styles.outerContainer}
      style={{ height: scaledHeight ? `${scaledHeight}px` : undefined }}
    >
      <div
        ref={innerRef}
        className={styles.wrap}
        style={
          scale < 1
            ? {
                width: '1040px',
                transform: `scale(${scale}) translateZ(0)`,
                transformOrigin: 'top left',
                willChange: 'transform',
              }
            : undefined
        }
      >
        <div className={styles.console}>
        {/* Hardware Top Chassis Bar */}
        <div className={styles.topbar}>
          <div className={styles.brand}>
            <span className={styles.powerDot} />
            <span>SOUNDABODE</span>
            <span className={styles.modelTag}>DDJ-FLX4 PRO</span>
          </div>
          <div className={styles.masterReadout}>
            MASTER: <span className={styles.redValue}>0.0 dB</span>
          </div>
        </div>

        {/* DDJ-FLX4 Console Layout: Deck A | Center Mixer | Deck B */}
        <div className={styles.flxGrid}>
          {/* ==================== DECK A (LEFT) ==================== */}
          <div className={`${styles.deck} ${isPlayingA ? styles.playing : ''}`} id="deckA">
            {/* Deck Header & Track Title */}
            <div className={styles.deckHeaderRow}>
              <div className={styles.deckLabel}>
                DECK <span>A</span>
              </div>
              <div className={styles.deckTrackName} title={`${trackA.artist} - ${trackA.name}`}>
                {trackA.artist} - {trackA.name}
              </div>
            </div>

            {/* Real Interactive Waveform Canvas */}
            <div className={styles.waveformWrapper} title="Interactive Audio Waveform (Click & Drag to Scrub / Scratch Track)">
              <canvas
                ref={waveformCanvasARef}
                className={styles.waveformCanvas}
                width={280}
                height={34}
                onPointerDown={handleWaveformPointerDownA}
                onPointerMove={handleWaveformPointerMoveA}
                onPointerUp={handleWaveformPointerUpA}
                onPointerCancel={handleWaveformPointerUpA}
                style={{ cursor: 'ew-resize', touchAction: 'none' }}
              />
              <div className={styles.playheadMarker} />
            </div>

            {/* Performance Pad Mode Switcher Bar */}
            <div className={styles.padModeBar}>
              <button
                type="button"
                className={`${styles.modeBtn} ${padModeA === 'HOT_CUE' ? styles.modeBtnActive : ''}`}
                onClick={() => setPadModeA('HOT_CUE')}
              >
                HOT CUE
              </button>
              <button
                type="button"
                className={`${styles.modeBtn} ${padModeA === 'BEAT_LOOP' ? styles.modeBtnActive : ''}`}
                onClick={() => setPadModeA('BEAT_LOOP')}
              >
                BEAT LOOP
              </button>
              <button
                type="button"
                className={`${styles.modeBtn} ${padModeA === 'SAMPLER' ? styles.modeBtnActive : ''}`}
                onClick={() => setPadModeA('SAMPLER')}
              >
                SAMPLER
              </button>
              <button
                type="button"
                className={`${styles.modeBtn} ${padModeA === 'BEAT_JUMP' ? styles.modeBtnActive : ''}`}
                onClick={() => setPadModeA('BEAT_JUMP')}
              >
                BEAT JUMP
              </button>
            </div>

            {/* Top Utility Strip above Jog Wheel (IN/OUT, 4 BEAT, LOOP CALL, MASTER/SYNC) */}
            <div className={styles.topUtilityStrip}>
              <button
                type="button"
                className={`${styles.utilityBtn} ${loopA.active ? styles.activeUtil : ''}`}
                onClick={handleManualInOutA}
                title="Manual Loop In / Out Set & Toggle"
              >
                IN / OUT
              </button>
              <button
                type="button"
                className={`${styles.utilityBtn} ${loopA.active ? styles.activeUtil : ''}`}
                onClick={toggle4BeatLoopA}
                title="Auto 4 Beat Loop"
              >
                4 BEAT
              </button>
              <button
                type="button"
                className={styles.utilityBtn}
                onClick={handleLoopCallHalveA}
                title="Halve active loop length (1/2x)"
              >
                ◄ 1/2
              </button>
              <button
                type="button"
                className={styles.utilityBtn}
                onClick={handleLoopCallDoubleA}
                title="Double active loop length (2x)"
              >
                2x ►
              </button>
              <button
                type="button"
                className={`${styles.utilityBtn} ${quantizeA ? styles.activeMaster : ''}`}
                onClick={() => setQuantizeA(!quantizeA)}
                title="Quantize Toggle (Snaps Cues & Loops to Beat Grid)"
              >
                Q: {quantizeA ? 'ON' : 'OFF'}
              </button>
              <button
                type="button"
                className={`${styles.utilityBtn} ${masterDeck === 'A' ? styles.activeMaster : ''}`}
                onClick={() => setMasterDeck('A')}
                title="Set Deck A as Master BPM reference"
              >
                MASTER
              </button>
              <button
                type="button"
                className={`${styles.utilityBtn} ${masterDeck === 'B' ? styles.activeSync : ''}`}
                onClick={handleSyncA}
                title="Sync Deck A BPM to Master Deck B"
              >
                SYNC
              </button>
            </div>

            {/* Main Jog Wheel & Flanking Performance Controls */}
            <div className={styles.deckBodyRow}>
              {/* Left Flank: 4 Performance Pads + Trim Knob */}
              <div className={styles.flankLeft}>
                <div className={styles.padGridMini}>
                  {leftPads.map((pad, idx) => (
                    <button
                      key={`deckA-${pad.sound}-${idx}`}
                      type="button"
                      className={`${styles.padMini} ${activePad === pad.sound ? styles.hit : ''} ${
                        padModeA === 'HOT_CUE' && hotCuesA[idx] !== null ? styles.cueSet : ''
                      }`}
                      onPointerDown={() => handlePadPress('A', idx, pad.sound)}
                    >
                      <span className={styles.padKey}>{pad.hotkey}</span>
                      <span className={styles.padName}>{getPadLabel(padModeA, idx, pad.keyName)}</span>
                    </button>
                  ))}
                </div>
                <div className={styles.flankKnobBox}>
                  <RotaryKnob
                    label="TRIM"
                    value={trimA}
                    min={-12}
                    max={12}
                    unit="dB"
                    defaultValue={0}
                    onChange={setTrimA}
                    size="sm"
                  />
                </div>
              </div>

              {/* Center Platter: Brushed Metal Jog Wheel */}
              <div className={styles.platterZone}>
                <div ref={platterARef} className={styles.platter} id="platterA">
                  <div className={styles.platterConcentric} />
                  <div className={styles.labelDisc}>
                    <span>SOUND</span>
                    <span>ABODE</span>
                  </div>
                  <div className={styles.platterMarkerDot} />
                </div>
              </div>

              {/* Right Flank: 4 Mirrored Performance Pads */}
              <div className={styles.flankRight}>
                <div className={styles.padGridMini}>
                  {rightPads.map((pad, idx) => {
                    const padIdx = idx + 4;
                    return (
                      <button
                        key={`deckA-${pad.sound}-${padIdx}`}
                        type="button"
                        className={`${styles.padMini} ${activePad === pad.sound ? styles.hit : ''} ${
                          padModeA === 'HOT_CUE' && hotCuesA[padIdx] !== null ? styles.cueSet : ''
                        }`}
                        onPointerDown={() => handlePadPress('A', padIdx, pad.sound)}
                      >
                        <span className={styles.padKey}>{pad.hotkey}</span>
                        <span className={styles.padName}>{getPadLabel(padModeA, padIdx, pad.keyName)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Full-Width Horizontal Tempo / Pitch Fader */}
            <div className={styles.fullWidthPitchSection}>
              <div className={styles.pitchMeta}>
                <span className={styles.pitchLabel}>TEMPO / PITCH</span>
                <span className={styles.pitchReadout}>
                  <span className={styles.redValue}>{pitchA > 0 ? `+${pitchA}` : pitchA}%</span>
                  <span className={styles.bpmSeparator}>|</span>
                  <span className={styles.redValue}>{currentBpmA} BPM</span>
                </span>
              </div>
              <div className={styles.faderGrooveTrack}>
                <input
                  id="pitchA"
                  type="range"
                  className={styles.tempoRangeInput}
                  min="-8"
                  max="8"
                  value={pitchA}
                  step="1"
                  onChange={(e) => handlePitchA(parseFloat(e.target.value))}
                />
              </div>
            </div>

            {/* Bottom Transport: Square Side-by-Side PLAY/PAUSE & CUE */}
            <div className={styles.deckBottomRow}>
              <div className={styles.transportButtons}>
                <button
                  type="button"
                  className={`${styles.sqBtn} ${styles.sqPlay} ${isPlayingA ? styles.sqPlayActive : ''}`}
                  onClick={togglePlayA}
                >
                  <span className={styles.playIcon}>{isPlayingA ? '❚❚' : '▶'}</span>
                  <span>PLAY/PAUSE</span>
                </button>
                <button
                  type="button"
                  className={`${styles.sqBtn} ${styles.sqCue} ${isCueingA ? styles.sqCueActive : ''}`}
                  onPointerDown={handleCuePointerDownA}
                  onPointerUp={handleCuePointerUpA}
                  onPointerCancel={handleCuePointerUpA}
                >
                  <span>CUE</span>
                </button>
              </div>
              <div className={styles.deckStatusLed}>
                <span className={`${styles.ledDot} ${isPlayingA ? styles.ledGreen : ''}`} />
                <span>{isPlayingA ? 'PLAYING' : 'STOPPED'}</span>
              </div>
            </div>
          </div>

          {/* ==================== CENTER MIXER COLUMN ==================== */}
          <div className={styles.mixerColumn}>
            {/* Top Load Arrows & Channel Select LEDs */}
            <div className={styles.mixerHeader}>
              <div className={styles.loadGroup}>
                <button
                  type="button"
                  className={`${styles.loadArrowBtn} ${styles.loadA}`}
                  onClick={() => loadTrackToDeckA(selectedLibraryTrack)}
                  title="Load selected track in library to Deck A"
                >
                  ◄ LOAD A
                </button>
                <div className={styles.channelLeds}>
                  <span className={`${styles.chLed} ${masterDeck === 'A' ? styles.chLedActive : ''}`}>A</span>
                  <span className={`${styles.chLed} ${masterDeck === 'B' ? styles.chLedActive : ''}`}>B</span>
                </div>
                <button
                  type="button"
                  className={`${styles.loadArrowBtn} ${styles.loadB}`}
                  onClick={() => loadTrackToDeckB(selectedLibraryTrack)}
                  title="Load selected track in library to Deck B"
                >
                  LOAD B ►
                </button>
              </div>
            </div>

            {/* Vertical Channel Strips (CH A & CH B EQ/Filter Stack) */}
            <div className={styles.channelStripsContainer}>
              {/* Channel A Strip */}
              <div className={styles.chStrip}>
                <span className={styles.stripTitle}>CH A</span>
                <RotaryKnob label="TRIM" value={trimA} min={-12} max={12} unit="dB" defaultValue={0} onChange={setTrimA} size="sm" />
                <RotaryKnob label="HI" value={hiA} min={-26} max={6} unit="dB" defaultValue={0} onChange={setHiA} size="sm" />
                <RotaryKnob label="MID" value={midA} min={-26} max={6} unit="dB" defaultValue={0} onChange={setMidA} size="sm" />
                <RotaryKnob label="LOW" value={lowA} min={-26} max={6} unit="dB" defaultValue={0} onChange={setLowA} size="sm" />
                <RotaryKnob label="FILTER" value={filterA} min={-50} max={50} defaultValue={0} onChange={setFilterA} size="sm" />

                {/* Round Headphone CUE Button */}
                <button
                  type="button"
                  className={`${styles.roundCueBtn} ${cueHeadphoneA ? styles.roundCueActive : ''}`}
                  onClick={() => setCueHeadphoneA(!cueHeadphoneA)}
                  title="Headphone Monitor Cue CH A"
                >
                  CUE
                </button>
              </div>

              {/* Central Level Meters (Dynamic Real-Time VU Meters) */}
              <div className={styles.centerVuStack}>
                <div className={styles.vuMeterBox}>
                  <div className={styles.vuMeterBar}>
                    <div ref={vuARef} className={styles.vuFill} style={{ height: '0%' }} />
                  </div>
                  <div className={styles.vuMeterBar}>
                    <div ref={vuBRef} className={styles.vuFill} style={{ height: '0%' }} />
                  </div>
                </div>
              </div>

              {/* Channel B Strip */}
              <div className={styles.chStrip}>
                <span className={styles.stripTitle}>CH B</span>
                <RotaryKnob label="TRIM" value={trimB} min={-12} max={12} unit="dB" defaultValue={0} onChange={setTrimB} size="sm" />
                <RotaryKnob label="HI" value={hiB} min={-26} max={6} unit="dB" defaultValue={0} onChange={setHiB} size="sm" />
                <RotaryKnob label="MID" value={midB} min={-26} max={6} unit="dB" defaultValue={0} onChange={setMidB} size="sm" />
                <RotaryKnob label="LOW" value={lowB} min={-26} max={6} unit="dB" defaultValue={0} onChange={setLowB} size="sm" />
                <RotaryKnob label="FILTER" value={filterB} min={-50} max={50} defaultValue={0} onChange={setFilterB} size="sm" />

                {/* Round Headphone CUE Button */}
                <button
                  type="button"
                  className={`${styles.roundCueBtn} ${cueHeadphoneB ? styles.roundCueActive : ''}`}
                  onClick={() => setCueHeadphoneB(!cueHeadphoneB)}
                  title="Headphone Monitor Cue CH B"
                >
                  CUE
                </button>
              </div>
            </div>

            {/* Vertical Channel Volume Faders */}
            <div className={styles.verticalFadersRow}>
              <div className={styles.vFaderBox}>
                <span className={styles.vFaderVal}>{Math.round(volA * 100)}%</span>
                <div className={styles.vTrackGroove}>
                  <input
                    id="volA"
                    type="range"
                    className={styles.vRangeInput}
                    min="0"
                    max="1"
                    value={volA}
                    step="0.01"
                    onChange={(e) => setVolA(parseFloat(e.target.value))}
                  />
                </div>
                <span className={styles.vFaderLabel}>CH A</span>
              </div>

              <div className={styles.vFaderBox}>
                <span className={styles.vFaderVal}>{Math.round(volB * 100)}%</span>
                <div className={styles.vTrackGroove}>
                  <input
                    id="volB"
                    type="range"
                    className={styles.vRangeInput}
                    min="0"
                    max="1"
                    value={volB}
                    step="0.01"
                    onChange={(e) => setVolB(parseFloat(e.target.value))}
                  />
                </div>
                <span className={styles.vFaderLabel}>CH B</span>
              </div>
            </div>

            {/* Bottom Horizontal Crossfader */}
            <div className={styles.crossfaderSection}>
              <div className={styles.crossfaderHeader}>
                <span className={styles.xfTag}>A</span>
                <span className={styles.xfLabel}>CROSSFADER</span>
                <span className={styles.xfTag}>B</span>
              </div>
              <div className={styles.crossfaderGroove}>
                <input
                  id="xfader"
                  type="range"
                  className={styles.crossfaderInput}
                  min="0"
                  max="100"
                  value={xfaderVal}
                  onChange={(e) => setXfaderVal(parseFloat(e.target.value))}
                />
              </div>
            </div>
          </div>

          {/* ==================== DECK B (RIGHT) ==================== */}
          <div className={`${styles.deck} ${isPlayingB ? styles.playing : ''}`} id="deckB">
            {/* Deck Header & Track Title */}
            <div className={styles.deckHeaderRow}>
              <div className={styles.deckLabel}>
                DECK <span>B</span>
              </div>
              <div className={styles.deckTrackName} title={`${trackB.artist} - ${trackB.name}`}>
                {trackB.artist} - {trackB.name}
              </div>
            </div>

            {/* Real Interactive Waveform Canvas */}
            <div className={styles.waveformWrapper} title="Interactive Audio Waveform (Click & Drag to Scrub / Scratch Track)">
              <canvas
                ref={waveformCanvasBRef}
                className={styles.waveformCanvas}
                width={280}
                height={34}
                onPointerDown={handleWaveformPointerDownB}
                onPointerMove={handleWaveformPointerMoveB}
                onPointerUp={handleWaveformPointerUpB}
                onPointerCancel={handleWaveformPointerUpB}
                style={{ cursor: 'ew-resize', touchAction: 'none' }}
              />
              <div className={styles.playheadMarker} />
            </div>

            {/* Performance Pad Mode Switcher Bar */}
            <div className={styles.padModeBar}>
              <button
                type="button"
                className={`${styles.modeBtn} ${padModeB === 'HOT_CUE' ? styles.modeBtnActive : ''}`}
                onClick={() => setPadModeB('HOT_CUE')}
              >
                HOT CUE
              </button>
              <button
                type="button"
                className={`${styles.modeBtn} ${padModeB === 'BEAT_LOOP' ? styles.modeBtnActive : ''}`}
                onClick={() => setPadModeB('BEAT_LOOP')}
              >
                BEAT LOOP
              </button>
              <button
                type="button"
                className={`${styles.modeBtn} ${padModeB === 'SAMPLER' ? styles.modeBtnActive : ''}`}
                onClick={() => setPadModeB('SAMPLER')}
              >
                SAMPLER
              </button>
              <button
                type="button"
                className={`${styles.modeBtn} ${padModeB === 'BEAT_JUMP' ? styles.modeBtnActive : ''}`}
                onClick={() => setPadModeB('BEAT_JUMP')}
              >
                BEAT JUMP
              </button>
            </div>

            {/* Top Utility Strip above Jog Wheel (IN/OUT, 4 BEAT, LOOP CALL, MASTER/SYNC) */}
            <div className={styles.topUtilityStrip}>
              <button
                type="button"
                className={`${styles.utilityBtn} ${loopB.active ? styles.activeUtil : ''}`}
                onClick={handleManualInOutB}
                title="Manual Loop In / Out Set & Toggle"
              >
                IN / OUT
              </button>
              <button
                type="button"
                className={`${styles.utilityBtn} ${loopB.active ? styles.activeUtil : ''}`}
                onClick={toggle4BeatLoopB}
                title="Auto 4 Beat Loop"
              >
                4 BEAT
              </button>
              <button
                type="button"
                className={styles.utilityBtn}
                onClick={handleLoopCallHalveB}
                title="Halve active loop length (1/2x)"
              >
                ◄ 1/2
              </button>
              <button
                type="button"
                className={styles.utilityBtn}
                onClick={handleLoopCallDoubleB}
                title="Double active loop length (2x)"
              >
                2x ►
              </button>
              <button
                type="button"
                className={`${styles.utilityBtn} ${quantizeB ? styles.activeMaster : ''}`}
                onClick={() => setQuantizeB(!quantizeB)}
                title="Quantize Toggle (Snaps Cues & Loops to Beat Grid)"
              >
                Q: {quantizeB ? 'ON' : 'OFF'}
              </button>
              <button
                type="button"
                className={`${styles.utilityBtn} ${masterDeck === 'B' ? styles.activeMaster : ''}`}
                onClick={() => setMasterDeck('B')}
                title="Set Deck B as Master BPM reference"
              >
                MASTER
              </button>
              <button
                type="button"
                className={`${styles.utilityBtn} ${masterDeck === 'A' ? styles.activeSync : ''}`}
                onClick={handleSyncB}
                title="Sync Deck B BPM to Master Deck A"
              >
                SYNC
              </button>
            </div>

            {/* Main Jog Wheel & Flanking Performance Controls */}
            <div className={styles.deckBodyRow}>
              {/* Left Flank: 4 Performance Pads + Trim Knob */}
              <div className={styles.flankLeft}>
                <div className={styles.padGridMini}>
                  {leftPads.map((pad, idx) => (
                    <button
                      key={`deckB-${pad.sound}-${idx}`}
                      type="button"
                      className={`${styles.padMini} ${activePad === pad.sound ? styles.hit : ''} ${
                        padModeB === 'HOT_CUE' && hotCuesB[idx] !== null ? styles.cueSet : ''
                      }`}
                      onPointerDown={() => handlePadPress('B', idx, pad.sound)}
                    >
                      <span className={styles.padKey}>{pad.hotkey}</span>
                      <span className={styles.padName}>{getPadLabel(padModeB, idx, pad.keyName)}</span>
                    </button>
                  ))}
                </div>
                <div className={styles.flankKnobBox}>
                  <RotaryKnob
                    label="TRIM"
                    value={trimB}
                    min={-12}
                    max={12}
                    unit="dB"
                    defaultValue={0}
                    onChange={setTrimB}
                    size="sm"
                  />
                </div>
              </div>

              {/* Center Platter: Brushed Metal Jog Wheel */}
              <div className={styles.platterZone}>
                <div ref={platterBRef} className={styles.platter} id="platterB">
                  <div className={styles.platterConcentric} />
                  <div className={styles.labelDisc}>
                    <span>SOUND</span>
                    <span>ABODE</span>
                  </div>
                  <div className={styles.platterMarkerDot} />
                </div>
              </div>

              {/* Right Flank: 4 Mirrored Performance Pads */}
              <div className={styles.flankRight}>
                <div className={styles.padGridMini}>
                  {rightPads.map((pad, idx) => {
                    const padIdx = idx + 4;
                    return (
                      <button
                        key={`deckB-${pad.sound}-${padIdx}`}
                        type="button"
                        className={`${styles.padMini} ${activePad === pad.sound ? styles.hit : ''} ${
                          padModeB === 'HOT_CUE' && hotCuesB[padIdx] !== null ? styles.cueSet : ''
                        }`}
                        onPointerDown={() => handlePadPress('B', padIdx, pad.sound)}
                      >
                        <span className={styles.padKey}>{pad.hotkey}</span>
                        <span className={styles.padName}>{getPadLabel(padModeB, padIdx, pad.keyName)}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Full-Width Horizontal Tempo / Pitch Fader */}
            <div className={styles.fullWidthPitchSection}>
              <div className={styles.pitchMeta}>
                <span className={styles.pitchLabel}>TEMPO / PITCH</span>
                <span className={styles.pitchReadout}>
                  <span className={styles.redValue}>{pitchB > 0 ? `+${pitchB}` : pitchB}%</span>
                  <span className={styles.bpmSeparator}>|</span>
                  <span className={styles.redValue}>{currentBpmB} BPM</span>
                </span>
              </div>
              <div className={styles.faderGrooveTrack}>
                <input
                  id="pitchB"
                  type="range"
                  className={styles.tempoRangeInput}
                  min="-8"
                  max="8"
                  value={pitchB}
                  step="1"
                  onChange={(e) => handlePitchB(parseFloat(e.target.value))}
                />
              </div>
            </div>

            {/* Bottom Transport: Square Side-by-Side PLAY/PAUSE & CUE */}
            <div className={styles.deckBottomRow}>
              <div className={styles.transportButtons}>
                <button
                  type="button"
                  className={`${styles.sqBtn} ${styles.sqPlay} ${isPlayingB ? styles.sqPlayActive : ''}`}
                  onClick={togglePlayB}
                >
                  <span className={styles.playIcon}>{isPlayingB ? '❚❚' : '▶'}</span>
                  <span>PLAY/PAUSE</span>
                </button>
                <button
                  type="button"
                  className={`${styles.sqBtn} ${styles.sqCue} ${isCueingB ? styles.sqCueActive : ''}`}
                  onPointerDown={handleCuePointerDownB}
                  onPointerUp={handleCuePointerUpB}
                  onPointerCancel={handleCuePointerUpB}
                >
                  <span>CUE</span>
                </button>
              </div>
              <div className={styles.deckStatusLed}>
                <span className={`${styles.ledDot} ${isPlayingB ? styles.ledGreen : ''}`} />
                <span>{isPlayingB ? 'PLAYING' : 'STOPPED'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* DRUM PADS HEADER WITH SOUND PACK DROPDOWN */}
        <div className={styles.padsHeader}>
          <div className={styles.padsTitle}>
            <span>PERFORMANCE PADS CONFIGURATION</span>
            <span className={styles.padsSubtitle}>
              Modes: HOT CUE | BEAT LOOP | SAMPLER | BEAT JUMP (Hotkeys Q W E R / A S D F)
            </span>
          </div>
          <div className={styles.padsSelector}>
            <label htmlFor="padPackSelect">SOUND PACK:</label>
            <select
              id="padPackSelect"
              value={selectedPack}
              onChange={(e) => setSelectedPack(e.target.value as 'edm' | 'techno' | 'trap' | 'dj_fx')}
              className={styles.packDropdown}
            >
              <option value="edm">EDM &amp; House Drum Kit</option>
              <option value="techno">Techno &amp; Acid Rave Kit</option>
              <option value="trap">Trap &amp; 808 Hip-Hop Kit</option>
              <option value="dj_fx">DJ Scratch &amp; Vocal FX Kit</option>
            </select>
          </div>
        </div>

        {/* TRACK LIBRARY BELOW PADS (IF SHOWLIBRARY IS TRUE) */}
        {showLibrary ? (
          <div className={styles.librarySection}>
            <div className={styles.libraryHeader}>
              <span>TRACK LIBRARY</span>
              <span className={styles.librarySub}>Click any track row to select, or click Deck buttons to load</span>
            </div>

            <div className={styles.libraryTableContainer}>
              <table className={styles.libraryTable}>
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Track Title &amp; Artist</th>
                    <th>Genre</th>
                    <th>BPM</th>
                    <th>Deck Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {SHARED_TRACKS.map((t, idx) => {
                    const isDeckA = trackA.id === t.id;
                    const isDeckB = trackB.id === t.id;
                    const isSelected = selectedLibraryTrack.id === t.id;

                    return (
                      <tr
                        key={t.id}
                        className={`${styles.libraryRow} ${isSelected ? styles.libraryRowSelected : ''}`}
                        onClick={() => setSelectedLibraryTrack(t)}
                      >
                        <td className={styles.colIndex}>{idx + 1}</td>
                        <td>
                          <div className={styles.trackInfoCell}>
                            <span className={styles.trackName}>{t.name}</span>
                            <span className={styles.trackArtist}>{t.artist}</span>
                          </div>
                        </td>
                        <td className={styles.colBpm}>{t.genre}</td>
                        <td className={styles.colBpm}>{t.bpm} BPM</td>
                        <td className={styles.colActions}>
                          <button
                            type="button"
                            className={`${styles.loadBtn} ${isDeckA ? styles.loadBtnActive : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              loadTrackToDeckA(t);
                            }}
                          >
                            {isDeckA ? '✓ DECK A' : 'LOAD DECK A'}
                          </button>
                          <button
                            type="button"
                            className={`${styles.loadBtn} ${isDeckB ? styles.loadBtnActive : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              loadTrackToDeckB(t);
                            }}
                          >
                            {isDeckB ? '✓ DECK B' : 'LOAD DECK B'}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className={styles.heroTryNowBar}>
            <span>Full track library &amp; deck loader available on Try Now page</span>
            <a
              href="/try-now"
              className={styles.heroTryNowBtn}
              onClick={(e) => {
                e.preventDefault();
                window.history.pushState({}, '', '/try-now');
                window.dispatchEvent(new Event('popstate'));
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              Open Full Studio →
            </a>
          </div>
        )}

        <div className={styles.hint}>
          Interactive Hardware Controls • Pioneer DDJ-FLX4 Digital Audio Console • Soundabode Live Studio Engine
        </div>
      </div>
    </div>
  </div>
);
};

export default SoundabodeLiveConsole;
