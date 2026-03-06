/**
 * focusSoundService.ts
 * ====================
 * Ambient focus sounds for ADHD chunking engine.
 * 
 * Provides binaural beats, nature soundscapes, and white noise
 * to help ADHD students maintain concentration during reading.
 * 
 * Features:
 * - Multiple sound options (nature, binaural, silence)
 * - Volume control [0–100]
 * - Smooth fade in/out
 * - Offline support (local audio assets)
 */

export enum FocusSoundType {
    NATURE_RAIN = "nature_rain",       // Gentle rain ambience
    BINAURAL_ALPHA = "binaural_alpha",  // 10Hz alpha brainwave frequency
    FOREST = "forest",                  // Forest birds/rustling
    OCEAN_WAVES = "ocean_waves",       // Beach waves
    WHITE_NOISE = "white_noise",       // Filter white noise
    SILENCE = "silence",               // No sound
}

export interface FocusSoundConfig {
    type: FocusSoundType;
    volume: number;  // 0–100
    fadeInMs: number;
    fadeOutMs: number;
}

/**
 * Single audio context per document lifetime to avoid conflicts
 */
let audioContext: AudioContext | null = null;
let currentSource: AudioBufferSource Node | GainNode | null = null;
let gainNode: GainNode | null = null;
let isPlaying = false;

/**
 * Initialize audio context (required for Web Audio API)
 */
function initAudioContext(): AudioContext {
    if (!audioContext) {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    return audioContext;
}

/**
 * Load audio from URL and decode to AudioBuffer
 */
async function loadAudio(url: string): Promise<AudioBuffer> {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    const audioCtx = initAudioContext();
    return await audioCtx.decodeAudioData(arrayBuffer);
}

/**
 * Generate binaural beats in real-time
 * @param frequency Frequency of binaural beat (Hz), e.g., 10 for alpha waves
 * @param durationSeconds How long to generate
 */
function generateBinauralBeats(frequency: number, durationSeconds: number): AudioBuffer {
    const audioCtx = initAudioContext();
    const sampleRate = audioCtx.sampleRate;
    const buffer = audioCtx.createBuffer(
        2,  // stereo
        sampleRate * durationSeconds,
        sampleRate
    );
    
    const leftChannel = buffer.getChannelData(0);
    const rightChannel = buffer.getChannelData(1);
    
    // Left ear: 40Hz sine wave
    // Right ear: 50Hz sine wave  -> 10Hz difference = alpha wave
    const leftFreq = 40;
    const rightFreq = 50;
    const phaseLeft = (2 * Math.PI * leftFreq) / sampleRate;
    const phaseRight = (2 * Math.PI * rightFreq) / sampleRate;
    
    for (let i = 0; i < buffer.length; i++) {
        leftChannel[i] = 0.3 * Math.sin(phaseLeft * i);
        rightChannel[i] = 0.3 * Math.sin(phaseRight * i);
    }
    
    return buffer;
}

/**
 * Generate white noise
 */
function generateWhiteNoise(durationSeconds: number): AudioBuffer {
    const audioCtx = initAudioContext();
    const sampleRate = audioCtx.sampleRate;
    const buffer = audioCtx.createBuffer(
        1,  // mono
        sampleRate * durationSeconds,
        sampleRate
    );
    
    const channel = buffer.getChannelData(0);
    for (let i = 0; i < buffer.length; i++) {
        channel[i] = Math.random() * 2 - 1;  // -1 to 1
    }
    
    return buffer;
}

/**
 * Play focus sound
 */
export async function playFocusSound(config: FocusSoundConfig): Promise<void> {
    if (config.type === FocusSoundType.SILENCE) {
        stopFocusSound();
        return;
    }
    
    try {
        const audioCtx = initAudioContext();
        
        // Stop existing playback
        if (isPlaying) {
            stopFocusSound();
        }
        
        // Create gain node for volume control
        gainNode = audioCtx.createGain();
        gainNode.connect(audioCtx.destination);
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);  // Start silent
        
        let buffer: AudioBuffer;
        
        // Generate or load appropriate sound
        switch (config.type) {
            case FocusSoundType.BINAURAL_ALPHA:
                // Generate 10Hz binaural beats (alpha waves) for 10 minutes
                buffer = generateBinauralBeats(10, 600);
                break;
                
            case FocusSoundType.WHITE_NOISE:
                buffer = generateWhiteNoise(600);  // 10 minutes
                break;
                
            case FocusSoundType.NATURE_RAIN:
            case FocusSoundType.FOREST:
            case FocusSoundType.OCEAN_WAVES:
                // Load prerecorded audio from assets
                const assetPath = `/focus-sounds/${config.type}.webm`;
                buffer = await loadAudio(assetPath);
                break;
                
            default:
                return;
        }
        
        // Create buffer source
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.loop = true;  // Loop for continuous playback
        source.connect(gainNode);
        source.start(0);
        
        currentSource = source;
        isPlaying = true;
        
        // Fade in to target volume
        const targetVolume = config.volume / 100; // 0–1
        gainNode.gain.linearRampToValueAtTime(
            targetVolume,
            audioCtx.currentTime + (config.fadeInMs / 1000)
        );
    } catch (error) {
        console.error("Failed to play focus sound:", error);
    }
}

/**
 * Stop focus sound with fade-out
 */
export async function stopFocusSound(fadeOutMs: number = 1000): Promise<void> {
    if (!isPlaying || !audioContext || !gainNode) return;
    
    // Fade out
    gainNode.gain.linearRampToValueAtTime(
        0,
        audioContext.currentTime + (fadeOutMs / 1000)
    );
    
    // Stop after fade
    setTimeout(() => {
        if (currentSource && currentSource instanceof AudioBufferSourceNode) {
            currentSource.stop();
        }
        isPlaying = false;
    }, fadeOutMs);
}

/**
 * Set volume while playing
 */
export function setFocusSoundVolume(volume: number): void {
    if (gainNode) {
        gainNode.gain.setTargetAtTime(
            Math.max(0, Math.min(1, volume / 100)),
            (audioContext?.currentTime ?? 0),
            0.1  // time constant
        );
    }
}

/**
 * Check if sound is currently playing
 */
export function isFocusSoundPlaying(): boolean {
    return isPlaying;
}

/**
 * Cleanup audio resources
 */
export function disposeFocusSoundService(): void {
    if (isPlaying) {
        stopFocusSound(200);  // Quick fade
    }
}
