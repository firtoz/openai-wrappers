// noinspection JSUnusedGlobalSymbols

import {
    encodeChat,
} from 'gpt-tokenizer'

import {
    encode as encode35,
} from 'gpt-tokenizer/esm/model/gpt-3.5-turbo';

import {
    encode as encode4,
} from 'gpt-tokenizer/esm/model/gpt-4';

import {
    ChatCompletionRequestMessage,
} from "openai";

import {ChatModelName, ChatModelNames} from "../../types";
import {ChatMessage} from "gpt-tokenizer/src/GptEncoding";
import {ModelName} from "gpt-tokenizer/src/mapping";

function simplifyModel(model: string): ModelName {
    return model.startsWith('gpt-4') ? 'gpt-4' : 'gpt-3.5-turbo';
}

export const numTokensFromMessages = (messages: readonly ChatCompletionRequestMessage[], model: ChatModelName = 'gpt-3.5-turbo-0301'): number => {
    if (ChatModelNames.includes(model)) {
        return encodeChat(messages as ChatMessage[], simplifyModel(model)).length;
    } else {
        throw new Error(`numTokensFromMessages() is not presently implemented for model ${model}. See https://github.com/openai/openai-python/blob/main/chatml.md for information on how messages are converted to tokens.`);
    }
};


export const numTokensFromMessage = (message: ChatCompletionRequestMessage, model: ChatModelName): number => {
    return encodeChat([message as ChatMessage], simplifyModel(model)).length;
};

export const encodeLength = (input: string, model: ChatModelName = 'gpt-3.5-turbo'): number => {
    try {
        if(model.startsWith('gpt-4')) {
            return encode4(input).length;
        } else {
            return encode35(input).length;
        }
    } catch (e) {
        return Math.floor((input || '').split(' ').length * 2.30);
    }
}
