import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Sidebar } from './components/Sidebar';
import { ChatArea } from './components/ChatArea';
import { Model, ChatMessage, Role, MediaResolution, Attachment, ChatSession, TunedModel, TuningStatus, Project, FileSystemNode, initialFiles, LiveConversationModel } from './types';
import { generateChatResponse, countTokens, generateImage, generateVideo } from './services/geminiService';
import { Settings, Settings2, PanelLeft } from 'lucide-react';
import { HeaderModelSelector } from './components/HeaderModelSelector';
import { Modal } from './components/Modal';
import { GenerateContentResponse, Type } from '@google/genai';
import { FilesSidebar } from './components/FilesSidebar';
import { ConfirmationModal } from './components/ConfirmationModal';
import CodeInterpreterPanel, { StreamingTarget } from './components/CodeInterpreterPanel';
import { LiveConversation } from './components/LiveConversation';
import { SettingsModal } from './components/SettingsModal';
import { useMediaQuery } from './hooks/useMediaQuery';
import { NavigationSidebar } from './components/NavigationSidebar';


const modelMaxTokens: Partial<Record<Model, number>> = {
    [Model.GEMINI_2_5_PRO]: 1048576,
    [Model.GEMINI_2_5_FLASH]: 1048576,
    [Model.GEMINI_2_5_FLASH_LITE]: 1048576,
    [Model.GEMINI_2_5_FLASH_IMAGE_PREVIEW]: 32768,
    [Model.GEMINI_2_0_FLASH]: 1048576,
    [Model.GEMINI_2_0_FLASH_PREVIEW_IMAGE_GENERATION]: 32768,
    [Model.GEMINI_2_0_FLASH_LITE]: 1048576,
    [Model.IMAGEN_4_0_GENERATE_001]: 4096,
    [Model.IMAGEN_4_0_ULTRA_GENERATE_001]: 4096,
    [Model.IMAGEN_4_0_FAST_GENERATE_001]: 4096,
    [Model.IMAGEN_3_0_GENERATE_002]: 4096,
    [Model.VEO_2_0_GENERATE_001]: 32768,
    [Model.GEMMA_3N_E2B]: 8192,
    [Model.GEMMA_3N_E4B]: 8192,
    [Model.GEMMA_3_1B]: 32768,
    [Model.GEMMA_3_4B]: 32768,
    [Model.GEMMA_3_12B]: 32768,
    [Model.GEMMA_3_27B]: 131072,
};

const createNewProject = (name = 'New Project', description = 'A new coding project.'): Project => ({
    id: `proj_${Date.now()}`,
    name,
    description,
    files: JSON.parse(JSON.stringify(initialFiles)),
});

const findAndUpdateFile = (nodes: { [key: string]: FileSystemNode }, path: string, content: string): boolean => {
    const parts = path.split('/');
    let currentLevel = nodes;

    for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        const isLastPart = i === parts.length - 1;

        if (!currentLevel[part]) {
            if (isLastPart) {
                currentLevel[part] = { name: part, content };
            } else {
                currentLevel[part] = { name: part, children: {} };
            }
        }
        
        if (isLastPart) {
            if(currentLevel[part].children) return false; 
            currentLevel[part].content = content;
        } else {
            if (!currentLevel[part].children) {
                 return false;
            }
            currentLevel = currentLevel[part].children!;
        }
    }
    return true;
};

const App: React.FC = () => {
  const isMobile = useMediaQuery('(max-width: 767px)');
  const prefersDarkMode = useMediaQuery('(prefers-color-scheme: dark)');
  const [selectedModel, setSelectedModel] = useState<Model | string>(Model.GEMINI_2_5_FLASH);
  
  const [chatHistory, setChatHistory] = useState<ChatSession[]>(() => {
    try {
      const savedHistory = localStorage.getItem('chatHistory');
      return savedHistory ? JSON.parse(savedHistory) : [];
    } catch (error) {
      console.error("Failed to load chat history from localStorage", error);
      return [];
    }
  });
  const [activeChatId, setActiveChatId] = useState<string | null>(() => {
    try {
      const savedActiveId = localStorage.getItem('activeChatId');
      // A null ID is a valid state for a new chat, so we don't default it if history exists
      return savedActiveId ? JSON.parse(savedActiveId) : null;
    } catch (error) {
      console.error("Failed to load active chat ID from localStorage", error);
      return null;
    }
  });
  
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isNavSidebarOpen, setIsNavSidebarOpen] = useState<boolean>(!isMobile);
  const [isRightSidebarOpen, setIsRightSidebarOpen] = useState<boolean>(false);
  const [isFilesSidebarOpen, setIsFilesSidebarOpen] = useState<boolean>(false);
  
  const [theme, setTheme] = useState<'light' | 'dark' | 'system'>(() => {
    const savedTheme = localStorage.getItem('theme');
    return (savedTheme || 'system') as 'light' | 'dark' | 'system';
  });
  
  const effectiveTheme = useMemo(() => {
    if (theme === 'system') {
        return prefersDarkMode ? 'dark' : 'light';
    }
    return theme;
  }, [theme, prefersDarkMode]);

  const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
  const [isClearHistoryModalOpen, setIsClearHistoryModalOpen] = useState(false);
  
  // Code Interpreter & Tools State
  const [isCodeInterpreterToggled, setIsCodeInterpreterToggled] = useState<boolean>(false);
  const [isDeepResearchToggled, setIsDeepResearchToggled] = useState<boolean>(false);
  const [isImageToolActive, setIsImageToolActive] = useState<boolean>(false);
  const [isVideoToolActive, setIsVideoToolActive] = useState<boolean>(false);
  const [isCodePanelVisible, setIsCodePanelVisible] = useState<boolean>(false);
  const [activeInterpreterFile, setActiveInterpreterFile] = useState<string>('index.html');
  const [streamingTarget, setStreamingTarget] = useState<StreamingTarget | null>(null);
  const [pendingProjectUpdate, setPendingProjectUpdate] = useState<Project | null>(null);
  const [isWidePreview, setIsWidePreview] = useState<boolean>(false);
  const [isLiveConversationOpen, setIsLiveConversationOpen] = useState(false);
  const [liveConversationModel, setLiveConversationModel] = useState<LiveConversationModel>(() => {
    try {
        const savedModel = localStorage.getItem('liveConversationModel');
        return (savedModel as LiveConversationModel) || LiveConversationModel.FLASH_2_5_NATIVE_AUDIO;
    } catch (error) {
        console.error("Failed to load live conversation model from localStorage", error);
        return LiveConversationModel.FLASH_2_5_NATIVE_AUDIO;
    }
  });


  // Sidebar settings state
  const [systemInstruction, setSystemInstruction] = useState<string>('');
  const [temperature, setTemperature] = useState<number>(1);
  const [topP, setTopP] = useState<number>(0.95);
  const [maxOutputTokens, setMaxOutputTokens] = useState<number>(8192);
  const [stopSequence, setStopSequence] = useState<string>('');
  const [useGoogleSearch, setUseGoogleSearch] = useState<boolean>(false);
  const [mediaResolution, setMediaResolution] = useState<MediaResolution>(MediaResolution.DEFAULT);
  const [tokenCount, setTokenCount] = useState<number>(0);
  const [useThinking, setUseThinking] = useState<boolean>(false);
  const [useThinkingBudget, setUseThinkingBudget] = useState<boolean>(false);
  const [thinkingBudget, setThinkingBudget] = useState<number>(8000);

  // Imagen settings state
  const [numberOfImages, setNumberOfImages] = useState<number>(1);
  const [negativePrompt, setNegativePrompt] = useState<string>('');
  const [seed, setSeed] = useState<number | undefined>(undefined);
  const [aspectRatio, setAspectRatio] = useState<string>('1:1');
  const [personGeneration, setPersonGeneration] = useState<string>('allow_all');

  // Tools state
  const [useStructuredOutput, setUseStructuredOutput] = useState<boolean>(false);
  const [structuredOutputSchema, setStructuredOutputSchema] = useState<string>('');
  const [isSchemaModalOpen, setIsSchemaModalOpen] = useState<boolean>(false);
  const [tempSchema, setTempSchema] = useState<string>('');

  const [useCodeExecution, setUseCodeExecution] = useState<boolean>(false);

  const [useFunctionCalling, setUseFunctionCalling] = useState<boolean>(false);
  const [functionDeclarations, setFunctionDeclarations] = useState<string>('');
  const [isFunctionModalOpen, setIsFunctionModalOpen] = useState<boolean>(false);
  const [tempDeclarations, setTempDeclarations] = useState<string>('');

  const [useUrlContext, setUseUrlContext] = useState<boolean>(false);
  const [urlContext, setUrlContext] = useState<string>('');
  
  // Tuning state
  const [tunedModels, setTunedModels] = useState<TunedModel[]>([]);
  
  // Deletion confirmation state
  const [chatToDelete, setChatToDelete] = useState<string | null>(null);

  const abortControllerRef = useRef<AbortController | null>(null);

  const activeChat = useMemo(() => activeChatId ? chatHistory.find(c => c.id === activeChatId) : null, [chatHistory, activeChatId]);
  const activeProject = useMemo(() => activeChat?.project, [activeChat]);

  useEffect(() => {
    const projectExists = !!activeChat?.project;
    setIsCodeInterpreterToggled(projectExists);
  }, [activeChatId, activeChat]);

  useEffect(() => {
    if (numberOfImages > 4) {
        setNumberOfImages(4);
    }
  }, [numberOfImages]);


  const handleNewChat = useCallback(() => {
    // If we're already on a new, unsaved chat, do nothing.
    if (activeChatId === null) return;
    
    setActiveChatId(null);
    setIsCodePanelVisible(false);
    setIsDeepResearchToggled(false);
    setIsImageToolActive(false);
    setIsVideoToolActive(false);
  }, [activeChatId]);

  useEffect(() => {
    const applyTheme = (t: 'light' | 'dark' | 'system') => {
        if (t === 'system') {
            const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.classList.toggle('dark', systemPrefersDark);
        } else {
            document.documentElement.classList.toggle('dark', t === 'dark');
        }
    };

    applyTheme(theme);
    localStorage.setItem('theme', theme);

    const systemThemeWatcher = window.matchMedia('(prefers-color-scheme: dark)');
    const handleSystemThemeChange = (e: MediaQueryListEvent) => {
        if (theme === 'system') {
            document.documentElement.classList.toggle('dark', e.matches);
        }
    };
    systemThemeWatcher.addEventListener('change', handleSystemThemeChange);

    return () => {
        systemThemeWatcher.removeEventListener('change', handleSystemThemeChange);
    };
  }, [theme]);

  useEffect(() => {
    localStorage.setItem('liveConversationModel', liveConversationModel);
  }, [liveConversationModel]);

  useEffect(() => {
    const setAppHeight = () => document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
    window.addEventListener('resize', setAppHeight); setAppHeight();
    return () => window.removeEventListener('resize', setAppHeight);
  }, []);

  useEffect(() => {
    try {
        const historyToSave = chatHistory.filter(chat => chat.messages.length > 0);
        localStorage.setItem('chatHistory', JSON.stringify(historyToSave));
        
        if (activeChatId) {
            const activeChatIsInSavedHistory = historyToSave.some(chat => chat.id === activeChatId);
            if (activeChatIsInSavedHistory) {
                localStorage.setItem('activeChatId', JSON.stringify(activeChatId));
            } else {
                localStorage.removeItem('activeChatId');
            }
        } else {
            localStorage.removeItem('activeChatId');
        }
    } catch (error) { console.error("Failed to save chat state to localStorage", error); }
  }, [chatHistory, activeChatId]);
  

  useEffect(() => {
    const activeChatExists = chatHistory.some(chat => chat.id === activeChatId);
    // If activeChatId is null, we are on a new chat screen, which is a valid state.
    if (activeChatId === null) return;
    
    if (chatHistory.length > 0 && !activeChatExists) {
        setActiveChatId(chatHistory[0].id);
    } else if (chatHistory.length === 0) {
        // This will set activeChatId to null
        setActiveChatId(null);
    }
  }, [chatHistory, activeChatId]);

  useEffect(() => {
    try {
        const savedModels = localStorage.getItem('tunedModels');
        if (savedModels) setTunedModels(JSON.parse(savedModels));
    } catch (error) { console.error("Failed to load tuned models from localStorage", error); }
  }, []);

  useEffect(() => {
    localStorage.setItem('tunedModels', JSON.stringify(tunedModels));
  }, [tunedModels]);

  const activeBaseModel = useMemo<Model | undefined>(() => {
    if (typeof selectedModel === 'string' && selectedModel.startsWith('tunedModels/')) {
        return tunedModels.find(m => m.id === selectedModel)?.baseModel;
    }
    if (Object.values(Model).includes(selectedModel as Model)) return selectedModel as Model;
    return undefined;
  }, [selectedModel, tunedModels]);

  useEffect(() => {
    const budgetMap: Partial<Record<Model, number>> = {
      [Model.GEMINI_2_5_PRO]: 32768,
      [Model.GEMINI_2_5_FLASH]: 24576,
      [Model.GEMINI_2_5_FLASH_LITE]: 24576,
    };
    if (activeBaseModel) {
        const maxBudgetForModel = budgetMap[activeBaseModel];
        if (maxBudgetForModel !== undefined && thinkingBudget > maxBudgetForModel) setThinkingBudget(maxBudgetForModel);
    }
  }, [activeBaseModel, thinkingBudget]);

  const placeholderSchema = JSON.stringify({ type: Type.OBJECT, properties: { recipeName: { type: Type.STRING, description: "The name of the recipe." } } }, null, 2);
  const placeholderDeclarations = JSON.stringify([{ name: "find_recipes", description: "Find recipes for a given dish and list ingredients.", parameters: { type: Type.OBJECT, properties: { dish: { type: Type.STRING, description: "The dish to search recipes for." }, ingredients: { type: Type.ARRAY, items: { type: Type.STRING } } }, required: ["dish"] } }], null, 2);

  const chatModelNameMap: Partial<Record<Model, string>> = {
    [Model.GEMINI_2_5_PRO]: 'Gemini 2.5 Pro', [Model.GEMINI_2_5_FLASH]: 'Gemini 2.5 Flash', [Model.GEMINI_2_5_FLASH_LITE]: 'Gemini 2.5 Flash-Lite',
    [Model.GEMINI_2_0_FLASH]: 'Gemini 2.0 Flash', [Model.GEMINI_2_0_FLASH_LITE]: 'Gemini 2.0 Flash-Lite',
    [Model.GEMMA_3N_E2B]: 'Gemma 3n E2B', [Model.GEMMA_3N_E4B]: 'Gemma 3n E4B', [Model.GEMMA_3_1B]: 'Gemma 3 1B', [Model.GEMMA_3_4B]: 'Gemma 3 4B', [Model.GEMMA_3_12B]: 'Gemma 3 12B', [Model.GEMMA_3_27B]: 'Gemma 3 27B',
  };

  const imageGenerationModelNameMap: Partial<Record<Model, string>> = {
    [Model.IMAGEN_4_0_ULTRA_GENERATE_001]: 'Imagen 4 Ultra',
    [Model.IMAGEN_4_0_GENERATE_001]: 'Imagen 4',
    [Model.IMAGEN_4_0_FAST_GENERATE_001]: 'Imagen 4 Fast',
    [Model.IMAGEN_3_0_GENERATE_002]: 'Imagen 3',
  };

  const imageEditingModelNameMap: Partial<Record<Model, string>> = {
    [Model.GEMINI_2_5_FLASH_IMAGE_PREVIEW]: 'Flash 2.5 Preview Image',
    [Model.GEMINI_2_0_FLASH_PREVIEW_IMAGE_GENERATION]: 'Flash 2.0 Preview Image',
  };

  const videoGenerationModelNameMap: Partial<Record<Model, string>> = {
    [Model.VEO_2_0_GENERATE_001]: 'Veo 3',
  };
  
  const modelOptions = useMemo(() => (Object.keys(chatModelNameMap) as Model[]).map(modelKey => ({ value: modelKey, label: chatModelNameMap[modelKey]! })), [chatModelNameMap]);
  const deepResearchCompatibleModels: (Model | string)[] = [Model.GEMINI_2_5_PRO, Model.GEMINI_2_5_FLASH];
  const codeInterpreterCompatibleModels: (Model | string)[] = [
    Model.GEMINI_2_5_PRO,
    Model.GEMINI_2_5_FLASH,
    Model.GEMINI_2_5_FLASH_LITE,
    Model.GEMINI_2_0_FLASH,
    Model.GEMINI_2_0_FLASH_LITE,
  ];

  const combinedModelOptions = useMemo(() => {
    if (isVideoToolActive) {
      return (Object.keys(videoGenerationModelNameMap) as Model[]).map(modelKey => ({ value: modelKey, label: videoGenerationModelNameMap[modelKey]! }));
    }

    if (isImageToolActive) {
      const genOptions = (Object.keys(imageGenerationModelNameMap) as Model[]).map(modelKey => ({ value: modelKey, label: imageGenerationModelNameMap[modelKey]! }));
      const editOptions = (Object.keys(imageEditingModelNameMap) as Model[]).map(modelKey => ({ value: modelKey, label: imageEditingModelNameMap[modelKey]! }));
      return [...genOptions, ...editOptions];
    }

    const customModels = tunedModels.filter(m => m.status === TuningStatus.COMPLETED).map(m => ({ value: m.id, label: `[Custom] ${m.displayName}` }));
    const baseOptions = customModels.length > 0 ? [...modelOptions, ...customModels] : modelOptions;
    
    if (isDeepResearchToggled) {
        return baseOptions.filter(opt => deepResearchCompatibleModels.includes(opt.value as Model));
    }

    if (isCodeInterpreterToggled) {
        return modelOptions.filter(opt => codeInterpreterCompatibleModels.includes(opt.value as Model));
    }
    
    return baseOptions;
  }, [tunedModels, modelOptions, isDeepResearchToggled, isCodeInterpreterToggled, isImageToolActive, isVideoToolActive]);

  useEffect(() => {
      if (isDeepResearchToggled && !deepResearchCompatibleModels.includes(selectedModel)) {
          setSelectedModel(Model.GEMINI_2_5_FLASH);
      }
  }, [isDeepResearchToggled, selectedModel]);
  
  useEffect(() => {
      if (isCodeInterpreterToggled && !codeInterpreterCompatibleModels.includes(selectedModel)) {
          setSelectedModel(Model.GEMINI_2_5_FLASH);
      }
  }, [isCodeInterpreterToggled, selectedModel]);

  useEffect(() => {
    const imageGenModels = Object.keys(imageGenerationModelNameMap);
    const imageEditModels = Object.keys(imageEditingModelNameMap);
    const videoGenModels = Object.keys(videoGenerationModelNameMap);
    const allMultimediaModels = [...imageGenModels, ...imageEditModels, ...videoGenModels];

    if (isImageToolActive) {
        if (![...imageGenModels, ...imageEditModels].includes(selectedModel)) {
            setSelectedModel(Model.IMAGEN_4_0_GENERATE_001);
        }
    } else if (isVideoToolActive) {
        if (!videoGenModels.includes(selectedModel)) {
            setSelectedModel(Model.VEO_2_0_GENERATE_001);
        }
    } else {
        if (allMultimediaModels.includes(selectedModel)) {
            setSelectedModel(Model.GEMINI_2_5_FLASH);
        }
    }
  }, [isImageToolActive, isVideoToolActive, selectedModel]);
  
  const messages = useMemo(() => activeChat ? activeChat.messages : [], [activeChat]);

  const isGemmaModel = useMemo(() => activeBaseModel ? activeBaseModel.startsWith('gemma') : false, [activeBaseModel]);
  const isTextToImageModel = useMemo(() => activeBaseModel ? [
    Model.IMAGEN_4_0_GENERATE_001, 
    Model.IMAGEN_4_0_ULTRA_GENERATE_001, 
    Model.IMAGEN_4_0_FAST_GENERATE_001, 
    Model.IMAGEN_3_0_GENERATE_002
].includes(activeBaseModel as Model) : false, [activeBaseModel]);
  const isImageEditModel = useMemo(() => activeBaseModel ? [Model.GEMINI_2_0_FLASH_PREVIEW_IMAGE_GENERATION, Model.GEMINI_2_5_FLASH_IMAGE_PREVIEW].includes(activeBaseModel as Model) : false, [activeBaseModel]);
  const isVideoModel = useMemo(() => activeBaseModel === Model.VEO_2_0_GENERATE_001, [activeBaseModel]);
  const isThinkingModel = useMemo(() => activeBaseModel ? [Model.GEMINI_2_5_PRO, Model.GEMINI_2_5_FLASH, Model.GEMINI_2_5_FLASH_LITE].includes(activeBaseModel) : false, [activeBaseModel]);
  const isProModel = useMemo(() => activeBaseModel === Model.GEMINI_2_5_PRO, [activeBaseModel]);
    
  useEffect(() => {
    const calculateTokens = async () => {
      if (messages.length > 0 && !isTextToImageModel && !isImageEditModel && !isVideoModel) {
        const modelForCount = activeBaseModel || Model.GEMINI_2_5_FLASH;
        try {
          const count = await countTokens(messages, modelForCount);
          setTokenCount(count);
        } catch (e) {
          console.error("Error counting tokens:", e);
          setTokenCount(0);
        }
      } else { setTokenCount(0); }
    };
    calculateTokens();
  }, [messages, activeBaseModel, isTextToImageModel, isImageEditModel, isVideoModel]);

  const interpreterResponseSchema = {
      type: Type.OBJECT,
      properties: {
          projectName: {
              type: Type.STRING,
              description: "A short, descriptive name for the project or the UI component being created, e.g., 'Login Form' or 'Interactive Chart'.",
          },
          explanation: {
              type: Type.STRING,
              description: "A friendly, step-by-step explanation of the code changes made. This will be shown to the user in the chat.",
          },
          files: {
              type: Type.ARRAY,
              description: "An array of file objects that represent the complete state of the files to be created or updated.",
              items: {
                  type: Type.OBJECT,
                  properties: {
                      path: {
                          type: Type.STRING,
                          description: "The full path of the file, e.g., 'index.html' or 'src/App.tsx'.",
                      },
                      content: {
                          type: Type.STRING,
                          description: "The complete new content of the file.",
                      },
                  },
                  required: ["path", "content"],
              },
          },
      },
      required: ["projectName", "explanation", "files"],
  };

  const handleStopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
    }
    setIsLoading(false);
    setChatHistory(prev =>
        prev.map(chat => {
            if (chat.id === activeChatId) {
                const updatedMessages = [...chat.messages];
                const lastMessage = updatedMessages[updatedMessages.length - 1];
                if (lastMessage && lastMessage.role === Role.MODEL && isLoading) {
                    updatedMessages[updatedMessages.length - 1] = {
                        ...lastMessage,
                        content: 'You stopped this response.',
                        isThinking: false,
                    };
                    return { ...chat, messages: updatedMessages };
                }
            }
            return chat;
        })
    );
  }, [activeChatId, isLoading]);

  const handleSendMessage = useCallback(async (prompt: string, attachments: Attachment[]) => {
    if ((!prompt.trim() && attachments.length === 0) || isLoading) return;

    const isInterpreterRequest = isCodeInterpreterToggled;
    const isImageRequest = isImageToolActive;
    const isVideoRequest = isVideoToolActive;

    if (isImageRequest && isTextToImageModel && attachments.length > 0) {
        alert("Text-to-image models do not support file attachments. Please remove the attached files.");
        return;
    }

    setIsLoading(true);
    abortControllerRef.current = new AbortController();
    const signal = abortControllerRef.current.signal;
    
    const isNewChat = activeChatId === null;
    let currentChatId = isNewChat ? Date.now().toString() : activeChatId!;
    let currentChat: ChatSession;

    const uiUserMessage: ChatMessage = { id: `msg-user-${Date.now()}`, role: Role.USER, content: prompt, attachments };
    let placeholderContent = '';
    if (isVideoRequest) {
      placeholderContent = '🎬 **Generating your video...**\n\nThis process can take several minutes. Please wait while the model creates your content.';
    }
    const isThinkingActive = isThinkingModel && (isProModel || useThinking);
    const placeholderModelMessage: ChatMessage = { id: `msg-model-${Date.now()}`, role: Role.MODEL, content: placeholderContent, reasoning: '', isThinking: isThinkingActive || isImageRequest || isVideoRequest, projectFilesUpdate: isInterpreterRequest };

    if (isNewChat) {
        const newTitle = prompt.substring(0, 40) + (prompt.length > 40 ? '...' : '');
        currentChat = {
            id: currentChatId,
            title: newTitle,
            messages: [uiUserMessage, placeholderModelMessage]
        };
        setChatHistory(prev => [currentChat, ...prev]);
        setActiveChatId(currentChatId);
    } else {
        currentChat = chatHistory.find(c => c.id === activeChatId)!;
        setChatHistory(prev => prev.map(chat =>
            chat.id === currentChatId
                ? { ...chat, messages: [...chat.messages, uiUserMessage, placeholderModelMessage] }
                : chat
        ));
    }
    
    const modelForApi = activeBaseModel || Model.GEMINI_2_5_FLASH;
    let systemInstructionForApi = systemInstruction;
    
    if (isInterpreterRequest) {
        // Find the most up-to-date project object, which might have just been created
        let projectForApi = chatHistory.find(c => c.id === currentChatId)?.project;
        if (!projectForApi) {
            const newProject = createNewProject(`Project for: ${prompt.substring(0, 30)}...`);
            const updatedChat = { ...currentChat, project: newProject };
            setChatHistory(prev => prev.map(c => c.id === currentChatId ? updatedChat : c));
            projectForApi = newProject;
        }
    }
    
    let apiUserMessage: ChatMessage = { id: `msg-user-api-${Date.now()}`, role: Role.USER, content: prompt, attachments };
    
    if (typeof selectedModel === 'string' && selectedModel.startsWith('tunedModels/')) {
        const customModel = tunedModels.find(m => m.id === selectedModel);
        if (customModel) systemInstructionForApi = customModel.systemInstruction;
    } else if (isDeepResearchToggled && useUrlContext && urlContext) {
      apiUserMessage.content = `Using the content from the URL: ${urlContext}, answer the following question: ${prompt}`;
    } else if (isInterpreterRequest) {
        systemInstructionForApi = `You are an expert full-stack developer. Your task is to respond to the user's request by providing updated code files.

**RESPONSE FORMAT:**
You **MUST** respond with a single JSON object that conforms to this schema:
\`\`\`json
{
  "projectName": "A short, descriptive name for the project.",
  "explanation": "A friendly explanation of the changes made. This is shown to the user in the chat.",
  "files": [
    {
      "path": "path/to/file.ext",
      "content": "The complete, new content of the file."
    }
  ]
}
\`\`\`

**IMPORTANT RULES:**
1.  **JSON ONLY:** Your entire response must be a single, valid JSON object. Do not include any text or markdown outside of this JSON.
2.  **PROJECT NAME:** The \`projectName\` field should be a concise and relevant title for the code you are generating (e.g., "Login Form", "Interactive Chart").
3.  **ALWAYS GENERATE SELF-CONTAINED HTML:** For any web-based output (including vanilla JS, React, Vue, etc.), you **MUST** generate a single, self-contained \`index.html\` file.
    - **CSS:** Always use Tailwind CSS via its CDN script included in the \`<head>\`.
    - **React:** If React is requested, all JSX/React code must be inside a \`<script type="text/babel">\` tag within the \`index.html\`. You must also include CDN script tags in the \`<head>\` for React, ReactDOM, and Babel Standalone. Do **not** create separate \`.tsx\` or \`.jsx\` files.
    - The HTML file should be complete and ready to be rendered in a browser.
4.  **COMPLETE FILES:** Always provide the *complete* content for any file you create or modify.
5.  **EXPLANATION:** The \`explanation\` field should be a clear, user-friendly description of what you did.`;
    }

    // For the API call, we need the history *before* this turn's user message.
    const messagesForApi: ChatMessage[] = [...(currentChat.messages.slice(0, -2)), apiUserMessage];
    
    let fullResponseText = '';
    let groundingChunks: any[] = [];
    let finalParts: any[] = [];
    let fullResponse: GenerateContentResponse | null = null;

    try {
        if (isImageRequest && isTextToImageModel) {
            const imageConfig = { numberOfImages, negativePrompt, seed, aspectRatio, personGeneration };
            fullResponse = await generateImage(prompt, modelForApi as any, imageConfig, signal);
        } else if (isVideoRequest) {
            fullResponse = await generateVideo(prompt, attachments, Model.VEO_2_0_GENERATE_001, signal);
        } else {
            const tools = [];
            if (isDeepResearchToggled) {
                tools.push({ googleSearch: {} });
            } else {
                if (useCodeExecution && !isInterpreterRequest) tools.push({ codeExecution: {} });
                if (useFunctionCalling && functionDeclarations) try { tools.push({ functionDeclarations: JSON.parse(functionDeclarations) }); } catch (e) { console.error("Invalid function declarations JSON:", e); }
            }

            const config: any = { temperature, topP, maxOutputTokens, stopSequences: stopSequence ? [stopSequence] : undefined };
            if (isThinkingModel) {
                const thinkingModeActive = isProModel || useThinking;
                if (thinkingModeActive) { if (useThinkingBudget) config.thinkingConfig = { thinkingBudget }; } 
                else { config.thinkingConfig = { thinkingBudget: 0 }; }
            }
            
            if (isInterpreterRequest) {
                config.responseMimeType = "application/json";
                config.responseSchema = interpreterResponseSchema;
            } else {
                if (tools.length > 0) config.tools = tools;
                if (useStructuredOutput && structuredOutputSchema && !isDeepResearchToggled) try { config.responseMimeType = "application/json"; config.responseSchema = JSON.parse(structuredOutputSchema); } catch (e) { console.error("Invalid structured output schema JSON:", e); }
            }

            let finalSystemInstruction = systemInstructionForApi;
            if (isThinkingActive && !isInterpreterRequest && !isImageEditModel && !isTextToImageModel && !isVideoModel) {
                finalSystemInstruction = `${systemInstructionForApi}\n\nWhen providing an answer, first output your reasoning steps inside <thinking> tags...`.trim();
            }

            const options = { systemInstruction: finalSystemInstruction, config };
            
            await generateChatResponse(messagesForApi, modelForApi as Model, options, (chunk: GenerateContentResponse) => {
                fullResponse = chunk; // In non-streaming, this is the only chunk.
                if (chunk.candidates?.[0]?.content?.parts) {
                    finalParts = chunk.candidates[0].content.parts;
                }

                let chunkText = chunk.text;
                fullResponseText += chunkText;
                
                const newChunks = chunk.candidates?.[0]?.groundingMetadata?.groundingChunks;
                if (newChunks) {
                    groundingChunks.push(...newChunks);
                }
                
                if (!isInterpreterRequest && !isImageEditModel && !isTextToImageModel && !isVideoModel) {
                    const updater = (prevSession: ChatSession): ChatSession => {
                        let lastMessage = prevSession.messages[prevSession.messages.length - 1];
                        if (!lastMessage || lastMessage.role !== Role.MODEL) return prevSession;
                        let updatedMessage = { ...lastMessage, content: fullResponseText };
                        return { ...prevSession, messages: [...prevSession.messages.slice(0, -1), updatedMessage] };
                    };
                    setChatHistory(prev => prev.map(chat => chat.id === currentChatId ? updater(chat) : chat));
                }
            }, signal);
        }
    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
            console.log("Message generation was stopped by the user.");
            return;
        }
        console.error("Error generating response:", error);
        const errorUpdater = (prev: ChatSession): ChatSession => {
            const lastMessage = prev.messages[prev.messages.length - 1];
            if (lastMessage?.role === Role.MODEL) return { ...prev, messages: [...prev.messages.slice(0, -1), { ...lastMessage, content: 'Sorry, I encountered an error. Please try again.', isThinking: false }] };
            return prev;
        }
        setChatHistory(prev => prev.map(c => c.id === currentChatId ? errorUpdater(c) : c));

    } finally {
        setIsLoading(false);
        if (signal.aborted) {
            return; 
        }

        if(fullResponse) {
          finalParts = fullResponse.candidates?.[0]?.content?.parts || finalParts;
          fullResponseText = fullResponse.text || fullResponseText;
        }

        const finalUpdater = (prev: ChatSession): ChatSession => {
            const lastMsg = prev.messages[prev.messages.length - 1];
            if (lastMsg?.role === Role.MODEL) {
              
              let updatedMsg = { ...lastMsg };

              if (isImageRequest || isVideoRequest) {
                let finalContent = '';
                const finalAttachments: Attachment[] = [];

                if (finalParts && finalParts.length > 0) {
                    finalParts.forEach(part => {
                        if (part.text) {
                            finalContent += part.text;
                        } else if (part.inlineData) {
                            const isVideo = part.inlineData.mimeType.startsWith('video/');
                            const attachment: Attachment = {
                                name: `generated-${isVideo ? 'video' : 'image'}-${Date.now()}`,
                                mimeType: part.inlineData.mimeType,
                                dataUrl: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
                            };
                            finalAttachments.push(attachment);
                        }
                    });
                } else if (fullResponseText) { // Fallback if parts aren't there but text is
                    finalContent = fullResponseText;
                }
                
                updatedMsg.content = finalContent || (isVideoRequest ? "Here is your generated video." : "");
                updatedMsg.attachments = finalAttachments;

              } else if (isInterpreterRequest && prev.project) {
                  try {
                      let cleanedJsonString = fullResponseText.trim();
                      const jsonMatch = cleanedJsonString.match(/```json\s*([\s\S]*?)\s*```/);
                      if (jsonMatch && jsonMatch[1]) cleanedJsonString = jsonMatch[1];
                      else {
                          const firstBrace = cleanedJsonString.indexOf('{');
                          const lastBrace = cleanedJsonString.lastIndexOf('}');
                          if (firstBrace !== -1 && lastBrace > firstBrace) cleanedJsonString = cleanedJsonString.substring(firstBrace, lastBrace + 1);
                      }

                      const parsedResponse = JSON.parse(cleanedJsonString);
                      
                      if (parsedResponse.files && parsedResponse.explanation && parsedResponse.projectName) {
                          const projectForUpdate = JSON.parse(JSON.stringify(prev.project));
                          projectForUpdate.name = parsedResponse.projectName;
                          let lastUpdatedFile = 'index.html';
                          
                          parsedResponse.files.forEach((file: { path: string, content: string }) => {
                              if (findAndUpdateFile(projectForUpdate.files, file.path, file.content)) lastUpdatedFile = file.path;
                          });
                          
                          setActiveInterpreterFile(lastUpdatedFile);
                          setPendingProjectUpdate(projectForUpdate);
                          setStreamingTarget({
                            filePath: lastUpdatedFile,
                            code: parsedResponse.files.find((f: any) => f.path === lastUpdatedFile)?.content || ''
                          });

                          updatedMsg.content = parsedResponse.explanation;
                          updatedMsg.project = projectForUpdate;
                          
                          setIsCodePanelVisible(true);
                          openRightPanel('none');
                          if (!isMobile) setIsNavSidebarOpen(false);

                      } else {
                          updatedMsg.content = "The AI response was not in the expected format. Here is the raw response:\n\n" + fullResponseText;
                      }
                  } catch (e) {
                      console.error("Failed to parse AI JSON response:", e);
                      updatedMsg.content = "Failed to parse the AI's code response. Here is the raw response:\n\n" + fullResponseText;
                  }
              } else {
                  const thinkingRegex = /<thinking>([\s\S]*?)<\/thinking>/;
                  const match = fullResponseText.match(thinkingRegex);
                  if (match) {
                      updatedMsg.reasoning = match[1].trim();
                      updatedMsg.content = fullResponseText.replace(thinkingRegex, '').trim();
                  } else {
                    updatedMsg.content = fullResponseText;
                  }
              }
              
              if (groundingChunks.length > 0) {
                  const uniqueChunks = Array.from(new Map(groundingChunks.map(item => [item.web?.uri, item])).values())
                                              .filter(item => item && item.web && item.web.uri);
                  updatedMsg.groundingChunks = uniqueChunks;
              }

              updatedMsg.isThinking = false;
              return { ...prev, messages: [...prev.messages.slice(0, -1), updatedMsg] };
            }
            return prev;
        }
        setChatHistory(prev => prev.map(c => c.id === currentChatId ? finalUpdater(c) : c));
    }
  }, [isLoading, activeChatId, chatHistory, activeBaseModel, systemInstruction, selectedModel, tunedModels, isDeepResearchToggled, useUrlContext, urlContext, temperature, topP, maxOutputTokens, stopSequence, isThinkingModel, isProModel, useThinking, useThinkingBudget, thinkingBudget, useStructuredOutput, structuredOutputSchema, useCodeExecution, useFunctionCalling, functionDeclarations, isMobile, isCodeInterpreterToggled, isImageToolActive, isVideoToolActive, isTextToImageModel, isImageEditModel, isVideoModel, numberOfImages, negativePrompt, seed, aspectRatio, personGeneration]);

  const handleStreamComplete = useCallback(() => {
    if (pendingProjectUpdate) {
        setChatHistory(prev => prev.map(chat => 
            chat.id === activeChatId 
                ? { ...chat, project: pendingProjectUpdate } 
                : chat
        ));
        setPendingProjectUpdate(null);
    }
    setStreamingTarget(null);
  }, [pendingProjectUpdate, activeChatId]);

  const handleOpenProjectVersion = useCallback((project: Project) => {
    setChatHistory(prev => prev.map(chat =>
        chat.id === activeChatId
            ? { ...chat, project: project }
            : chat
    ));
    setIsCodePanelVisible(true);
    openRightPanel('none');
    if (!isMobile) {
        setIsNavSidebarOpen(false);
    }
  }, [activeChatId, isMobile]);

  const handleSelectChat = useCallback((id: string) => {
    setActiveChatId(id);
    setIsCodePanelVisible(false);
    if(isMobile) setIsNavSidebarOpen(false);
  }, [isMobile]);
  
  const handleDeleteChat = useCallback((idToDelete: string) => setChatToDelete(idToDelete), []);
  
  const confirmDeleteChat = useCallback(() => {
    if (!chatToDelete) return;
    setChatHistory(prevHistory => {
        const newHistory = prevHistory.filter(chat => chat.id !== chatToDelete);
        if (activeChatId === chatToDelete) {
            // If the deleted chat was active, switch to a new chat screen
            setActiveChatId(null);
        }
        return newHistory;
    });
    setChatToDelete(null);
  }, [chatToDelete, activeChatId]);
  
  const handleRenameChat = useCallback((id: string, newTitle: string) => {
      setChatHistory(prev => prev.map(chat => chat.id === id ? { ...chat, title: newTitle.trim() || 'Untitled Chat' } : chat));
  }, []);

  const handleDeleteAttachment = useCallback((messageIndex: number, attachmentIndex: number) => {
    setChatHistory(prev => prev.map(chat => {
        if (chat.id === activeChatId) {
            const updatedMessages = [...chat.messages];
            const targetMessage = updatedMessages[messageIndex];
            if (targetMessage?.attachments) {
                updatedMessages[messageIndex] = { ...targetMessage, attachments: targetMessage.attachments.filter((_, idx) => idx !== attachmentIndex) };
                return { ...chat, messages: updatedMessages };
            }
        }
        return chat;
    }));
  }, [activeChatId]);

  const handleStartTuning = useCallback((config: Omit<TunedModel, 'id' | 'status'>) => {
    const newModel: TunedModel = { ...config, id: `tunedModels/custom-${config.displayName.replace(/\s+/g, '-').toLowerCase()}-${Date.now()}`, status: TuningStatus.TRAINING };
    setTunedModels(prev => [...prev, newModel]);
    setTimeout(() => setTunedModels(prev => prev.map(m => m.id === newModel.id ? { ...m, status: TuningStatus.COMPLETED } : m)), 15000);
  }, []);
  
  const handleUpdateTuning = useCallback((updatedModel: TunedModel) => {
    setTunedModels(prev => prev.map(m => m.id === updatedModel.id ? { ...updatedModel, status: TuningStatus.TRAINING } : m));
    setTimeout(() => setTunedModels(prev => prev.map(m => m.id === updatedModel.id ? { ...m, status: TuningStatus.COMPLETED } : m)), 15000);
  }, []);
  
  const handleDeleteTunedModel = useCallback((modelId: string) => {
    setTunedModels(prev => prev.filter(m => m.id !== modelId));
    if (selectedModel === modelId) setSelectedModel(Model.GEMINI_2_5_FLASH);
  }, [selectedModel]);

  const openRightPanel = (panel: 'settings' | 'files' | 'none') => {
      setIsRightSidebarOpen(panel === 'settings'); setIsFilesSidebarOpen(panel === 'files');
      if (panel !== 'none' && isMobile) setIsNavSidebarOpen(false);
  };

  const toggleNavSidebar = useCallback(() => setIsNavSidebarOpen(prev => !prev), []);
  const toggleRightSidebar = () => openRightPanel(isRightSidebarOpen ? 'none' : 'settings');
  const toggleFilesSidebar = () => openRightPanel(isFilesSidebarOpen ? 'none' : 'files');

  const handleToggleCodeInterpreter = () => {
    setIsCodeInterpreterToggled(prev => {
        const newState = !prev;
        if (newState) {
          setIsDeepResearchToggled(false);
          setIsImageToolActive(false);
          setIsVideoToolActive(false);
        }
        return newState;
    });
  };

  const handleToggleDeepResearch = () => {
    setIsDeepResearchToggled(prev => {
        const newState = !prev;
        if (newState) {
          setIsCodeInterpreterToggled(false);
          setIsImageToolActive(false);
          setIsVideoToolActive(false);
        }
        return newState;
    });
  };
  
  const handleToggleImageTool = () => {
    setIsImageToolActive(prev => {
        const newState = !prev;
        if (newState) {
          setIsCodeInterpreterToggled(false);
          setIsDeepResearchToggled(false);
          setIsVideoToolActive(false);
        }
        return newState;
    });
  };

  const handleToggleVideoTool = () => {
    setIsVideoToolActive(prev => {
        const newState = !prev;
        if (newState) {
          setIsCodeInterpreterToggled(false);
          setIsDeepResearchToggled(false);
          setIsImageToolActive(false);
        }
        return newState;
    });
  };

  const handleProjectChange = useCallback((newProject: Project) => {
      setChatHistory(prev => prev.map(chat => chat.id === activeChatId ? { ...chat, project: newProject } : chat));
  }, [activeChatId]);

  const handleExportHistory = useCallback(() => {
    if (chatHistory.length === 0) {
      alert("There is no chat history to export.");
      return;
    }
    const dataStr = JSON.stringify(chatHistory, null, 2);
    const dataBlob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.download = `gemini-playground-history-${new Date().toISOString()}.json`;
    link.href = url;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setIsSettingsModalOpen(false);
  }, [chatHistory]);

  const confirmClearHistory = useCallback(() => {
    setChatHistory([]);
    setActiveChatId(null);
    setIsClearHistoryModalOpen(false);
    setIsSettingsModalOpen(false);
  }, []);

  const closeAllSidebars = () => { setIsNavSidebarOpen(false); openRightPanel('none'); };
  const openSchemaModal = () => { setTempSchema(structuredOutputSchema || placeholderSchema); setIsSchemaModalOpen(true); };
  const saveSchema = (schema: string) => setStructuredOutputSchema(schema);
  const openFunctionModal = () => { setTempDeclarations(functionDeclarations || placeholderDeclarations); setIsFunctionModalOpen(true); };
  const saveDeclarations = (declarations: string) => setFunctionDeclarations(declarations);
  const toggleStructuredOutput = (enabled: boolean) => { if (!enabled || isDeepResearchToggled) setUseStructuredOutput(enabled); };
  const toggleGoogleSearch = (enabled: boolean) => { if (enabled && useStructuredOutput) setUseStructuredOutput(false); if (!enabled) { setUseUrlContext(false); setUrlContext(''); } setUseGoogleSearch(enabled); };
  const modelMaxTokensForSidebar = useMemo(() => activeBaseModel && modelMaxTokens[activeBaseModel] ? modelMaxTokens[activeBaseModel]! : 8192, [activeBaseModel]);

  return (
    <div className="full-height-app font-sans bg-white dark:bg-gray-950 text-gray-800 dark:text-gray-200 flex overflow-hidden">
        {isMobile && (isNavSidebarOpen || isRightSidebarOpen || isFilesSidebarOpen) && <div className="fixed inset-0 bg-black/50 z-20" onClick={closeAllSidebars} />}
        <NavigationSidebar isSidebarOpen={isNavSidebarOpen} onNewChat={handleNewChat} chatHistory={chatHistory} activeChatId={activeChatId} onSelectChat={handleSelectChat} onDeleteChat={handleDeleteChat} onRenameChat={handleRenameChat} isMobile={isMobile} onOpenSettings={() => setIsSettingsModalOpen(true)} />
        
        <div className="flex-1 flex flex-col min-w-0 md:py-4 md:pr-4 md:pl-0 max-md:pt-14">
            <header className="flex items-center justify-between pb-4 flex-shrink-0 max-md:fixed max-md:top-0 max-md:left-0 max-md:right-0 max-md:z-20 max-md:bg-white dark:max-md:bg-gray-950 max-md:h-14 max-md:p-0 max-md:px-4">
                <div className="flex items-center gap-4 min-w-0">
                    <button onClick={toggleNavSidebar} data-tooltip-text="Toggle Menu" data-tooltip-position="bottom" className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200"><PanelLeft className="h-6 w-6" /></button>
                    <h1 className="text-lg font-semibold text-gray-800 dark:text-gray-200 truncate hidden md:block" title={activeChat?.title || 'New Chat'}>{activeChat?.title || 'New Chat'}</h1>
                </div>
                <div className="flex items-center gap-2">
                    <HeaderModelSelector selectedModel={selectedModel} setSelectedModel={setSelectedModel} modelOptions={combinedModelOptions} isMobile={isMobile} />
                    <button onClick={toggleFilesSidebar} data-tooltip-text="Files & Tuning" data-tooltip-position="bottom" data-tooltip-align="right" className={`text-gray-500 hover:text-gray-800 p-2 rounded-lg hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 ${isCodePanelVisible ? 'hidden' : ''}`}><Settings2 className="h-5 w-5" /></button>
                    <button onClick={toggleRightSidebar} data-tooltip-text="Model Settings" data-tooltip-position="bottom" data-tooltip-align="right" className={`text-gray-500 hover:text-gray-800 p-2 rounded-lg hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800 ${isCodePanelVisible ? 'hidden' : ''}`}><Settings className="h-5 w-5" /></button>
                </div>
            </header>

            <div className="flex-1 flex min-h-0">
                <main className={`flex flex-col min-w-0 bg-white dark:bg-gray-950 md:border border-gray-200 dark:border-gray-700 md:rounded-lg overflow-hidden transition-all duration-300 ease-in-out ${isCodePanelVisible ? (isWidePreview ? 'hidden' : 'flex-1') : 'w-full'}`}>
                    <ChatArea
                        messages={messages}
                        onSendMessage={handleSendMessage}
                        isLoading={isLoading}
                        onStopGeneration={handleStopGeneration}
                        isCodeInterpreterActive={isCodeInterpreterToggled}
                        onToggleCodeInterpreter={handleToggleCodeInterpreter}
                        isDeepResearchActive={isDeepResearchToggled}
                        onToggleDeepResearch={handleToggleDeepResearch}
                        isImageToolActive={isImageToolActive}
                        onToggleImageTool={handleToggleImageTool}
                        isVideoToolActive={isVideoToolActive}
                        onToggleVideoTool={handleToggleVideoTool}
                        onOpenProjectVersion={handleOpenProjectVersion}
                        isTextToImageModel={isTextToImageModel}
                        isImageEditModel={isImageEditModel}
                        isVideoModel={isVideoModel}
                        isMobile={isMobile}
                        onStartLiveConversation={() => setIsLiveConversationOpen(true)}
                    />
                </main>
                
                {isCodePanelVisible && (
                     <div className={`flex-shrink-0 overflow-hidden ml-2 transition-all duration-300 ease-in-out ${isWidePreview ? 'flex-1' : 'w-[800px]'}`} style={{ display: isMobile ? 'none' : 'flex' }}>
                        <CodeInterpreterPanel
                            isMobile={isMobile}
                            isDarkMode={false}
                            project={activeProject}
                            onProjectChange={handleProjectChange}
                            onClose={() => {
                                setIsCodePanelVisible(false);
                                setIsWidePreview(false);
                            }}
                            activeFilePath={activeInterpreterFile}
                            streamingTarget={streamingTarget}
                            onStreamComplete={handleStreamComplete}
                            isWidePreview={isWidePreview}
                            onToggleWidePreview={() => setIsWidePreview(p => !p)}
                        />
                    </div>
                )}

                <Sidebar
                    selectedModel={selectedModel} setSelectedModel={setSelectedModel} isSidebarOpen={isRightSidebarOpen} modelOptions={combinedModelOptions} systemInstruction={systemInstruction} setSystemInstruction={setSystemInstruction} temperature={temperature} setTemperature={setTemperature} topP={topP} setTopP={setTopP} maxOutputTokens={maxOutputTokens} setMaxOutputTokens={setMaxOutputTokens} stopSequence={stopSequence} setStopSequence={setStopSequence} tokenCount={tokenCount} modelMaxTokens={modelMaxTokensForSidebar} mediaResolution={mediaResolution} setMediaResolution={setMediaResolution} useThinking={useThinking} setUseThinking={setUseThinking} useThinkingBudget={useThinkingBudget} setUseThinkingBudget={setUseThinkingBudget} thinkingBudget={thinkingBudget} setThinkingBudget={setThinkingBudget} useStructuredOutput={useStructuredOutput} setUseStructuredOutput={toggleStructuredOutput} openSchemaModal={openSchemaModal} useCodeExecution={useCodeExecution} setUseCodeExecution={setUseCodeExecution} useFunctionCalling={useFunctionCalling} setUseFunctionCalling={setUseFunctionCalling} openFunctionModal={openFunctionModal} useGoogleSearch={isDeepResearchToggled || useGoogleSearch} setUseGoogleSearch={toggleGoogleSearch} useUrlContext={useUrlContext} setUseUrlContext={setUseUrlContext} urlContext={urlContext} setUrlContext={setUrlContext} isMobile={isMobile} isGemmaModel={isGemmaModel} isImageEditModel={isImageEditModel} isTextToImageModel={isTextToImageModel} isVideoModel={isVideoModel} isThinkingModel={isThinkingModel} isProModel={isProModel}
                    numberOfImages={numberOfImages} setNumberOfImages={setNumberOfImages}
                    negativePrompt={negativePrompt} setNegativePrompt={setNegativePrompt}
                    seed={seed} setSeed={setSeed}
                    aspectRatio={aspectRatio} setAspectRatio={setAspectRatio}
                    personGeneration={personGeneration} setPersonGeneration={setPersonGeneration}
                />
                <FilesSidebar isSidebarOpen={isFilesSidebarOpen} messages={messages} onDeleteAttachment={handleDeleteAttachment} tunedModels={tunedModels} onStartTuning={handleStartTuning} onUpdateTuning={handleUpdateTuning} onDeleteTunedModel={handleDeleteTunedModel} modelOptions={modelOptions} isMobile={isMobile} />
            </div>
        </div>
        <Modal isOpen={isSchemaModalOpen} onClose={() => setIsSchemaModalOpen(false)} onSave={saveSchema} title="Edit Structured Output Schema" content={tempSchema} setContent={setTempSchema} placeholder={placeholderSchema} helpText="Define the JSON schema for the model's output..." />
        <Modal isOpen={isFunctionModalOpen} onClose={() => setIsFunctionModalOpen(false)} onSave={saveDeclarations} title="Edit Function Declarations" content={tempDeclarations} setContent={setTempDeclarations} placeholder={placeholderDeclarations} helpText={<>Define functions the model can call. See the <a href="https://ai.google.dev/docs/function_calling" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">documentation</a> for the correct format.</>} />
        <ConfirmationModal isOpen={!!chatToDelete} onClose={() => setChatToDelete(null)} onConfirm={confirmDeleteChat} title="Delete Chat">Are you sure you want to delete this chat? This action cannot be undone.</ConfirmationModal>
        <LiveConversation 
            isOpen={isLiveConversationOpen} 
            onClose={() => setIsLiveConversationOpen(false)}
            appTheme={effectiveTheme}
            model={liveConversationModel}
        />
        <SettingsModal 
            isOpen={isSettingsModalOpen}
            onClose={() => setIsSettingsModalOpen(false)}
            theme={theme}
            setTheme={setTheme}
            onExportHistory={handleExportHistory}
            onClearHistory={() => setIsClearHistoryModalOpen(true)}
            liveConversationModel={liveConversationModel}
            setLiveConversationModel={setLiveConversationModel}
        />
        <ConfirmationModal
            isOpen={isClearHistoryModalOpen}
            onClose={() => setIsClearHistoryModalOpen(false)}
            onConfirm={confirmClearHistory}
            title="Clear All Chat History"
        >
            Are you sure you want to delete all chat history? This action is irreversible.
        </ConfirmationModal>
    </div>
  );
};

export default App;