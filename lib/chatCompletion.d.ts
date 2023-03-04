import { ChatCompletionRequestMessage, OpenAIApi } from "openai";
import { ChatCompletionOptions, ChatStreamDelta, CustomCompletionError } from "./types";
export declare function getChatCompletionSimple(openai: OpenAIApi, messages: ChatCompletionRequestMessage[], options?: Exclude<Partial<ChatCompletionOptions>, 'stream'>): Promise<string>;
export declare function getChatCompletion(openai: OpenAIApi, messages: ChatCompletionRequestMessage[], options: Partial<ChatCompletionOptions> | undefined, onProgress: (result: ChatStreamDelta) => void, onError: (error: CustomCompletionError) => void): Promise<void>;
