import {CreateChatCompletionRequest, CreateCompletionRequest} from "openai";
import {
    ChatCompletionResponseMessage,
    ChatCompletionResponseMessageRoleEnum,
    CreateCompletionResponseUsage,
} from "openai/api";

export type CompletionError = {
    error?: {
        message: string;
        type: string;
        param: string | null;
        code: string | null;
    }
};

export type ModelName = 'text-davinci-003'

export const ChatModelNames = [
    'gpt-3.5-turbo',
    'gpt-3.5-turbo-0301',
    'gpt-3.5-turbo-0613',
    'gpt-3.5-turbo-16k',
    'gpt-3.5-turbo-16k-0613',
    'gpt-4',
    'gpt-4-0613',
    'gpt-4-32k',
    'gpt-4-32k-0613',
] as const;

export type ChatModelName = typeof ChatModelNames[number];

export const FunctionModelNames = [
    'gpt-3.5-turbo-0613',
    'gpt-3.5-turbo-16k-0613',
    'gpt-4-0613',
    'gpt-4-32k-0613',
] as const;

export type FunctionModelName = typeof FunctionModelNames[number];

export type CompletionParams = Omit<CreateCompletionRequest, 'prompt' | 'model'> & {
    model: ModelName,
};

export enum CompletionErrorType {
    Unknown,
    NoResponse,
    OutOfTokens,
    Aborted,
}

export type CustomCompletionError = {
    type: CompletionErrorType;
    message: string;
    error?: Error;
}

export interface ChatCompletionOptions extends Omit<CreateChatCompletionRequest, 'messages' | 'model'> {
    model: ChatModelName,
}

export type ChatStreamDeltaChoice = {
    delta: Omit<ChatCompletionResponseMessage, 'role'> & {
        role?: ChatCompletionResponseMessageRoleEnum;
    },
    index: number | undefined;
    finish_reason: null | 'stop' | 'length' | 'function_call';
};

export type ChatStreamDelta = {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: ChatStreamDeltaChoice[];
    usage?: CreateCompletionResponseUsage;
};
