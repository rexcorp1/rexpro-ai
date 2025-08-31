import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Session, LiveServerMessage, Modality } from '@google/genai';
import { Mic, Pause, Play, X, Video, VideoOff, ScreenShare, ScreenShareOff } from 'lucide-react';
import { createBlob, decode, decodeAudioData } from '../lib/audioUtils';
import { AudioVisualizer } from './AudioVisualizer';
import { LiveConversationModel } from '../types';

const API_KEY = import.meta.env.VITE_API_KEY;

interface LiveConversationProps {
  isOpen: boolean;
  onClose: () => void;
  appTheme: 'light' | 'dark';
  model: LiveConversationModel;
}

export const LiveConversation: React.FC<LiveConversationProps> = ({ isOpen, onClose, appTheme, model }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [status, setStatus] = useState('Initializing...');
  const [error, setError] = useState('');
  const [outputNodeForVisualizer, setOutputNodeForVisualizer] = useState<GainNode | null>(null);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isScreenSharingOn, setIsScreenSharingOn] = useState(false);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);

  const clientRef = useRef<GoogleGenAI | null>(null);
  const sessionRef = useRef<Session | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const outputNodeRef = useRef<GainNode | null>(null);
  const nextStartTimeRef = useRef(0);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const sourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const scriptProcessorNodeRef = useRef<ScriptProcessorNode | null>(null);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  const videoElementRef = useRef<HTMLVideoElement | null>(null);
  const frameCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameSenderIntervalRef = useRef<number | null>(null);

  const processingStateRef = useRef({ isRecording: false, isPaused: false });

  const isLightTheme = appTheme === 'light';

  useEffect(() => {
    processingStateRef.current = { isRecording, isPaused };
  }, [isRecording, isPaused]);

  useEffect(() => {
    const videoElement = videoElementRef.current;
    if (videoElement) {
        if (videoElement.srcObject !== videoStream) {
            videoElement.srcObject = videoStream;
        }
    }
  }, [videoStream]);


  const stopSendingFrames = useCallback(() => {
    if (frameSenderIntervalRef.current) {
      clearInterval(frameSenderIntervalRef.current);
    }
    frameSenderIntervalRef.current = null;
  }, []);

  const startSendingFrames = useCallback(() => {
    if (!videoElementRef.current || !sessionRef.current || frameSenderIntervalRef.current) return;

    if (!frameCanvasRef.current) {
      frameCanvasRef.current = document.createElement('canvas');
    }
    const canvas = frameCanvasRef.current;
    const context = canvas.getContext('2d');

    frameSenderIntervalRef.current = window.setInterval(() => {
      if (!processingStateRef.current.isRecording || processingStateRef.current.isPaused || !videoElementRef.current || videoElementRef.current.readyState < 2 || !context) {
        return;
      }

      canvas.width = videoElementRef.current.videoWidth;
      canvas.height = videoElementRef.current.videoHeight;
      context.drawImage(videoElementRef.current, 0, 0, canvas.width, canvas.height);

      canvas.toBlob((blob) => {
        if (blob && sessionRef.current) {
          const reader = new FileReader();
          reader.onloadend = () => {
            const base64data = (reader.result as string).split(',')[1];
            const imageBlobForGenAI = {
              data: base64data,
              mimeType: 'image/jpeg',
            };
            try {
              sessionRef.current?.sendRealtimeInput({ media: imageBlobForGenAI });
            } catch (e) {
              console.error('Error sending video frame:', e);
            }
          };
          reader.readAsDataURL(blob);
        }
      }, 'image/jpeg', 0.8);
    }, 2000);
  }, []);

  useEffect(() => {
      if (isRecording && videoStream) {
          startSendingFrames();
      } else {
          stopSendingFrames();
      }
  }, [isRecording, videoStream, startSendingFrames, stopSendingFrames]);


  const stopVideoStream = useCallback(() => {
    stopSendingFrames();
    setVideoStream(currentStream => {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
        }
        return null;
    });
    setIsCameraOn(false);
    setIsScreenSharingOn(false);
  }, [stopSendingFrames]);

  const stopRecording = useCallback((shouldUpdateStatus = true) => {
    if (!mediaStreamRef.current) return;
    if (shouldUpdateStatus) setStatus('Stopping recording...');
    
    setIsRecording(false);
    setIsPaused(false);

    if (scriptProcessorNodeRef.current) {
        scriptProcessorNodeRef.current.disconnect();
        scriptProcessorNodeRef.current.onaudioprocess = null;
    }
    scriptProcessorNodeRef.current = null;
    
    sourceNodeRef.current?.disconnect();
    sourceNodeRef.current = null;
    
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    
    if (inputAudioContextRef.current?.state === 'running') {
      inputAudioContextRef.current.suspend().catch(console.error);
    }

    if (shouldUpdateStatus) setStatus('Ready');
  }, []);

  const initSession = useCallback(async () => {
    if (!clientRef.current || !outputAudioContextRef.current || !outputNodeRef.current) {
        const message = "Cannot init session, audio context or client not ready.";
        console.error(message);
        setError(message);
        return;
    }
    const outputNode = outputNodeRef.current;
    try {
      const session = await clientRef.current.live.connect({
        model: model,
        callbacks: {
          onopen: () => setStatus('Session Opened'), onmessage: async (message: LiveServerMessage) => {
            const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData;
            const outputCtx = outputAudioContextRef.current;
            if (audio?.data && outputCtx) {
              try {
                nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                const audioBuffer = await decodeAudioData(decode(audio.data), outputCtx, 24000, 1);
                const source = outputCtx.createBufferSource();
                source.buffer = audioBuffer;
                source.connect(outputNode);
                source.addEventListener('ended', () => {
                  sourcesRef.current.delete(source);
                });
                source.start(nextStartTimeRef.current);
                nextStartTimeRef.current += audioBuffer.duration;
                sourcesRef.current.add(source);
              } catch (e) {
                  console.error("Error playing back audio:", e);
                  setError("Failed to process and play back audio response.");
              }
            }
            const interrupted = message.serverContent?.interrupted;
            if (interrupted) {
              for (const source of sourcesRef.current.values()) {
                source.stop();
                sourcesRef.current.delete(source);
              }
              nextStartTimeRef.current = 0;
            }
          },
          onerror: (e: ErrorEvent) => setError(e.message),
          onclose: (e: CloseEvent) => {
            if (e.wasClean) {
              setStatus('Session Closed');
            } else {
              setStatus(`Session Closed Unexpectedly: ${e.reason} (Code: ${e.code})`);
            }
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } },
          },
        },
      });
      sessionRef.current = session;
      setStatus('Session initialized. Ready to record.');
    } catch (e: any) {
      console.error('Error initializing session:', e);
      setError(`Error initializing session: ${e.message || e}`);
    }
  }, [model]);

  useEffect(() => {
    let isMounted = true;

    const cleanup = () => {
        stopRecording(false);
        stopVideoStream();
        if (sessionRef.current) {
            try { sessionRef.current.close(); } catch (e) { console.warn("Error closing session:", e); }
        }
        sessionRef.current = null;
        inputAudioContextRef.current?.close().catch(console.error);
        outputAudioContextRef.current?.close().catch(console.error);
        inputAudioContextRef.current = null;
        outputAudioContextRef.current = null;
        outputNodeRef.current = null;
        setOutputNodeForVisualizer(null);
    };

    if (!isOpen) {
      cleanup();
      return;
    }

    const setup = async () => {
        if (!isMounted) return;
        if (!API_KEY) {
          setError('API_KEY not found. This is a required environment variable.');
          return;
        }

        try {
            clientRef.current = new GoogleGenAI({ apiKey: API_KEY });

            // @ts-ignore
            const inputCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
            inputAudioContextRef.current = inputCtx;
            // @ts-ignore
            const outputCtx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });
            outputAudioContextRef.current = outputCtx;
            
            const outputGainNode = outputCtx.createGain();
            outputGainNode.connect(outputCtx.destination);
            outputNodeRef.current = outputGainNode;
            setOutputNodeForVisualizer(outputGainNode);
            nextStartTimeRef.current = outputCtx.currentTime;

            await initSession();
        } catch (err: any) {
            console.error("Setup failed:", err);
            setError(`Initialization failed: ${err.message}`);
        }
    };

    setup();
    
    return () => {
      isMounted = false;
      cleanup();
    };
  }, [isOpen, stopRecording, initSession, stopVideoStream]);

  const startRecording = async () => {
    if (isRecording) return;
    if (!sessionRef.current) {
      setError('Session not initialized. Please wait or reset.');
      await initSession();
      if (!sessionRef.current) return;
    }
    const inputCtx = inputAudioContextRef.current;
    const outputCtx = outputAudioContextRef.current;
    if (!inputCtx || !outputCtx) {
      setError('Audio contexts not available.');
      return;
    }

    setIsPaused(false);
    
    if (inputCtx.state === 'suspended') await inputCtx.resume();
    if (outputCtx.state === 'suspended') await outputCtx.resume();
    
    setStatus('Requesting microphone access...');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      mediaStreamRef.current = stream;
      setStatus('Microphone access granted. Starting capture...');

      sourceNodeRef.current = inputCtx.createMediaStreamSource(stream);
      
      const bufferSize = 256;
      scriptProcessorNodeRef.current = inputCtx.createScriptProcessor(bufferSize, 1, 1);
      
      scriptProcessorNodeRef.current.onaudioprocess = (e) => {
        if (!processingStateRef.current.isRecording || processingStateRef.current.isPaused || !sessionRef.current) return;
        
        const pcmData = e.inputBuffer.getChannelData(0);
        try {
          sessionRef.current.sendRealtimeInput({ media: createBlob(pcmData) });
        } catch (err: any) {
          console.error('Error sending realtime input:', err);
          setError(`Error sending audio: ${err.message}`);
          stopRecording(false);
        }
      };

      sourceNodeRef.current.connect(scriptProcessorNodeRef.current);
      scriptProcessorNodeRef.current.connect(inputCtx.destination); 
      
      setIsRecording(true);
      setStatus('🔴 Live');
    } catch (err: any) {
      console.error('Error starting recording:', err);
      setError(`Error starting recording: ${err.message}`);
      stopRecording(false);
    }
  };

  const togglePause = () => {
    setIsPaused(p => {
        const newPausedState = !p;
        if (newPausedState) setStatus('Paused');
        else setStatus('🔴 Live');
        return newPausedState;
    });
  };

  const handleEndSession = () => {
    onClose();
  };
  
  const startVideoStream = useCallback(async (getStream: () => Promise<MediaStream>, type: 'camera' | 'screen') => {
    stopVideoStream();
    try {
      const stream = await getStream();
      setVideoStream(stream);
      if (type === 'camera') {
          setIsCameraOn(true);
          setIsScreenSharingOn(false);
      } else {
          setIsScreenSharingOn(true);
          setIsCameraOn(false);
      }
      
      stream.getTracks()[0].onended = () => {
          stopVideoStream();
      };
    } catch (err: any) {
      setError(`Error starting video stream: ${err.message}`);
      // Ensure state is reset if permission is denied
      setIsCameraOn(false);
      setIsScreenSharingOn(false);
    }
  }, [stopVideoStream]);

  const toggleCamera = useCallback(() => {
    if (isCameraOn) {
      stopVideoStream();
    } else {
      startVideoStream(() => navigator.mediaDevices.getUserMedia({ video: true }), 'camera');
    }
  }, [isCameraOn, stopVideoStream, startVideoStream]);

  const toggleScreenShare = useCallback(() => {
    if (isScreenSharingOn) {
      stopVideoStream();
    } else {
      startVideoStream(() => navigator.mediaDevices.getDisplayMedia({ video: { cursor: 'always' } as any }), 'screen');
    }
  }, [isScreenSharingOn, stopVideoStream, startVideoStream]);


  if (!isOpen) return null;

  const themeClasses = isLightTheme ? {
      bg: 'bg-gray-100',
      text: 'text-black',
      liveIndicatorBg: 'bg-black/5',
      controlsBg: 'bg-white/85',
      buttonBg: 'bg-gray-200',
      buttonText: 'text-black',
      buttonActiveBg: 'bg-blue-500',
      buttonActiveText: 'text-white'
  } : {
      bg: 'bg-black',
      text: 'text-white',
      liveIndicatorBg: 'bg-white/15',
      controlsBg: 'bg-gray-800/85',
      buttonBg: 'bg-gray-700',
      buttonText: 'text-white',
      buttonActiveBg: 'bg-gray-200',
      buttonActiveText: 'text-black'
  };


  return (
    <div className={`fixed inset-0 z-50 transition-colors duration-300 ${themeClasses.bg} ${themeClasses.text}`}>
        <div className={`absolute top-0 left-0 w-full h-full z-0 bg-black transition-opacity duration-300 ${videoStream ? 'opacity-100' : 'opacity-0'}`}>
            <video
                ref={videoElementRef}
                autoPlay
                muted
                playsInline
                className={`w-full h-full object-cover ${isScreenSharingOn ? '' : 'transform -scale-x-100'}`}
            />
        </div>
      <div className="relative w-full h-full font-sans">
        <div 
          className="absolute bottom-0 left-0 right-0 z-10 pointer-events-none"
          style={{
              height: '45%',
          }}
        >
          <div className="relative w-full h-full">
            <AudioVisualizer outputNode={outputNodeForVisualizer} lightTheme={isLightTheme} />
          </div>
        </div>

        <div className="absolute top-0 left-0 right-0 z-20 flex justify-between items-center p-5">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${themeClasses.liveIndicatorBg}`}>
                <span className={`w-2.5 h-2.5 rounded-full bg-blue-500 ${isRecording && !isPaused ? 'animate-[pulse_1.5s_infinite]' : ''}`}/>
                <span>{status}</span>
            </div>
        </div>

        <div className={`absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex gap-3 p-2.5 rounded-full ${themeClasses.controlsBg} backdrop-blur-lg`}>
            <button
                onClick={toggleCamera}
                className={`w-14 h-14 flex items-center justify-center rounded-full transition-colors ${isCameraOn ? `${themeClasses.buttonActiveBg} ${themeClasses.buttonActiveText}` : `${themeClasses.buttonBg} ${themeClasses.buttonText}`}`}
                aria-label={isCameraOn ? 'Stop Camera' : 'Start Camera'}
                title="Toggle Camera"
            >
                {isCameraOn ? <VideoOff size={28} /> : <Video size={28} />}
            </button>
            <button
                onClick={toggleScreenShare}
                className={`w-14 h-14 flex items-center justify-center rounded-full transition-colors ${isScreenSharingOn ? `${themeClasses.buttonActiveBg} ${themeClasses.buttonActiveText}` : `${themeClasses.buttonBg} ${themeClasses.buttonText}`}`}
                aria-label={isScreenSharingOn ? 'Stop Screen Share' : 'Start Screen Share'}
                title="Toggle Screen Share"
            >
                {isScreenSharingOn ? <ScreenShareOff size={28} /> : <ScreenShare size={28} />}
            </button>
            {isRecording ? (
                <button
                    onClick={togglePause}
                    className={`w-14 h-14 flex items-center justify-center rounded-full transition-colors ${isPaused ? `${themeClasses.buttonActiveBg} ${themeClasses.buttonActiveText}` : `${themeClasses.buttonBg} ${themeClasses.buttonText}`}`}
                    aria-label={isPaused ? 'Resume' : 'Pause'}
                    title={isPaused ? 'Resume' : 'Pause'}
                >
                    {isPaused ? <Play size={28} className="ml-1" /> : <Pause size={28} />}
                </button>
            ) : (
                <button
                    onClick={startRecording}
                    className="w-14 h-14 flex items-center justify-center rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-colors"
                    aria-label="Start"
                    title="Start"
                >
                    <Mic size={28} />
                </button>
            )}
            <button
                onClick={handleEndSession}
                className="w-14 h-14 flex items-center justify-center rounded-full bg-red-500 text-white hover:bg-red-600 transition-colors"
                aria-label="End Session"
                title="End Session"
            >
                <X size={28} />
            </button>
        </div>
        
        {error &&
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 text-center p-4 bg-black/20 dark:bg-white/10 rounded-lg backdrop-blur-sm max-w-sm">
                <p className="text-red-400 mt-2">{error}</p>
            </div>
        }
      </div>
    </div>
  );
};