import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { X, Code, Eye, RefreshCw, RotateCcw, RotateCw, SquareTerminal, Smartphone, Expand, Shrink, Play, Loader2 } from 'lucide-react';
import Editor, { OnMount } from '@monaco-editor/react';
import { Project, FileSystemNode } from '../types';

declare global {
    interface Window {
        loadPyodide: (config: { indexURL: string }) => Promise<any>;
    }
}

export interface StreamingTarget {
    filePath: string;
    code: string;
}

const flattenFiles = (nodes: { [key: string]: FileSystemNode }, path = ''): { [key: string]: string } => {
    let flat: {[key: string]: string} = {};
    for (const key in nodes) {
        const newPath = path ? `${path}/${key}` : key;
        const node = nodes[key];
        if (typeof node.content === 'string') {
            flat[newPath] = node.content;
        }
        if (node.children) {
            Object.assign(flat, flattenFiles(node.children, newPath));
        }
    }
    return flat;
};

const findNode = (files: { [key: string]: FileSystemNode }, path: string): { parent: { [key: string]: FileSystemNode } | null, key: string, node: FileSystemNode } | null => {
    if (!path) return null;
    const parts = path.split('/');
    let current: any = { children: files };
    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        
        if (!current.children || !current.children[part]) return null;
        if (i === parts.length - 1) {
            return { parent: current.children, key: part, node: current.children[part] };
        }
        current = current.children[part];
    }
    return null;
};


interface CodeInterpreterPanelProps {
  onClose: () => void;
  // FIX: Add isMobile to the props interface to match its usage in App.tsx.
  isMobile: boolean;
  isDarkMode: boolean;
  project: Project | undefined;
  onProjectChange: (project: Project) => void;
  activeFilePath: string;
  streamingTarget: StreamingTarget | null;
  onStreamComplete: () => void;
  isWidePreview: boolean;
  onToggleWidePreview: () => void;
}

const CodeInterpreterPanel: React.FC<CodeInterpreterPanelProps> = ({ 
    onClose, isDarkMode, project, onProjectChange,
    activeFilePath, streamingTarget, onStreamComplete,
    isWidePreview, onToggleWidePreview
}) => {
  const [activeTab, setActiveTab] = useState<'preview' | 'code' | 'output'>('preview');
  const [previewKey, setPreviewKey] = useState(0);
  const debounceTimeout = useRef<number | null>(null);
  const [isConsoleOpen, setIsConsoleOpen] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const editorRef = useRef<any>(null);
  const [consoleError, setConsoleError] = useState<{ message: string; stack?: string } | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [displayedCode, setDisplayedCode] = useState('');
  const [isPreviewMobile, setIsPreviewMobile] = useState(false);
  
  // Python execution state
  const [pyodide, setPyodide] = useState<any>(null);
  const [isPyodideLoading, setIsPyodideLoading] = useState(false);
  const [consoleOutput, setConsoleOutput] = useState<string[]>([]);
  const [isPythonRunning, setIsPythonRunning] = useState(false);


  const fileType = useMemo(() => {
    if (!activeFilePath) return 'unsupported';
    if (activeFilePath.endsWith('.py')) return 'python';
    if (['.html', '.tsx', '.jsx', '.css', '.js', '.ts'].some(ext => activeFilePath.endsWith(ext))) return 'web';
    return 'unsupported';
  }, [activeFilePath]);

  useEffect(() => {
    const loadPyodide = async () => {
        if (window.loadPyodide && !pyodide && !isPyodideLoading) {
            setIsPyodideLoading(true);
            try {
                console.log("Loading Pyodide...");
                const py = await window.loadPyodide({
                    indexURL: "https://cdn.jsdelivr.net/pyodide/v0.25.1/full/"
                });
                console.log("Pyodide loaded successfully.");
                setPyodide(py);
            } catch (e) {
                console.error("Error loading Pyodide", e);
                setConsoleOutput(["Error initializing Python environment."]);
            } finally {
                setIsPyodideLoading(false);
            }
        }
    };
    loadPyodide();
  }, [pyodide, isPyodideLoading]);

  // Automatically switch tabs when the active file changes
  useEffect(() => {
    if (fileType === 'python') {
      setActiveTab('code');
    } else if (fileType === 'web') {
      setActiveTab('preview');
    }
  }, [activeFilePath, fileType]);

  const handleRunPython = async () => {
      if (!pyodide || isPythonRunning) return;
      setIsPythonRunning(true);
      setConsoleOutput([`$ python ${activeFilePath}`]);
      setActiveTab('output');
      try {
          let output = '';
          pyodide.setStdout({
              write: (buffer: Uint8Array) => {
                  const decoder = new TextDecoder();
                  output += decoder.decode(buffer);
                  // Split by newlines to stream output line-by-line
                  const lines = output.split('\n');
                  output = lines.pop() || ''; // Keep the last partial line
                  if(lines.length > 0) {
                    setConsoleOutput(prev => [...prev, ...lines]);
                  }
                  return buffer.length;
              }
          });
           pyodide.setStderr({
              write: (buffer: Uint8Array) => {
                  const decoder = new TextDecoder();
                  const errorMsg = decoder.decode(buffer);
                  setConsoleOutput(prev => [...prev, errorMsg]);
                  return buffer.length;
              }
          });

          const code = displayedCode;
          await pyodide.runPythonAsync(code);

          // Add any remaining buffered output
          if (output) {
            setConsoleOutput(prev => [...prev, output]);
          }

      } catch (e: any) {
          setConsoleOutput(prev => [...prev, e.message]);
      } finally {
          pyodide.setStdout({});
          pyodide.setStderr({});
          setIsPythonRunning(false);
      }
  };

  const updateActiveProject = (updater: (project: Project) => void) => {
    if (!project) return;
    const newProject = JSON.parse(JSON.stringify(project));
    updater(newProject);
    onProjectChange(newProject);
  };
  
  const activeFileContent = useMemo(() => {
      if (!project || !activeFilePath) return '';
      const flat = flattenFiles(project.files);
      return flat[activeFilePath] ?? '';
  }, [project, activeFilePath]);

  useEffect(() => {
    setDisplayedCode(activeFileContent);
  }, [activeFileContent]);

  useEffect(() => {
    if (streamingTarget) {
        setIsStreaming(true);
        setActiveTab('code');

        const targetCode = streamingTarget.code;
        let currentIndex = 0;
        const streamInterval = setInterval(() => {
            if (currentIndex >= targetCode.length) {
                clearInterval(streamInterval);
                setIsStreaming(false);
                onStreamComplete();
                setTimeout(() => {
                    editorRef.current?.getAction('editor.action.formatDocument').run();
                }, 300);
            } else {
                const chunkSize = Math.max(25, Math.floor(targetCode.length / 100));
                currentIndex = Math.min(currentIndex + chunkSize, targetCode.length);
                const nextChunk = targetCode.substring(0, currentIndex);
                setDisplayedCode(nextChunk);
            }
        }, 15);

        return () => clearInterval(streamInterval);
    }
  }, [streamingTarget, onStreamComplete]);


  const handleRefresh = useCallback(() => { 
    setConsoleError(null);
    setPreviewKey(prev => prev + 1) 
  }, []);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
        if (event.source !== iframeRef.current?.contentWindow) return;
        if (event.data.type === 'preview_error' && event.data.error) {
            setConsoleError(event.data.error);
            setIsConsoleOpen(true);
        } else if (event.data.type === 'preview_success') {
            setConsoleError(null);
        }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleEditorChange = (value: string | undefined) => {
    if (isStreaming) return;
    const newContent = value || '';
    setDisplayedCode(newContent);

    if (!activeFilePath) return;
    
    updateActiveProject(proj => {
        const nodeInfo = findNode(proj.files, activeFilePath);
        if (nodeInfo && typeof nodeInfo.node.content === 'string') {
          nodeInfo.node.content = newContent;
        }
    });

    if (fileType === 'web') {
      if (debounceTimeout.current) clearTimeout(debounceTimeout.current);
      debounceTimeout.current = window.setTimeout(() => handleRefresh(), 500);
    }
  };
  
  const iframeSrcDoc = useMemo(() => {
    if (fileType !== 'web' || !project) return '<html><body></body></html>';

    const flatFiles = flattenFiles(project.files);
    const mainHtmlFile = flatFiles['index.html'] || flatFiles[Object.keys(flatFiles).find(f => f.endsWith('.html')) || ''];

    if (!mainHtmlFile) {
        return '<html><body class="bg-gray-100 dark:bg-gray-800"><div style="padding: 1rem; font-family: sans-serif;" class="text-gray-600 dark:text-gray-400">No HTML file found in project.</div></body></html>';
    }
    
    let html = mainHtmlFile;

    const headInjections = `
      <style>
        html::-webkit-scrollbar { width: 8px; height: 8px; }
        html::-webkit-scrollbar-track { background: transparent; }
        html::-webkit-scrollbar-thumb { background-color: transparent; border-radius: 4px; }
        html:hover::-webkit-scrollbar-thumb { background-color: #d1d5db; }
        html::-webkit-scrollbar-thumb:hover { background-color: #9ca3af; }
        @media (prefers-color-scheme: dark) {
          html:hover::-webkit-scrollbar-thumb { background-color: #4b5563; }
          html::-webkit-scrollbar-thumb:hover { background-color: #6b7280; }
        }
        html { scrollbar-width: thin; scrollbar-color: transparent transparent; }
        html:hover { scrollbar-color: #d1d5db transparent; }
        @media (prefers-color-scheme: dark) { html:hover { scrollbar-color: #4b5563 transparent; } }
      </style>
      <script>
        window.onerror = function(message, source, lineno, colno, error) {
          const errorPayload = { message: message.toString(), stack: error ? error.stack : '' };
          window.parent.postMessage({ type: 'preview_error', error: errorPayload }, '*');
          return true;
        };
        window.addEventListener('load', () => {
          window.parent.postMessage({ type: 'preview_success' }, '*');
        });
      </script>
    `;

    const headEnd = html.indexOf('</head>');
    if (headEnd !== -1) {
        html = html.slice(0, headEnd) + headInjections + html.slice(headEnd);
    } else {
        html += headInjections; // fallback
    }
    
    return html;
  }, [project, previewKey, fileType]);
  
  const getLanguageFromPath = (path: string): string => {
      const extension = path.split('.').pop() || '';
      switch(extension) {
          case 'py': return 'python';
          case 'tsx': return 'typescript';
          case 'jsx': return 'javascript';
          case 'js': return 'javascript';
          case 'ts': return 'typescript';
          case 'html': return 'html';
          case 'css': return 'css';
          case 'json': return 'json';
          case 'md': return 'markdown';
          default: return 'plaintext';
      }
  };
  
  const handleEditorDidMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    monaco.editor.defineTheme('custom-light', {
        base: 'vs', inherit: true, rules: [],
        colors: { 'scrollbar.shadow': '#00000000', 'scrollbarSlider.background': '#d1d5db80', 'scrollbarSlider.hoverBackground': '#9ca3af', 'scrollbarSlider.activeBackground': '#9ca3af' }
    });

    monaco.editor.defineTheme('custom-dark', {
        base: 'vs-dark', inherit: true, rules: [],
        colors: { 'scrollbar.shadow': '#00000000', 'scrollbarSlider.background': '#4b556380', 'scrollbarSlider.hoverBackground': '#6b7280', 'scrollbarSlider.activeBackground': '#6b7280' }
    });
  };
  
  const handleUndo = () => editorRef.current?.trigger('source', 'undo', null);
  const handleRedo = () => editorRef.current?.trigger('source', 'redo', null);


  if (!project) {
      return (
        <aside className="bg-white dark:bg-gray-950 flex-shrink-0 overflow-hidden flex flex-col w-full h-full border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="flex items-center justify-center flex-1 text-gray-500 dark:text-gray-400 text-center p-4">
                <p>Activate the Code Interpreter and send a message to start a coding session.</p>
            </div>
        </aside>
      );
  }

  const renderCodeView = () => (
    <div className="flex flex-col flex-1 min-h-0 bg-white dark:bg-[#1e1e1e]">
        <Editor
            height="100%"
            path={activeFilePath}
            language={getLanguageFromPath(activeFilePath)}
            value={displayedCode}
            onChange={handleEditorChange}
            theme={isDarkMode ? 'custom-dark' : 'light'}
            options={{ 
              minimap: { enabled: false }, fontSize: 14, wordWrap: 'on', automaticLayout: true, glyphMargin: false, 
              folding: false, lineNumbersMinChars: 3, padding: { top: 10 }, lineDecorationsWidth: 5,
              readOnly: isStreaming,
              scrollbar: { verticalScrollbarSize: 8, horizontalScrollbarSize: 8 },
            }}
            onMount={handleEditorDidMount}
        />
    </div>
  );

  const renderPreviewView = () => (
    <div className="flex flex-col flex-1 min-h-0">
        <div className={`flex-1 bg-gray-100 dark:bg-gray-800 flex flex-col transition-all duration-300 ${isPreviewMobile ? 'p-4 bg-gray-200 dark:bg-gray-900 justify-center items-center' : ''}`}>
            <div className="flex-1 relative w-full h-full">
                <iframe 
                    ref={iframeRef} key={previewKey} srcDoc={iframeSrcDoc} title="Code Preview" sandbox="allow-scripts allow-same-origin" 
                    className={`bg-white border-none transition-all duration-300 ${isPreviewMobile ? 'w-[375px] h-[667px] shadow-2xl rounded-2xl border-4 border-black dark:border-gray-600 mx-auto' : 'w-full h-full'}`}
                />
            </div>
        </div>
    </div>
  );

  const renderPythonOutputView = () => (
    <div className="flex flex-col flex-1 min-h-0 bg-gray-950 text-gray-200 font-mono text-sm p-4 overflow-y-auto hover-scrollbar">
        <div className="text-xs text-yellow-300/80 bg-yellow-900/30 border-l-2 border-yellow-500 p-2 mb-4 font-sans rounded-r-sm">
            <b>Note:</b> This is a browser-based Python environment (Pyodide). Native GUI libraries like Tkinter, PyQt, etc., and direct filesystem access are not supported.
        </div>
        {isPyodideLoading && <div className="flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin"/><span>Initializing Python environment...</span></div>}
        {consoleOutput.map((line, i) => <pre key={i} className="whitespace-pre-wrap break-words">{line}</pre>)}
    </div>
  );

  const renderMainView = () => (
      <>
        <div className="flex items-center justify-between p-2 pr-3 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
            <div className="flex items-center gap-2">
                <div className="flex space-x-1 bg-gray-200 dark:bg-gray-800 p-1 rounded-md">
                    <button onClick={() => setActiveTab('code')} className={`flex items-center gap-2 w-full justify-center px-3 py-1 text-sm font-medium rounded transition-colors ${activeTab === 'code' ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-sm' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'}`}><Code className="h-4 w-4" /> Code</button>
                    {fileType === 'web' && <button onClick={() => setActiveTab('preview')} className={`flex items-center gap-2 w-full justify-center px-3 py-1 text-sm font-medium rounded transition-colors ${activeTab === 'preview' ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-sm' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'}`}><Eye className="h-4 w-4" /> Preview</button>}
                    {fileType === 'python' && <button onClick={() => setActiveTab('output')} className={`flex items-center gap-2 w-full justify-center px-3 py-1 text-sm font-medium rounded transition-colors ${activeTab === 'output' ? 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 shadow-sm' : 'text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'}`}><SquareTerminal className="h-4 w-4" /> Output</button>}
                </div>
                {activeTab === 'code' && (
                  <div className="flex items-center">
                    <div className="h-5 w-px bg-gray-200 dark:bg-gray-700 mx-1"></div>
                    <button onClick={handleUndo} className="p-1.5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md" data-tooltip-text="Undo" data-tooltip-position="bottom"><RotateCcw className="h-4 w-4" /></button>
                    <button onClick={handleRedo} className="p-1.5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md" data-tooltip-text="Redo" data-tooltip-position="bottom"><RotateCw className="h-4 w-4" /></button>
                  </div>
                )}
            </div>
             <div className="flex items-center gap-1">
                {fileType === 'python' && (
                    <button onClick={handleRunPython} disabled={isPythonRunning || !pyodide || isPyodideLoading} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium rounded-md bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-500 disabled:cursor-wait">
                      {isPythonRunning ? <Loader2 className="h-4 w-4 animate-spin"/> : <Play className="h-4 w-4" />} Run
                    </button>
                )}
                {fileType === 'web' && activeTab === 'preview' && (
                    <>
                        <button onClick={() => setIsPreviewMobile(p => !p)} className={`p-1.5 rounded-md transition-colors ${isPreviewMobile ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400' : 'text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'}`} data-tooltip-text="Toggle Mobile View" data-tooltip-position="bottom"><Smartphone className="h-4 w-4" /></button>
                        <button onClick={onToggleWidePreview} className="p-1.5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md" data-tooltip-text={isWidePreview ? "Shrink View" : "Expand View"} data-tooltip-position="bottom">{isWidePreview ? <Shrink className="h-4 w-4" /> : <Expand className="h-4 w-4" />}</button>
                        <button onClick={handleRefresh} className="p-1.5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md" data-tooltip-text="Refresh Preview" data-tooltip-position="bottom"><RefreshCw className="h-4 w-4" /></button>
                        <div className="h-5 w-px bg-gray-200 dark:bg-gray-700 mx-1"></div>
                    </>
                )}
                {fileType === 'web' && (
                    <button onClick={() => setIsConsoleOpen(p => !p)} className="p-1.5 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md relative" data-tooltip-text="Toggle Console" data-tooltip-position="bottom">
                      <SquareTerminal className={`h-4 w-4 ${consoleError ? 'text-red-500' : ''}`} />
                      {consoleError && <div className="absolute top-1 right-1 w-1.5 h-1.5 bg-red-500 rounded-full"></div>}
                    </button>
                )}
                <div className="h-5 w-px bg-gray-200 dark:bg-gray-700 mx-1"></div>
                <button onClick={onClose} data-tooltip-text="Close panel" data-tooltip-position="bottom" className="p-1 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-md"><X className="h-5 w-5" /></button>
             </div>
        </div>
        <div className="flex-1 flex flex-col min-h-0">
          {activeTab === 'code' && renderCodeView()}
          {activeTab === 'preview' && fileType === 'web' && renderPreviewView()}
          {activeTab === 'output' && fileType === 'python' && renderPythonOutputView()}
          
          {fileType === 'web' && isConsoleOpen && (
            <div className="flex-shrink-0 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-950">
                <div className={`p-3 max-h-48 overflow-y-auto hover-scrollbar ${consoleError ? 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200' : 'bg-gray-50 dark:bg-gray-900/50 text-gray-600 dark:text-gray-400'}`}>
                    {consoleError ? <pre className="text-xs whitespace-pre-wrap font-mono">{consoleError.message}{consoleError.stack && `\n\n${consoleError.stack}`}</pre> : <p className="text-xs font-mono">No errors.</p>}
                </div>
            </div>
          )}
        </div>
      </>
  );

  return (
    <aside className="bg-white dark:bg-gray-950 flex-shrink-0 overflow-hidden flex flex-col w-full h-full border border-gray-200 dark:border-gray-700 rounded-lg">
      <div className="w-full transition-opacity duration-150 ease-in-out flex flex-col flex-1 min-h-0">
          {renderMainView()}
      </div>
    </aside>
  );
};

export default CodeInterpreterPanel;