import GPT3Tokenizer from 'gpt3-tokenizer';
import {
    ChatCompletionRequestMessage,
} from "openai";

import {ChatModelName, ChatModelNames} from "../../types";

let encodeUsageCount = 0;
let encoder = new GPT3Tokenizer({
    type: 'gpt3',
});

export const numTokensFromMessages = (messages: ChatCompletionRequestMessage[], model: ChatModelName = 'gpt-3.5-turbo-0301'): number => {
    if (ChatModelNames.includes(model)) {
        let numTokens = 0;
        for (const message of messages) {
            numTokens += numTokensFromMessage(message, model);
        }
        numTokens += 3; // Every reply is primed with <im_start>assistant<im_sep>
        return numTokens;
    } else {
        throw new Error(`numTokensFromMessages() is not presently implemented for model ${model}. See https://github.com/openai/openai-python/blob/main/chatml.md for information on how messages are converted to tokens.`);
    }
};


export const numTokensFromMessage = (message: ChatCompletionRequestMessage, model: ChatModelName): number => {
    let tokensPerMessage = 0;
    let tokensPerName = 0;

    if (model.startsWith('gpt-3.5')) {
        tokensPerMessage = 4; // Every message follows <im_start>{role/name}\n{content}<im_end>\n
        tokensPerName = -1; // If there's a name, the role is omitted
    } else if (model.startsWith('gpt-4')) {
        tokensPerMessage = 3;
        tokensPerName = 1;
    } else {
        throw new Error(`numTokensFromMessage() is not implemented for model ${model}. See https://github.com/openai/openai-python/blob/main/chatml.md for information on how messages are converted to tokens.`);
    }

    let numTokens = tokensPerMessage;

    for (const [key, value] of Object.entries(message)) {
        if (key === 'name') {
            numTokens += encodeLength(value) + tokensPerName;
        } else {
            numTokens += encodeLength(value);
        }
    }

    return numTokens;
};

export const encodeLength = (input: string): number => {
    encodeUsageCount++;
    if (encodeUsageCount > 1000) {
        encodeUsageCount = 0;
        encoder = new GPT3Tokenizer({
            type: 'gpt3',
        });
    }

    try {
        return encoder.encode(input).bpe.length;
    } catch (e) {
        return Math.floor((input || '').split(' ').length * 2.30);
    }
}
