import {CreateChatCompletionRequest, CreateCompletionRequest} from "openai";
import {ChatCompletionResponseMessageRoleEnum, CreateCompletionResponseUsage} from "openai/api";

export type CompletionError = {
    error?: {
        message: string;
        type: string;
        param: string | null;
        code: string | null;
    }
};

export type ModelName = 'text-davinci-003'
export type ChatModelName = 'gpt-3.5-turbo'

export type CompletionParams = Omit<CreateCompletionRequest, 'prompt' | 'model'> & {
    model: ModelName,
};

export enum CompletionErrorType {
    Unknown,
    NoOpenai,
    NoResponse,
    OutOfTokens,
}

export type CustomCompletionError = {
    type: CompletionErrorType;
    message: string;
}

export interface ChatCompletionOptions extends Omit<CreateChatCompletionRequest, 'messages' | 'model'> {
    model: ChatModelName,
}

export type ChatStreamDeltaChoice = {
    delta: {
        role?: ChatCompletionResponseMessageRoleEnum;
        content?: string;
    },
    index: number | undefined;
    finish_reason: null | 'stop' | 'length';
};

export type ChatStreamDelta = {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: ChatStreamDeltaChoice[];
    usage?: CreateCompletionResponseUsage;
};
