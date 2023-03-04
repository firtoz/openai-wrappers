"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getChatCompletionSimple = exports.getChatCompletionAdvanced = void 0;
const types_1 = require("./types");
const defaultChatCompletionOptions = {
    model: "gpt-3.5-turbo",
    temperature: 0.7,
    top_p: 0.9,
    frequency_penalty: 0,
    presence_penalty: 0,
    stream: false,
};
async function getChatCompletionAdvanced(openai, messages, options = {}, onProgress, onError) {
    const actualOptions = {
        ...defaultChatCompletionOptions,
        ...options,
        messages,
    };
    let numRetries = 0;
    const maxRetries = 3;
    while (true) {
        let response;
        try {
            response = await openai.createChatCompletion(actualOptions, {
                responseType: actualOptions.stream ? 'stream' : 'json',
            });
        }
        catch (e) {
            if (e.isAxiosError) {
                response = e.response;
            }
            else {
                onError({
                    type: types_1.CompletionErrorType.Unknown,
                    message: e.message,
                });
                return;
            }
        }
        if (!response) {
            onError({
                type: types_1.CompletionErrorType.NoResponse,
                message: 'Could not get a response from OpenAI :( Perhaps their servers are down?',
            });
            return;
        }
        const responseData = response.data;
        if (response.status !== 200) {
            const data = responseData;
            if (data.error?.type === 'insufficient_quota') {
                onError({
                    type: types_1.CompletionErrorType.OutOfTokens,
                    message: 'Whoops, ran out of tokens :( Contact your OpenAI account holder please.',
                });
                return;
            }
            else if (data.error?.message) {
            }
            if (numRetries < maxRetries) {
                numRetries++;
                continue;
            }
            const errorData = { ...responseData };
            delete errorData['client'];
            delete errorData['req'];
            delete errorData['socket'];
            console.error('resp error', errorData);
            onError({
                type: types_1.CompletionErrorType.Unknown,
                message: `Bad response ${response.status}!`,
            });
            return;
        }
        if (!actualOptions.stream) {
            const completionResponse = responseData;
            onProgress({
                created: completionResponse.created,
                model: completionResponse.model,
                object: completionResponse.object,
                id: completionResponse.id,
                choices: completionResponse.choices.map(item => {
                    const choice = {
                        delta: {
                            role: item.message?.role,
                            content: item.message?.content,
                        },
                        index: item.index,
                        finish_reason: item.finish_reason ? item.finish_reason : null,
                    };
                    return choice;
                }),
                usage: completionResponse.usage,
            });
            return;
        }
        const streamResponse = responseData;
        let buffer = '';
        streamResponse.on('data', (data) => {
            buffer += data.toString();
            while (true) {
                let lineIndex = buffer.indexOf('\n');
                if (lineIndex === -1) {
                    break;
                }
                const line = buffer.slice(0, lineIndex);
                buffer = buffer.slice(lineIndex + 1);
                if (line.trim().length === 0) {
                    continue;
                }
                const message = line.replace(/^data: /, '');
                if (message === '[DONE]') {
                    // resolve();
                    continue;
                }
                try {
                    const parsed = JSON.parse(message);
                    if (onProgress) {
                        onProgress(parsed);
                    }
                }
                catch (error) {
                    console.error('Could not JSON parse stream message', message, error);
                    onError({
                        type: types_1.CompletionErrorType.Unknown,
                        message: 'Cannot parse response.',
                    });
                }
            }
        });
        streamResponse.on('error', async () => {
            console.log('STREAM error');
        });
        await new Promise((resolve) => {
            streamResponse.on('end', async () => {
                resolve();
            });
            return;
        });
        return;
    }
}
exports.getChatCompletionAdvanced = getChatCompletionAdvanced;
async function getChatCompletionSimple(openai, messages, options = {}) {
    return await new Promise(async (resolve, reject) => {
        await getChatCompletionAdvanced(openai, messages, options, result => {
            const content = result.choices[0].delta.content;
            if (content) {
                resolve(content);
            }
            else {
                const error = {
                    type: types_1.CompletionErrorType.NoResponse,
                    message: 'No response.',
                };
                reject(error);
            }
        }, error => {
            reject(error);
        });
    });
}
exports.getChatCompletionSimple = getChatCompletionSimple;
//# sourceMappingURL=chatCompletion.js.map