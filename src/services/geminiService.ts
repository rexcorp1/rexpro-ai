/// <reference types="vite/client" />

import { GoogleGenAI, GenerateContentParameters, Tool, GenerateContentResponse, Content } from "@google/genai";
import { Model, ChatMessage, Attachment } from '../types';

const API_KEY = import.meta.env.VITE_API_KEY;

if (!API_KEY) {
  // FIX: Updated error message to comply with coding guidelines.
  // The application should not instruct the user on how to set the API key.
  throw new Error("API_KEY environment variable not set.");
}

const ai = new GoogleGenAI({ apiKey: API_KEY });
const DEFAULT_SYSTEM_INSTRUCTION = "You are a helpful assistant.";

interface GenerateOptions {
  systemInstruction: string;
  config: {
    temperature?: number;
    topP?: number;
    maxOutputTokens?: number;
    stopSequences?: string[];
    responseMimeType?: "application/json";
    responseSchema?: any;
    tools?: Tool[];
    responseModalities?: ('IMAGE' | 'TEXT')[];
    thinkingConfig?: { thinkingBudget: number };
  };
}

interface ImageConfig {
    numberOfImages: number;
    negativePrompt?: string;
    seed?: number;
    aspectRatio: string;
    personGeneration: string;
}

const dataUrlToBase64 = (dataUrl: string): string => {
    return dataUrl.substring(dataUrl.indexOf(',') + 1);
};

const buildContents = (messages: ChatMessage[]): Content[] => {
    return messages.map(msg => {
        const parts = [];

        if (msg.content.trim()) {
            parts.push({ text: msg.content });
        }

        if (msg.attachments) {
            msg.attachments.forEach(file => {
                parts.push({
                    inlineData: {
                        mimeType: file.mimeType,
                        data: dataUrlToBase64(file.dataUrl)
                    }
                });
            });
        }
        
        return {
            role: msg.role,
            parts: parts,
        };
    });
};

export async function countTokens(messages: ChatMessage[], modelName: Model): Promise<number> {
  try {
    if (messages.length === 0) {
      return 0;
    }
    const contents = buildContents(messages);

    const response = await ai.models.countTokens({
      model: modelName,
      contents: contents,
    });

    return response.totalTokens ?? 0;
  } catch (error) {
    console.error("Error counting tokens:", error);
    // Propagate error to be handled by the caller
    throw error;
  }
}

export async function generateImage(
  prompt: string,
  modelName: Model.IMAGEN_4_0_GENERATE_001 | Model.IMAGEN_4_0_ULTRA_GENERATE_001 | Model.IMAGEN_4_0_FAST_GENERATE_001 | Model.IMAGEN_3_0_GENERATE_002,
  config: ImageConfig,
  signal: AbortSignal
): Promise<GenerateContentResponse> {
    try {
        if (signal.aborted) {
            throw new DOMException('Aborted by user', 'AbortError');
        }

        const requestConfig: any = {
            numberOfImages: config.numberOfImages,
            negativePrompt: config.negativePrompt || undefined,
            seed: config.seed,
            aspectRatio: config.aspectRatio,
            personGeneration: config.personGeneration,
            outputMimeType: 'image/png',
        };

        Object.keys(requestConfig).forEach(key => requestConfig[key] === undefined && delete requestConfig[key]);

        const response = await ai.models.generateImages({
            model: modelName,
            prompt: prompt,
            config: requestConfig,
        });

        if (signal.aborted) {
            throw new DOMException('Aborted by user', 'AbortError');
        }
        
        const imageParts = (response.generatedImages || []).map(img => ({
            inlineData: {
                mimeType: 'image/png',
                data: img.image?.imageBytes || '',
            },
        }));

        return {
            text: '', // No text from this API
            candidates: [{
                content: {
                    role: 'model',
                    parts: imageParts
                },
            }]
        } as unknown as GenerateContentResponse;

    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('Image generation aborted.');
          throw error;
        }
        console.error("Error generating image:", error);
        throw new Error("Failed to get image from Gemini API.");
    }
}


export async function generateVideo(
  prompt: string,
  attachments: Attachment[],
  modelName: Model.VEO_2_0_GENERATE_001,
  signal: AbortSignal
): Promise<GenerateContentResponse> {
    try {
        if (signal.aborted) throw new DOMException('Aborted by user', 'AbortError');

        const request: any = {
            model: modelName,
            prompt: prompt,
            config: { numberOfVideos: 1 }
        };

        const imageAttachment = attachments.find(att => att.mimeType.startsWith('image/'));
        if (imageAttachment) {
            request.image = {
                imageBytes: dataUrlToBase64(imageAttachment.dataUrl),
                mimeType: imageAttachment.mimeType,
            };
        }

        let operation = await ai.models.generateVideos(request);

        while (!operation.done) {
            if (signal.aborted) {
                 // Note: We can't cancel the remote operation, but we can stop waiting for it.
                 throw new DOMException('Aborted by user', 'AbortError');
            }
            await new Promise(resolve => setTimeout(resolve, 10000)); // Poll every 10 seconds
            operation = await ai.operations.getVideosOperation({ operation: operation });
        }

        if (signal.aborted) throw new DOMException('Aborted by user', 'AbortError');
        
        const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;

        if (!downloadLink) {
            throw new Error("Video generation succeeded, but no download link was provided.");
        }

        const videoResponse = await fetch(`${downloadLink}&key=${API_KEY}`);
        if (!videoResponse.ok) {
            throw new Error(`Failed to download the video: ${videoResponse.statusText}`);
        }

        const videoBlob = await videoResponse.blob();
        
        const videoDataUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(videoBlob);
        });
        
        const base64Data = dataUrlToBase64(videoDataUrl);

        const videoPart = {
            inlineData: {
                mimeType: 'video/mp4',
                data: base64Data,
            },
        };

        return {
            text: 'Your video has been generated.',
            candidates: [{
                content: {
                    role: 'model',
                    parts: [videoPart]
                },
            }]
        } as unknown as GenerateContentResponse;

    } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('Video generation aborted.');
        } else {
          console.error("Error generating video:", error);
        }
        throw error;
    }
}

export async function transcribeAudio(audioBase64: string, mimeType: string): Promise<string> {
    try {
        const audioPart = {
            inlineData: {
              mimeType,
              data: audioBase64,
            },
        };

        const textPart = {
            text: "Transcribe this audio recording precisely. Provide only the text from the audio, without any additional comments or summaries.",
        };
        
        const response = await ai.models.generateContent({
            model: Model.GEMINI_2_0_FLASH_LITE,
            contents: { parts: [audioPart, textPart] },
        });

        return response.text ?? '';

    } catch (error) {
        console.error('Error calling Gemini API for transcription:', error);
        throw new Error('Failed to transcribe audio via Gemini API.');
    }
}

export async function generateChatResponse(
  messages: ChatMessage[], 
  modelName: Model, 
  options: GenerateOptions, 
  onChunk: (chunk: GenerateContentResponse) => void,
  signal: AbortSignal
): Promise<void> {
  try {
    const contents = buildContents(messages);
    const isGemmaModel = modelName.startsWith('gemma');
    const isImageEditModel = [Model.GEMINI_2_0_FLASH_PREVIEW_IMAGE_GENERATION, Model.GEMINI_2_5_FLASH_IMAGE_PREVIEW].includes(modelName as Model);

    const params: GenerateContentParameters = {
        model: modelName,
        contents: contents,
        config: {
            ...options.config,
        },
    };
    
    if (isImageEditModel && params.config) {
      params.config.responseModalities = ['IMAGE', 'TEXT'];
    }

    // Gemma and Image Edit models do not support system instructions.
    if (!isGemmaModel && !isImageEditModel) {
        const finalSystemInstruction = (options.systemInstruction && options.systemInstruction.trim() !== '')
            ? options.systemInstruction
            : DEFAULT_SYSTEM_INSTRUCTION;
        if (params.config) {
            params.config.systemInstruction = finalSystemInstruction;
        }
    }

    // Clean up undefined properties to avoid sending them in the API call
    const config = params.config;
    if (config) {
        (Object.keys(config) as Array<keyof typeof config>).forEach(key => {
            if (config[key] === undefined) {
                delete config[key];
            }
        });
        if (config.tools && config.tools.length === 0) {
            delete config.tools;
        }
        // Tambahkan cek untuk stopSequences agar tidak mengirim array kosong
        if (Array.isArray(config.stopSequences) && config.stopSequences.length === 0) {
            delete config.stopSequences;
        }
    }
    
    // Image Editing models use the non-streaming generateContent API
    if (isImageEditModel) {
        if (signal.aborted) {
            throw new DOMException('Aborted by user', 'AbortError');
        }
        const response = await ai.models.generateContent(params);
        onChunk(response);
        return;
    }

    // Default to streaming for all other models
    const response = await ai.models.generateContentStream(params);
    const iterator = response[Symbol.asyncIterator]();

    while (true) {
        if (signal.aborted) {
            if (typeof iterator.return === 'function') {
                await iterator.return(undefined);
            }
            throw new DOMException('Aborted by user', 'AbortError');
        }

        const { value, done } = await iterator.next();
        
        if (done) {
            break;
        }
        
        onChunk(value);
    }

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.log('Stream generation aborted.');
      throw error; // Propagate the abort error
    }
    console.error("Error streaming chat response:", error);
    throw new Error("Failed to get streaming response from Gemini API.");
  }
}