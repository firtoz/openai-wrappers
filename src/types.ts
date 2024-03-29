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

export type TextCompletionModelName = 'text-davinci-003';

export const FunctionModelName = {
    'gpt-3.5-turbo-0613': 'gpt-3.5-turbo-0613',
    'gpt-3.5-turbo-16k-0613': 'gpt-3.5-turbo-16k-0613',
    'gpt-4-0613': 'gpt-4-0613',
    'gpt-4-32k-0613': 'gpt-4-32k-0613',
} as const;

export type FunctionModelName = typeof FunctionModelName[keyof typeof FunctionModelName];

export const FunctionModelNames = Object.values(FunctionModelName) as FunctionModelName[];

export const ChatModelName = {
    ...FunctionModelName,
    'gpt-3.5-turbo': 'gpt-3.5-turbo',
    'gpt-3.5-turbo-0301': 'gpt-3.5-turbo-0301',
    'gpt-3.5-turbo-16k': 'gpt-3.5-turbo-16k',
    'gpt-4': 'gpt-4',
    'gpt-4-32k': 'gpt-4-32k',
} as const;

export const SixteenthKModelName = {
    'gpt-3.5-turbo-16k': 'gpt-3.5-turbo-16k',
    'gpt-3.5-turbo-16k-0613': 'gpt-3.5-turbo-16k-0613',
} as const;

export type SixteenthKModelName = typeof SixteenthKModelName[keyof typeof SixteenthKModelName];

export const SixteenthKModelNames = Object.values(SixteenthKModelName) as SixteenthKModelName[];

export type ChatModelName = typeof ChatModelName[keyof typeof ChatModelName];

export const ChatModelNames = Object.values(ChatModelName) as ChatModelName[];

export type CompletionParams = Omit<CreateCompletionRequest, 'prompt' | 'model'> & {
    model: TextCompletionModelName,
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
