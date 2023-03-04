import {AxiosResponse} from "axios";
import {
    ChatCompletionRequestMessage,
    CreateChatCompletionRequest,
    CreateChatCompletionResponse,
    CreateCompletionRequest,
    CreateCompletionResponse,
    OpenAIApi,
} from "openai";

export type CompletionError = {
    error?: {
        message: string;
        type: string;
        param: string | null;
        code: string | null;
    }
};


import {ChatCompletionResponseMessageRoleEnum, CreateCompletionResponseUsage} from "openai/api";
import {Stream} from "stream";

export type ModelName = 'text-davinci-003'
export type ChatModelName = 'gpt-3.5-turbo'

type CompletionParams = Omit<CreateCompletionRequest, 'prompt' | 'model'> & {
    model: ModelName,
};

const defaultOptions: CompletionParams = {
    model: "text-davinci-003",
    temperature: 0.7,
    max_tokens: 512,
    top_p: 0.9,
    frequency_penalty: 0,
    presence_penalty: 0,
    stream: false,
};

enum CompletionErrorType {
    Unknown,
    NoOpenai,
    NoResponse,
    OutOfTokens,
}

type CustomCompletionError = {
    type: CompletionErrorType;
    message: string;
}


interface ChatCompletionOptions extends Omit<CreateChatCompletionRequest, 'messages' | 'model'> {
    model: ChatModelName,
}

const defaultChatCompletionOptions: ChatCompletionOptions = {
    model: "gpt-3.5-turbo",
    temperature: 0.7,
    top_p: 0.9,
    frequency_penalty: 0,
    presence_penalty: 0,
    stream: false,
};


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

export async function getChatCompletionSimple(
    openai: OpenAIApi,
    messages: ChatCompletionRequestMessage[],
    options: Exclude<Partial<ChatCompletionOptions>, 'stream'> = {},
): Promise<string> {
    return await new Promise<string>(async (resolve, reject) => {
        await getChatCompletion(openai, messages, options, result => {
            const content = result.choices[0].delta.content;
            if (content) {
                resolve(content);
            } else {
                const error: CustomCompletionError = {
                    type: CompletionErrorType.NoResponse,
                    message: 'No response.',
                };

                reject(error);
            }
        }, error => {
            reject(error);
        });
    })
}

export async function getChatCompletion(
    openai: OpenAIApi,
    messages: ChatCompletionRequestMessage[],
    options: Partial<ChatCompletionOptions> = {},
    onProgress: (result: ChatStreamDelta) => void,
    onError: (error: CustomCompletionError) => void,
): Promise<void> {
    const actualOptions: CreateChatCompletionRequest = {
        ...defaultChatCompletionOptions,
        ...options,
        messages,
    };

    let numRetries = 0;
    const maxRetries = 3;

    while (true) {
        let response: AxiosResponse<CreateChatCompletionResponse | Stream> | undefined;

        try {
            response = await openai.createChatCompletion(actualOptions, {
                responseType: actualOptions.stream ? 'stream' : 'json',
            }) as any;
        } catch (e: any) {
            if (e.isAxiosError) {
                response = e.response;
            } else {
                onError({
                    type: CompletionErrorType.Unknown,
                    message: e.message,
                });
                return;
            }
        }

        if (!response) {
            onError({
                type: CompletionErrorType.NoResponse,
                message: 'Could not get a response from OpenAI :( Perhaps their servers are down?',
            });

            return;
        }

        const responseData = response.data;
        if (response.status !== 200) {
            const data = responseData as unknown as CompletionError;

            if (data.error?.type === 'insufficient_quota') {
                onError({
                    type: CompletionErrorType.OutOfTokens,
                    message: 'Whoops, ran out of tokens :( Contact your OpenAI account holder please.',
                });
                return;
            } else if (data.error?.message) {
            }

            if (numRetries < maxRetries) {
                numRetries++;
                continue;
            }

            const errorData = {...responseData} as any;

            delete errorData['client'];
            delete errorData['req'];
            delete errorData['socket'];

            console.error('resp error', errorData);

            onError({
                type: CompletionErrorType.Unknown,
                message: `Bad response ${response.status}!`,
            });

            return;
        }

        if (!actualOptions.stream) {
            const completionResponse = responseData as CreateChatCompletionResponse;
            onProgress({
                created: completionResponse.created,
                model: completionResponse.model,
                object: completionResponse.object,
                id: completionResponse.id,
                choices: completionResponse.choices.map(item => {
                    const choice: ChatStreamDeltaChoice = {
                        delta: {
                            role: item.message?.role,
                            content: item.message?.content,
                        },
                        index: item.index,
                        finish_reason: item.finish_reason ? item.finish_reason as any : null,
                    };

                    return choice;
                }),
                usage: completionResponse.usage,
            });
            return;
        }

        const streamResponse = responseData as Stream;

        let buffer = '';

        streamResponse.on('data', (data, a) => {
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
                    const parsed = JSON.parse(message) as ChatStreamDelta;

                    if (onProgress) {
                        onProgress(parsed);
                    }
                } catch (error) {
                    console.error('Could not JSON parse stream message', message, error);

                    onError({
                        type: CompletionErrorType.Unknown,
                        message: 'Cannot parse response.',
                    });
                }
            }
        });

        streamResponse.on('error', async () => {
            console.log('STREAM error');
        });

        await new Promise<void>((resolve) => {
            streamResponse.on('end', async () => {
                resolve();
            });

            return;
        });

        return;
    }
}


export async function getCompletionAdvanced(
    openai: OpenAIApi,
    prompt: string,
    options: Partial<CompletionParams> = {},
    onProgress: (result: CreateCompletionResponse) => void,
    onError: (error: CustomCompletionError) => void,
): Promise<void> {
    const actualOptions: CompletionParams = {
        ...defaultOptions,
        ...options,
    };

    let numRetries = 0;
    const maxRetries = 3;

    while (true) {
        let response: AxiosResponse<CreateCompletionResponse | Stream> | undefined;

        try {
            response = await openai.createCompletion({
                ...actualOptions,
                prompt,
            }, {
                responseType: actualOptions.stream ? 'stream' : 'json',
            }) as any;
        } catch (e: any) {
            if (e.isAxiosError) {
                response = e.response;
            } else {
                onError({
                    type: CompletionErrorType.Unknown,
                    message: e.message,
                });
                return;
            }
        }

        if (!response) {
            onError({
                type: CompletionErrorType.NoResponse,
                message: 'Could not get a response from OpenAI :( Perhaps their servers are down?',
            });

            return;
        }

        const responseData = response.data;
        if (response.status !== 200) {
            const data = responseData as unknown as CompletionError;

            if (data.error?.type === 'insufficient_quota') {
                onError({
                    type: CompletionErrorType.OutOfTokens,
                    message: 'Whoops, ran out of tokens :( Contact your OpenAI account holder please.',
                });
                return;
            } else if (data.error?.message) {
            }

            if (numRetries < maxRetries) {
                numRetries++;
                continue;
            }

            onError({
                type: CompletionErrorType.Unknown,
                message: 'Bad response!',
            });

            return;
        }

        if (!actualOptions.stream) {
            const completionResponse = responseData as CreateCompletionResponse;
            onProgress(completionResponse);
            return;
        }

        const streamResponse = responseData as Stream;

        await new Promise<void>((resolve) => {
            streamResponse.on('data', async (data) => {
                const lines = data
                    .toString()
                    .split('\n')
                    .filter((line: string) => line.trim() !== '');
                for (const line of lines) {
                    const message = line.replace(/^data: /, '');
                    if (message === '[DONE]') {
                        resolve();
                        return;
                    }

                    try {
                        const parsed = JSON.parse(message) as CreateCompletionResponse;

                        if (onProgress) {
                            onProgress(parsed);
                        }
                    } catch (error) {
                        console.error('Could not JSON parse stream message', message, error);

                        onError({
                            type: CompletionErrorType.Unknown,
                            message: 'Cannot parse response.',
                        });

                        resolve();
                    }
                }
            });

            return;
        });

        return;
    }
}


export async function getCompletionSimple(
    openai: OpenAIApi,
    prompt: string,
    options: Partial<CompletionParams> = {}, onProgress?: (result: string, finished: boolean) => void
): Promise<string> {
    const actualOptions: CompletionParams = {
        ...defaultOptions,
        ...options,
    };

    let latestResponseText = '';

    let numRetries = 0;
    const maxRetries = 3;

    while (true) {
        let response: AxiosResponse<CreateCompletionResponse | Stream> | undefined;

        try {
            const fullPrompt = prompt + latestResponseText;

            response = await openai.createCompletion({
                ...actualOptions,
                prompt: fullPrompt,
            }, {
                responseType: actualOptions.stream ? 'stream' : 'json',
            }) as any;
        } catch (e: any) {
            if (e.isAxiosError) {
                response = e.response;
            } else {
                return '';
            }
        }

        if (!response) {
            // onProgress('[[Could not get a response from OpenAI :( Perhaps their servers are down?]]', true)
            //     .catch(async e => logMessage(await this.getLinkableId(), e));
            return '';
        }

        const responseData = response.data;
        if (response.status !== 200) {
            const data = responseData as unknown as CompletionError;

            if (data.error?.type === 'insufficient_quota') {
                return '';
            } else if (data.error?.message) {
                if (data.error.message.includes('currently overloaded')) {
                    if (numRetries < maxRetries) {
                        numRetries++;
                        continue;
                    }
                }

                return '';
            } else {
                return '';
            }

            return '';
        }

        if (actualOptions.stream) {
            const streamResponse = responseData as Stream;

            await new Promise<void>(resolve => {
                streamResponse.on('data', async (data) => {
                    const lines = data.toString().split('\n').filter((line: string) => line.trim() !== '');
                    for (const line of lines) {
                        const message = line.replace(/^data: /, '');
                        if (message === '[DONE]') {
                            resolve();
                            // resolve(textResponse);
                            return; // Stream finished
                        }
                        try {
                            const parsed = JSON.parse(message) as CreateCompletionResponse;
                            if (parsed.choices && parsed.choices.length > 0) {
                                const partialResponse = parsed.choices[0].text;

                                latestResponseText += partialResponse;

                                if (onProgress) {
                                    onProgress(latestResponseText, false);
                                }
                            }
                        } catch (error) {
                            console.error('Could not JSON parse stream message', message, error);
                        }
                    }
                });

                return latestResponseText;
            });

            if (onProgress) {
                onProgress(latestResponseText, true);
            }

            return latestResponseText;
        } else {
            const completionResponse = responseData as CreateCompletionResponse;

            const choices = completionResponse.choices;
            if (choices.length !== 1) {
                return '';
            }

            const choice = choices[0];

            const text = choice.text;

            if (text == undefined) {
                return '';
            }

            latestResponseText += text;
            const stop = choice.finish_reason === 'stop';

            if (onProgress) {
                onProgress(latestResponseText, stop);
            }

            if (stop) {
                return latestResponseText;
            }
        }
    }
}
