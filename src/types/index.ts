export enum Model {
  GEMINI_2_5_PRO = 'gemini-2.5-pro',
  GEMINI_2_5_FLASH = 'gemini-2.5-flash',
  GEMINI_2_5_FLASH_LITE = 'gemini-2.5-flash-lite',
  GEMINI_2_5_FLASH_IMAGE_PREVIEW = 'gemini-2.5-flash-image-preview',
  GEMINI_2_0_FLASH = 'gemini-2.0-flash',
  GEMINI_2_0_FLASH_PREVIEW_IMAGE_GENERATION = 'gemini-2.0-flash-preview-image-generation',
  GEMINI_2_0_FLASH_LITE = 'gemini-2.0-flash-lite',
  IMAGEN_4_0_GENERATE_001 = 'imagen-4.0-generate-001',
  IMAGEN_4_0_ULTRA_GENERATE_001 = 'imagen-4.0-ultra-generate-001',
  IMAGEN_4_0_FAST_GENERATE_001 = 'imagen-4.0-fast-generate-001',
  IMAGEN_3_0_GENERATE_002 = 'imagen-3.0-generate-002',
  VEO_3_0_GENERATE_PREVIEW = 'veo-3.0-generate-preview',
  VEO_3_0_FAST_GENERATE_PREVIEW = 'veo-3.0-fast-generate-preview',
  VEO_2_0_GENERATE_001 = 'veo-2.0-generate-001',
  GEMMA_3N_E2B = 'gemma-3n-e2b-it',
  GEMMA_3N_E4B = 'gemma-3n-e4b-it',
  GEMMA_3_1B = 'gemma-3-1b-it',
  GEMMA_3_4B = 'gemma-3-4b-it',
  GEMMA_3_12B = 'gemma-3-12b-it',
  GEMMA_3_27B = 'gemma-3-27b-it',
}

export enum Role {
  USER = 'user',
  MODEL = 'model',
}

export interface Attachment {
  name: string;
  mimeType: string;
  dataUrl: string;
}

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  attachments?: Attachment[];
  reasoning?: string;
  isThinking?: boolean;
  isParsingReasoning?: boolean;
  projectFilesUpdate?: boolean;
  project?: Project;
  groundingChunks?: any[];
}

export interface ChatSession {
  id: string;
  title: string;
  messages: ChatMessage[];
  project?: Project;
}

export enum MediaResolution {
    DEFAULT = 'default',
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
}

export enum TuningStatus {
  TRAINING = 'TRAINING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

export enum LiveConversationModel {
  GEMINI_LIVE_2_5_FLASH_PREVIEW = 'gemini-live-2.5-flash-preview',
  GEMINI_2_5_FLASH_NATIVE_AUDIO = 'gemini-2.5-flash-preview-native-audio-dialog',
  GEMINI_2_5_FLASH_EXP_NATIVE_AUDIO_THINKING = 'gemini-2.5-flash-exp-native-audio-thinking-dialog',
  GEMINI_2_0_FLASH_LIVE_001 = 'gemini-2.0-flash-live-001',
}

export interface TrainingFile {
  name: string;
  mimeType: string;
  dataUrl: string;
}

export interface TunedModel {
  id: string;
  displayName: string;
  baseModel: Model;
  systemInstruction: string;
  trainingFiles: TrainingFile[];
  sourceUrls?: string[];
  status: TuningStatus;
}


// Types for Code Interpreter
export type FileSystemNode = {
  name: string;
  content?: string;
  children?: { [key: string]: FileSystemNode };
};

export interface Project {
  id: string;
  name: string;
  description: string;
  files: { [key: string]: FileSystemNode };
}

export const initialFiles: { [key: string]: FileSystemNode } = {
  'index.html': {
    name: 'index.html',
    content: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI Project Preview</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100">
  <div class="p-8 flex flex-col items-center justify-center min-h-screen">
    <h1 class="text-3xl font-bold text-gray-800">Hello, World!</h1>
    <p class="mt-2 text-gray-600">Your AI-generated project will be displayed here.</p>
  </div>
</body>
</html>`
  },
};