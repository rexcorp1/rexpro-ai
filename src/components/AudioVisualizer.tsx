import React, { useRef, useEffect } from 'react';
import { Analyser } from '../lib/analyser';

interface AudioVisualizerProps {
  outputNode: AudioNode | null;
  lightTheme: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ outputNode, lightTheme }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const analyserRef = useRef<Analyser | null>(null);
  const animationFrameId = useRef<number | null>(null);

  const darkWaves = [
    { color: 'rgba(0, 122, 255, 0.6)', amplitude: 30, frequency: 0.02, phase: 0 },
    { color: 'rgba(255, 204, 0, 0.5)', amplitude: 40, frequency: 0.015, phase: 2 },
    { color: 'rgba(52, 199, 89, 0.5)', amplitude: 25, frequency: 0.025, phase: 1 },
    { color: 'rgba(255, 59, 48, 0.4)', amplitude: 20, frequency: 0.01, phase: 3 },
  ];

  const lightWaves = [
    { color: 'rgba(0, 122, 255, 0.45)', amplitude: 30, frequency: 0.02, phase: 0 },
    { color: 'rgba(255, 149, 0, 0.4)', amplitude: 40, frequency: 0.015, phase: 2 },
    { color: 'rgba(48, 209, 88, 0.4)', amplitude: 25, frequency: 0.025, phase: 1 },
    { color: 'rgba(255, 45, 85, 0.35)', amplitude: 20, frequency: 0.01, phase: 3 },
  ];

  useEffect(() => {
    if (outputNode) {
      analyserRef.current = new Analyser(outputNode, 256);
    }
  }, [outputNode]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const handleResize = () => {
      const scale = 0.5;
      canvas.width = canvas.clientWidth * scale;
      canvas.height = canvas.clientHeight * scale;
    };
    handleResize();
    window.addEventListener('resize', handleResize);

    const draw = () => {
      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      let audioSum = 0;
      if (analyserRef.current) {
        analyserRef.current.update();
        const dataArray = analyserRef.current.data;
        if (dataArray) {
          // FIX: The original file was incomplete. The component implementation is completed below to add the animation logic and return a JSX element, fixing the error.
          for (let i = 0; i < analyserRef.current.bufferLength; i++) {
            audioSum += dataArray[i];
          }
        }
      }
      const avgAudio = (audioSum / (analyserRef.current?.bufferLength || 1)) / 255;
      const audioAmp = Math.pow(avgAudio, 2) * (height / 3);

      const waves = lightTheme ? lightWaves : darkWaves;

      waves.forEach(wave => {
        ctx.fillStyle = wave.color;
        ctx.beginPath();
        ctx.moveTo(0, height);

        for (let x = 0; x <= width; x += 5) {
          const time = Date.now() * 0.0005;
          const sine = Math.sin(x * wave.frequency + time + wave.phase);
          const y = height - (height / 2.5) - (sine * wave.amplitude) - audioAmp;
          ctx.lineTo(x, y);
        }

        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fill();
      });

      animationFrameId.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      window.removeEventListener('resize', handleResize);
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [lightTheme, darkWaves, lightWaves]);

  return (
    <div className={`absolute top-0 left-0 z-0 w-full h-full transition-all duration-300 pointer-events-none ${lightTheme ? 'blur-[20px] saturate-[1.3] opacity-90' : 'blur-[30px] saturate-150 opacity-80'}`}>
      <canvas ref={canvasRef} className="w-full h-full block" />
    </div>
  );
};