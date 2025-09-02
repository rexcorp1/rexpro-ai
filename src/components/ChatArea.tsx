



import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, Role, Attachment, Project } from '../types';
import { ArrowUp, Copy, Check, Paperclip, X, ChevronDown, SquareCode, Settings2, Microscope, Image, Video, Square, AudioLines, Mic, Download, Loader2 } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { coldarkCold, coldarkDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ProjectFileCard from './ProjectFileCard';
import { transcribeAudio } from '../services/geminiService';


interface ChatAreaProps {
  messages: ChatMessage[];
  onSendMessage: (prompt: string, attachments: Attachment[]) => void;
  isLoading: boolean;
  onStopGeneration: () => void;
  isCodeInterpreterActive: boolean;
  onToggleCodeInterpreter: () => void;
  isDeepResearchActive: boolean;
  onToggleDeepResearch: () => void;
  isImageToolActive: boolean;
  onToggleImageTool: () => void;
  isVideoToolActive: boolean;
  onToggleVideoTool: () => void;
  onOpenProjectVersion: (project: Project) => void;
  isTextToImageModel: boolean;
  isImageEditModel: boolean;
  isVideoModel: boolean;
  isMobile: boolean;
  onStartLiveConversation: () => void;
}

const LoadingDots: React.FC = () => (
  <div className="flex items-center space-x-1">
    <span className="w-2 h-2 bg-gray-500 rounded-full dot-1"></span>
    <span className="w-2 h-2 bg-gray-500 rounded-full dot-2"></span>
    <span className="w-2 h-2 bg-gray-500 rounded-full dot-3"></span>
  </div>
);

const WelcomeState: React.FC = () => {
  const title = "How can I help you today?";
  const subtitle = "let's finish it all together.";

  return (
    <div className="h-full flex flex-col justify-center items-center text-center p-6">
      <div className="max-w-md">
        <h1 className="text-3xl font-semibold text-gray-800 dark:text-gray-200 mb-4">{title}</h1>
        {subtitle && <p className="text-gray-500 dark:text-gray-400">{subtitle}</p>}
      </div>
    </div>
  );
};

interface ReasoningCardProps {
  reasoningText: string;
  isExpanded: boolean;
  onToggle: () => void;
  markdownComponents: { [key: string]: React.ElementType };
}

const ReasoningCard: React.FC<ReasoningCardProps> = ({ reasoningText, isExpanded, onToggle, markdownComponents }) => {
    return (
        <div className="mb-4 bg-gray-100 dark:bg-gray-800/60 rounded-lg overflow-hidden">
            <button onClick={onToggle} className="w-full px-4 py-3 text-left flex justify-between items-center">
                <div className="flex flex-col text-left">
                  <span className="text-xs text-gray-500 dark:text-gray-400">Thinking</span>
                  <span className="font-semibold text-gray-800 dark:text-gray-200 mt-1">Conceptualizing the Interface</span>
                </div>
                <ChevronDown className={`h-4 w-4 text-gray-500 dark:text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
            </button>
            {isExpanded && (
                <div className="px-4 pb-3 text-gray-800 dark:text-gray-200 leading-relaxed border-t border-gray-200 dark:border-gray-700/50 pt-3">
                     <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={markdownComponents}>
                        {reasoningText}
                    </ReactMarkdown>
                </div>
            )}
        </div>
    );
};


const CodeBlock: React.FC<any> = ({ inline, className, children }) => {
    const [isDarkMode, setIsDarkMode] = useState(false);
    useEffect(() => {
        const matcher = window.matchMedia('(prefers-color-scheme: dark)');
        setIsDarkMode(matcher.matches);
        const onChange = (e: MediaQueryListEvent) => setIsDarkMode(e.matches);
        matcher.addEventListener('change', onChange);
        return () => matcher.removeEventListener('change', onChange);
    }, []);

    const [copied, setCopied] = useState(false);
    const codeString = String(children).replace(/\n$/, '');
    const isSingleLineBlock = !inline && !codeString.includes('\n');
    
    const match = /language-(\w+)/.exec(className || '');
    const language = match ? match[1] : 'text';
  
    const handleCodeCopy = () => {
      navigator.clipboard.writeText(codeString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    
    if (inline || isSingleLineBlock) {
      return (
        <code className="bg-slate-100 text-slate-800 rounded-md px-1.5 py-0.5 font-mono text-sm dark:bg-slate-700 dark:text-slate-200">
          {children}
        </code>
      );
    }
  
    return (
      <div className="my-4 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden font-sans bg-gray-50 dark:bg-gray-800">
        <div className="flex justify-between items-center bg-gray-100 dark:bg-gray-900/50 px-4 py-1.5 border-b border-gray-200 dark:border-gray-700">
          <span className="text-xs text-gray-500 font-semibold">
            {language.toUpperCase()}
          </span>
          <button
            onClick={handleCodeCopy}
            aria-label="Copy code"
            data-tooltip-text="Copy"
            data-tooltip-position="top"
            className="p-1 text-gray-500 rounded-md hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-800 dark:hover:text-white transition-colors"
          >
            {copied ? <Check className="h-4 w-4 text-green-500" /> : <Copy className="h-4 w-4" />}
          </button>
        </div>
        <SyntaxHighlighter
          style={isDarkMode ? coldarkDark : coldarkCold}
          language={language}
          PreTag="div"
          customStyle={{ padding: '1rem', margin: 0, overflowX: 'auto', backgroundColor: 'transparent', fontSize: '0.875rem' }}
        >
          {codeString}
        </SyntaxHighlighter>
      </div>
    );
  };

interface ChatLogProps {
  messages: ChatMessage[];
  isLoading: boolean;
  onOpenProjectVersion: (project: Project) => void;
}

const ChatLog: React.FC<ChatLogProps> = ({ messages, isLoading, onOpenProjectVersion }) => {
  const endOfMessagesRef = useRef<HTMLDivElement>(null);
  const [copiedMessageIndex, setCopiedMessageIndex] = useState<number | null>(null);
  const [expandedReasoning, setExpandedReasoning] = useState<{ [key: number]: boolean }>({});

  const toggleReasoning = (index: number) => {
    setExpandedReasoning(prev => ({ ...prev, [index]: !prev[index] }));
  };

  useEffect(() => {
    endOfMessagesRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleCopy = (content: string, index: number) => {
    navigator.clipboard.writeText(content);
    setCopiedMessageIndex(index);
    setTimeout(() => {
      setCopiedMessageIndex(null);
    }, 2000);
  };

  const markdownComponents: { [key: string]: React.ElementType } = {
    h1: ({node, level, ...props}) => <h1 className="text-2xl font-bold mb-4 mt-5 border-b dark:border-gray-700 pb-2" {...props} />,
    h2: ({node, level, ...props}) => <h2 className="text-xl font-bold mb-3 mt-4 border-b dark:border-gray-700 pb-1.5" {...props} />,
    h3: ({node, level, ...props}) => <h3 className="text-lg font-bold mb-2 mt-3" {...props} />,
    ul: ({node, ordered, depth, ...props}) => <ul className="list-disc list-outside ml-6 mb-4 space-y-2" {...props} />,
    ol: ({node, ordered, depth, start, ...props}) => <ol className="list-decimal list-outside ml-6 mb-4 space-y-2" {...props} />,
    li: ({node, checked, index, ordered, ...props}) => <li className="mb-1" {...props} />,
    p: ({node, ...props}) => <p className="mb-4" {...props} />,
    code: CodeBlock,
    blockquote: ({node, ...props}) => <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 my-4 italic text-gray-700 dark:text-gray-400" {...props} />,
    table: ({node, ...props}) => <div className="overflow-x-auto my-4 border border-gray-200 dark:border-gray-700 rounded-lg"><table className="w-full text-sm" {...props} /></div>,
    thead: ({node, ...props}) => <thead className="bg-gray-50 dark:bg-gray-800" {...props} />,
    tr: ({node, isHeader, ...props}) => <tr className="border-b border-gray-200 dark:border-gray-700 last:border-b-0" {...props} />,
    th: ({node, isHeader, style, ...props}) => <th className="px-4 py-2 text-left font-semibold text-gray-700 dark:text-gray-300" {...props} />,
    td: ({node, isHeader, style, ...props}) => <td className="px-4 py-2 text-gray-700 dark:text-gray-300" {...props} />,
    img: ({node, ...props}) => <img className="max-w-md rounded-lg my-4" {...props} />,
    math: ({node, value, ...props}) => <div className="overflow-x-auto"><span {...props} /></div>,
    inlineMath: ({node, value, ...props}) => <span {...props} />,
  };

  return (
    <div className="py-6 pl-[22px] pr-3">
      <div className="max-w-4xl mx-auto space-y-8">
        {messages.map((msg, index) => {
          const isLastMessage = index === messages.length - 1;
          
          if (msg.role === Role.MODEL) {
            const hasAttachments = msg.attachments && msg.attachments.length > 0;
            const hasImageAttachment = hasAttachments && msg.attachments!.some(att => att.mimeType.startsWith('image/'));
            
            return (
                <div key={index}>
                    {msg.reasoning && msg.reasoning.trim() && (
                      <ReasoningCard
                        reasoningText={msg.reasoning}
                        isExpanded={!!expandedReasoning[index]}
                        onToggle={() => toggleReasoning(index)}
                        markdownComponents={markdownComponents}
                      />
                    )}

                    {isLastMessage && isLoading && msg.isThinking ? (
                        <div className="flex items-center space-x-2 p-3 text-gray-600 dark:text-gray-400">
                           <LoadingDots />
                           {msg.content && <div className="leading-relaxed"><ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: 'span' }}>{msg.content}</ReactMarkdown></div>}
                        </div>
                    ) : msg.content.trim() !== '' ? (
                        <div className="w-full text-gray-800 dark:text-gray-200 leading-relaxed">
                            <ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeKatex]} components={markdownComponents}>
                                {msg.content}
                            </ReactMarkdown>
                        </div>
                    ) : null}


                    {hasAttachments && (
                        <div className="mt-4 flex flex-wrap gap-4">
                            {msg.attachments!.map((att, attIndex) => (
                                <div key={attIndex} className="relative group max-w-sm">
                                  {att.mimeType.startsWith('image/') && (
                                    <img src={att.dataUrl} alt={att.name} className="max-h-96 rounded-lg object-contain border border-gray-200 dark:border-gray-700" />
                                  )}
                                  {att.mimeType.startsWith('video/') && (
                                    <video src={att.dataUrl} controls autoPlay muted loop className="max-h-96 rounded-lg object-contain border border-gray-200 dark:border-gray-700" />
                                  )}
                                  <a 
                                      href={att.dataUrl} 
                                      download={att.name}
                                      className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center gap-2 px-3 py-1.5 bg-gray-900/60 text-white rounded-md text-sm hover:bg-gray-900/80 backdrop-blur-sm"
                                      aria-label={`Download ${att.name}`}
                                      data-tooltip-text="Download"
                                      data-tooltip-position="top"
                                  >
                                     <Download className="h-4 w-4" />
                                  </a>
                                </div>
                            ))}
                        </div>
                    )}

                    {msg.groundingChunks && msg.groundingChunks.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                            <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-400 mb-2 flex items-center gap-2">
                                <img src="https://www.google.com/favicon.ico" alt="Google icon" className="w-4 h-4"/>
                                Sources
                            </h4>
                            <div className="flex flex-wrap gap-2">
                                {msg.groundingChunks.map((chunk: any, i: number) => (
                                    <a
                                        key={i}
                                        href={chunk.web.uri}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs bg-gray-100 dark:bg-gray-800 text-blue-600 dark:text-blue-400 px-2.5 py-1.5 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors block max-w-xs truncate"
                                        title={chunk.web.title || chunk.web.uri}
                                    >
                                       {chunk.web.title || new URL(chunk.web.uri).hostname}
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}

                    {msg.projectFilesUpdate && msg.project && (
                      <ProjectFileCard project={msg.project} onOpen={() => onOpenProjectVersion(msg.project!)} />
                    )}

                    {!(isLoading && isLastMessage) && msg.content && !msg.projectFilesUpdate && !hasImageAttachment && (
                        <div className="mt-2 flex items-center gap-2">
                            <button
                                onClick={() => handleCopy(msg.content, index)}
                                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                                aria-label="Copy response"
                                data-tooltip-text="Copy"
                                data-tooltip-position="top"
                            >
                                {copiedMessageIndex === index ? <Check className="h-5 w-5 text-green-500" /> : <Copy className="h-5 w-5" />}
                            </button>
                        </div>
                    )}
                </div>
            );
          }
          
          return (
            <div key={index} className="flex justify-end">
              <div className="rounded-xl rounded-tr-[0.15rem] px-4 py-3 max-w-[80%] bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200">
                {msg.attachments && msg.attachments.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {msg.attachments.map((file, fileIndex) => (
                      <div key={fileIndex} className="relative">
                        {file.mimeType.startsWith('image/') ? (
                          <img src={file.dataUrl} alt={file.name} className="max-w-xs max-h-48 rounded-lg object-contain" />
                        ) : (
                          <div className="p-2 bg-gray-200 dark:bg-gray-700 rounded-lg text-xs">
                            {file.name}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {msg.content && <div className="whitespace-pre-wrap">{msg.content}</div>}
              </div>
            </div>
          );
        })}
        <div ref={endOfMessagesRef} />
      </div>
    </div>
  );
};

export const ChatArea: React.FC<ChatAreaProps> = ({
  messages,
  onSendMessage,
  isLoading,
  onStopGeneration,
  isCodeInterpreterActive,
  onToggleCodeInterpreter,
  isDeepResearchActive,
  onToggleDeepResearch,
  isImageToolActive,
  onToggleImageTool,
  isVideoToolActive,
  onToggleVideoTool,
  onOpenProjectVersion,
  isTextToImageModel,
  isImageEditModel,
  isVideoModel,
  isMobile,
  onStartLiveConversation,
}) => {
  const [input, setInput] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<Attachment[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);
  const [isToolsMenuOpen, setIsToolsMenuOpen] = useState(false);
  const [isToolsBottomSheetOpen, setIsToolsBottomSheetOpen] = useState(false);
  const toolsMenuRef = useRef<HTMLDivElement>(null);
  const [isVoiceRecording, setIsVoiceRecording] = useState(false);
  const [isStreamingText, setIsStreamingText] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);


  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
        if (toolsMenuRef.current && !toolsMenuRef.current.contains(event.target as Node)) {
            setIsToolsMenuOpen(false);
        }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
        document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);
  
  const handleToolsButtonClick = () => {
    if (isMobile) {
      setIsToolsBottomSheetOpen(true);
    } else {
      setIsToolsMenuOpen(p => !p);
    }
  };

  const handleTextareaInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const textarea = textareaRef.current;
    if (textarea) {
        textarea.style.height = 'auto';
        requestAnimationFrame(() => {
            if (textarea) {
                textarea.style.height = `${textarea.scrollHeight}px`;
            }
        });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() || attachedFiles.length > 0) {
      onSendMessage(input.trim(), attachedFiles);
      setInput('');
      setAttachedFiles([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };
  
  const handleAttachClick = () => {
    fileInputRef.current?.click();
  };

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    const filesArray = Array.from(files);
    filesArray.forEach(file => {
      const reader = new FileReader();
      reader.onload = (loadEvent) => {
        const dataUrl = loadEvent.target?.result as string;
        if (dataUrl) {
          setAttachedFiles(prev => [...prev, {
            name: file.name,
            mimeType: file.type,
            dataUrl: dataUrl
          }]);
        }
      };
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
    e.target.value = '';
  };

  const handleRemoveFile = (indexToRemove: number) => {
    setAttachedFiles(prev => prev.filter((_, index) => index !== indexToRemove));
  };

  const handleDragEnter = (e: React.DragEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (isTextToImageModel) return;
    dragCounter.current++;
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
        setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
        setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent<HTMLFormElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (isTextToImageModel) return;
    setIsDragging(false);
    dragCounter.current = 0;
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
        e.dataTransfer.clearData();
    }
  };
  
  const streamTextToInput = (text: string) => {
    if (!text.trim()) return;
    setIsStreamingText(true);

    const words = text.split(/\s+/).filter(Boolean);
    
    let currentText = textareaRef.current?.value || '';
    currentText = currentText.trim() ? currentText.trim() + ' ' : '';

    let i = 0;
    const intervalId = setInterval(() => {
        if (i < words.length) {
            currentText += words[i] + ' ';
            setInput(currentText);
            
            const textarea = textareaRef.current;
            if (textarea) {
                textarea.style.height = 'auto';
                textarea.style.height = `${textarea.scrollHeight}px`;
                textarea.scrollTop = textarea.scrollHeight;
            }
            i++;
        } else {
            clearInterval(intervalId);
            setInput(val => val.trim());
            setIsStreamingText(false);
            const textarea = textareaRef.current;
            if(textarea) {
              textarea.focus();
              setTimeout(() => {
                if (textarea) {
                    textarea.style.height = 'auto';
                    textarea.style.height = `${textarea.scrollHeight}px`;
                }
              }, 0);
            }
        }
    }, 75);
  };
  
  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop();
    }
    setIsVoiceRecording(false);
  };

  const handleStartRecording = async () => {
    if (isVoiceRecording) return;
    try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorderRef.current = new MediaRecorder(stream, { mimeType: 'audio/webm' });
        audioChunksRef.current = [];

        mediaRecorderRef.current.ondataavailable = (event) => {
            audioChunksRef.current.push(event.data);
        };

        mediaRecorderRef.current.onstop = async () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            const reader = new FileReader();
            reader.readAsDataURL(audioBlob);
            reader.onloadend = async () => {
                const base64Audio = (reader.result as string).split(',')[1];
                if (base64Audio) {
                    try {
                        const transcribedText = await transcribeAudio(base64Audio, 'audio/webm');
                        streamTextToInput(transcribedText);
                    } catch (error) {
                        console.error("Transcription failed:", error);
                        alert("Sorry, I couldn't understand that. Please try again.");
                    }
                }
            };
            stream.getTracks().forEach(track => track.stop());
        };

        mediaRecorderRef.current.start();
        setIsVoiceRecording(true);
    } catch (err) {
        console.error("Microphone access denied or error:", err);
        alert("Microphone access is required for voice input. Please enable it in your browser settings.");
    }
  };

  const handleMicClick = () => {
      if (isVoiceRecording) {
          handleStopRecording();
      } else {
          handleStartRecording();
      }
  };
  
  const isSendDisabled = isLoading || isStreamingText ||
    (!input.trim() && attachedFiles.length === 0) ||
    (isImageEditModel && attachedFiles.length === 0);

  const placeholder = isVoiceRecording
    ? "Recording... click mic to stop."
    : isTextToImageModel 
    ? "Describe the image you want to generate..." 
    : isImageEditModel 
      ? (attachedFiles.length > 0 ? "Describe the edits you want to make..." : "Attach an image to edit...")
      : isVideoModel 
        ? "Describe the video you want to create..."
        : "Type your message here, or attach files...";


  const renderMicOrSendButton = () => {
      if (isStreamingText) {
          return (
              <button
                  type="button"
                  className="w-10 h-10 text-gray-500 rounded-lg flex items-center justify-center"
                  disabled
              >
                  <Loader2 className="h-5 w-5 animate-spin" />
              </button>
          );
      }

      if (isVoiceRecording) {
          return (
              <button
                  type="button"
                  onClick={handleMicClick}
                  className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center transition-colors dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
                  aria-label="Stop recording"
                  data-tooltip-text="Stop recording"
                  data-tooltip-position="top"
              >
                  <Mic className="h-5 w-5 text-red-600 animate-pulse" />
              </button>
          );
      }
      
      if (isSendDisabled) {
          return (
              <button 
                  type="button"
                  onClick={handleMicClick}
                  className="w-10 h-10 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-100 dark:hover:bg-gray-800"
                  aria-label="Start Voice Input"
                  data-tooltip-text="Voice Input"
                  data-tooltip-position="top"
              >
                  <Mic className="h-5 w-5" />
              </button>
          );
      }

      return (
          <button
              type="submit"
              className="w-10 h-10 bg-blue-600 text-white rounded-lg flex items-center justify-center hover:bg-blue-700 transition-colors disabled:bg-blue-300 disabled:cursor-not-allowed dark:disabled:bg-blue-800"
              aria-label="Send message"
              data-tooltip-text="Send message"
              data-tooltip-position="top"
              disabled={isSendDisabled}
          >
              <ArrowUp className="h-6 w-6" />
          </button>
      );
  };


  return (
    <div className="flex-1 flex flex-col bg-white dark:bg-gray-950 h-full overflow-hidden">
      <div className="relative flex-1">
        <div className="absolute inset-0 overflow-y-auto [scrollbar-gutter:stable] hover-scrollbar">
            {messages.length === 0 && !isLoading ? (
            <WelcomeState />
            ) : (
            <ChatLog
                messages={messages}
                isLoading={isLoading}
                onOpenProjectVersion={onOpenProjectVersion}
            />
            )}
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-white to-transparent dark:from-gray-950 pointer-events-none"></div>
      </div>

      {isMobile && isToolsBottomSheetOpen && (
        <>
          <div 
              className="fixed inset-0 bg-black/50 z-40 animate-fade-in" 
              onClick={() => setIsToolsBottomSheetOpen(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 bg-white dark:bg-gray-900 rounded-t-2xl z-50 p-4 pb-6 shadow-lg animate-slide-up">
              <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-4"></div>
              <div className="mb-4 px-2">
                  <p className="font-semibold text-lg text-gray-800 dark:text-gray-200">Tools</p>
              </div>
              <div className="space-y-2">
                  <button
                      onClick={() => { onToggleCodeInterpreter(); setIsToolsBottomSheetOpen(false); }}
                      className={`w-full text-left flex items-center gap-3 px-4 py-3 text-base rounded-lg transition-colors ${isCodeInterpreterActive ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                  >
                      <SquareCode className="h-5 w-5" /> Code Interpreter
                  </button>
                  <button
                      onClick={() => { onToggleDeepResearch(); setIsToolsBottomSheetOpen(false); }}
                      className={`w-full text-left flex items-center gap-3 px-4 py-3 text-base rounded-lg transition-colors ${isDeepResearchActive ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                  >
                      <Microscope className="h-5 w-5" /> Deep Research
                  </button>
                  <button
                      onClick={() => { onToggleImageTool(); setIsToolsBottomSheetOpen(false); }}
                      className={`w-full text-left flex items-center gap-3 px-4 py-3 text-base rounded-lg transition-colors ${isImageToolActive ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                  >
                      <Image className="h-5 w-5" /> Images
                  </button>
                  <button
                      onClick={() => { onToggleVideoTool(); setIsToolsBottomSheetOpen(false); }}
                      className={`w-full text-left flex items-center gap-3 px-4 py-3 text-base rounded-lg transition-colors ${isVideoToolActive ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800'}`}
                  >
                      <Video className="h-5 w-5" /> Videos
                  </button>
              </div>
          </div>
        </>
      )}


      <div className="px-6 pt-2 pb-4 flex-shrink-0">
        <div className="max-w-4xl mx-auto">
          <form
            onSubmit={handleSubmit}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            className="relative"
          >
            {isDragging && (
              <div className="absolute inset-0 z-10 bg-blue-100/75 dark:bg-blue-900/75 border-2 border-dashed border-blue-500 rounded-lg flex items-center justify-center pointer-events-none">
                <span className="text-blue-600 dark:text-blue-300 font-semibold text-lg">Drop files to attach</span>
              </div>
            )}
            <div className="w-full border border-gray-200 dark:border-gray-700 rounded-lg flex flex-col focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all duration-200">
                {attachedFiles.length > 0 && (
                  <div className="px-4 pt-3 flex flex-wrap gap-2">
                    {attachedFiles.map((file, index) => (
                      <div key={index} className="relative group">
                        {file.mimeType.startsWith('image/') ? (
                          <img src={file.dataUrl} alt={file.name} className="h-16 w-16 rounded-md object-cover" />
                        ) : (
                          <div className="h-16 w-16 bg-gray-200 dark:bg-gray-700 rounded-md flex items-center justify-center p-1" title={file.name}>
                            <span className="text-xs text-gray-600 dark:text-gray-300 text-center break-all line-clamp-3">{file.name}</span>
                          </div>
                        )}
                        <button 
                          type="button"
                          onClick={() => handleRemoveFile(index)} 
                          className="absolute -top-1 -right-1 bg-gray-700 dark:bg-gray-300 text-white dark:text-black rounded-full h-4 w-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                          aria-label={`Remove ${file.name}`}
                          data-tooltip-text="Remove"
                          data-tooltip-position="top"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <textarea
                    ref={textareaRef}
                    rows={1}
                    value={input}
                    onChange={handleTextareaInput}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSubmit(e);
                        }
                    }}
                    placeholder={placeholder}
                    className={`w-full resize-none focus:outline-none bg-transparent text-sm hover-scrollbar [scrollbar-gutter:stable] text-gray-800 dark:text-gray-200 placeholder:text-gray-400 dark:placeholder:text-gray-500 ${attachedFiles.length > 0 ? 'px-4 pt-2 pb-4' : 'p-4'}`}
                    disabled={isLoading || isVoiceRecording || isStreamingText}
                    style={{maxHeight: '200px'}}
                />
                <div className="flex justify-between items-center px-4 pb-3">
                    <div className="flex items-center gap-1">
                      <input
                        type="file"
                        multiple
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                        accept="image/*,text/*,application/pdf,application/json,application/javascript,text/html,text/css,text/markdown"
                      />
                      <button 
                        type="button" 
                        onClick={handleAttachClick} 
                        data-tooltip-text="Attach files" 
                        data-tooltip-position="top" 
                        className="text-gray-400 hover:text-gray-600 p-2 rounded-lg hover:bg-gray-100 transition-colors dark:text-gray-500 dark:hover:text-gray-400 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed" 
                        aria-label="Attach files"
                        disabled={isTextToImageModel}
                      >
                          <Paperclip className="h-5 w-5" />
                      </button>
                      <div ref={toolsMenuRef} className="relative flex items-center">
                        <button
                          type="button"
                          onClick={handleToolsButtonClick}
                          className={`p-2 rounded-lg transition-colors ${isToolsMenuOpen || isToolsBottomSheetOpen ? 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-gray-400 dark:hover:bg-gray-800'}`}
                          aria-label="Tools"
                          aria-haspopup="true"
                          aria-expanded={isToolsMenuOpen}
                          data-tooltip-text="Tools"
                          data-tooltip-position="top"
                        >
                          <Settings2 className="h-5 w-5" />
                        </button>
                        
                        {!isMobile && (
                            <div
                              className={`absolute bottom-1/2 translate-y-1/2 left-full ml-2 flex items-center gap-2 transition-all duration-200 ease-out origin-left ${isToolsMenuOpen ? 'opacity-100 scale-100' : 'opacity-0 scale-95 pointer-events-none'}`}
                              aria-hidden={!isToolsMenuOpen}
                              role="menu"
                            >
                                <button
                                  type="button"
                                  onClick={onToggleCodeInterpreter}
                                  className={`flex items-center gap-2 whitespace-nowrap px-3 py-2 rounded-lg border shadow-sm transition-colors text-sm font-medium ${isCodeInterpreterActive ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 dark:bg-gray-950 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-800'}`}
                                  role="menuitem"
                                >
                                    <SquareCode className="h-5 w-5 flex-shrink-0" />
                                    <span>Code Interpreter</span>
                                </button>
                                 <button
                                  type="button"
                                  onClick={onToggleDeepResearch}
                                  className={`flex items-center gap-2 whitespace-nowrap px-3 py-2 rounded-lg border shadow-sm transition-colors text-sm font-medium ${isDeepResearchActive ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 dark:bg-gray-950 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-800'}`}
                                  role="menuitem"
                                >
                                    <Microscope className="h-5 w-5 flex-shrink-0" />
                                    <span>Deep Research</span>
                                </button>
                                 <button
                                  type="button"
                                  onClick={onToggleImageTool}
                                  className={`flex items-center gap-2 whitespace-nowrap px-3 py-2 rounded-lg border shadow-sm transition-colors text-sm font-medium ${isImageToolActive ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 dark:bg-gray-950 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-800'}`}
                                  role="menuitem"
                                >
                                    <Image className="h-5 w-5 flex-shrink-0" />
                                    <span>Images</span>
                                </button>
                                 <button
                                  type="button"
                                  onClick={onToggleVideoTool}
                                  className={`flex items-center gap-2 whitespace-nowrap px-3 py-2 rounded-lg border shadow-sm transition-colors text-sm font-medium ${isVideoToolActive ? 'bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-700' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50 dark:bg-gray-950 dark:text-gray-300 dark:border-gray-700 dark:hover:bg-gray-800'}`}
                                  role="menuitem"
                                >
                                    <Video className="h-5 w-5 flex-shrink-0" />
                                    <span>Videos</span>
                                </button>
                            </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {isLoading ? (
                            <button
                                type="button"
                                onClick={onStopGeneration}
                                className="w-10 h-10 bg-red-600 text-white rounded-lg flex items-center justify-center hover:bg-red-700 transition-colors"
                                aria-label="Stop generation"
                                data-tooltip-text="Stop generation"
                                data-tooltip-position="top"
                            >
                                <Square className="h-5 w-5" />
                            </button>
                        ) : (
                            <>
                                {renderMicOrSendButton()}
                                <button 
                                    type="button"
                                    onClick={onStartLiveConversation}
                                    className="w-10 h-10 text-gray-600 bg-gray-100 rounded-lg flex items-center justify-center transition-colors dark:text-gray-300 dark:bg-gray-800"
                                    aria-label="Voice Mode"
                                    data-tooltip-text="Voice Mode"
                                    data-tooltip-position="top"
                                >
                                    <AudioLines className="h-5 w-5" />
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
          </form>
          <div className="mt-2 h-4">
            <p className={`text-xs text-center text-gray-500 transition-opacity duration-300 ${messages.length > 0 ? 'opacity-100' : 'opacity-0'}`}>
              AI can make mistakes. Consider checking important information.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};