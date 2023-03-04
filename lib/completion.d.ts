import { CompletionParams, CustomCompletionError } from "./types";
import { CreateCompletionResponse, OpenAIApi } from "openai";
export declare function getCompletionAdvanced(openai: OpenAIApi, prompt: string, options: Partial<CompletionParams> | undefined, onProgress: (result: CreateCompletionResponse) => void, onError: (error: CustomCompletionError) => void): Promise<void>;
export declare function getCompletionSimple(openai: OpenAIApi, prompt: string, options?: Partial<CompletionParams>, onProgress?: (result: string, finished: boolean) => void): Promise<string>;
