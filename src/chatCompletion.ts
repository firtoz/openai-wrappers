import {
    ChatCompletionRequestMessage,
    CreateChatCompletionRequest,
    CreateChatCompletionResponse,
    OpenAIApi
} from "openai";
import {
    ChatCompletionOptions,
    ChatStreamDelta, ChatStreamDeltaChoice,
    CompletionError,
    CompletionErrorType,
    CustomCompletionError
} from "./types";
import {AxiosResponse} from "axios";
import {Stream} from "stream";
import {IncomingMessage} from "http";
import {sign} from "crypto";

const defaultChatCompletionOptions: ChatCompletionOptions = {
    model: "gpt-3.5-turbo",
    temperature: 0.7,
    top_p: 0.9,
    frequency_penalty: 0,
    presence_penalty: 0,
    stream: false,
};

export interface ChatCompletionAdvancedParams {
    openai: OpenAIApi;
    messages: ChatCompletionRequestMessage[];
    options: Partial<ChatCompletionOptions>;
    onProgress: (result: ChatStreamDelta) => void;
    onError: (error: CustomCompletionError) => void;
    signal?: AbortSignal;
}

export async function getChatCompletionAdvanced(
    {
        openai,
        messages,
        options = {},
        onProgress,
        onError: handleOnError,
        signal,
    }: ChatCompletionAdvancedParams,
): Promise<void> {
    const actualOptions: CreateChatCompletionRequest = {
        ...defaultChatCompletionOptions,
        ...options,
        messages,
    };

    let numRetries = 0;
    const maxRetries = 3;

    let errorHandled = false;
    const onError = (error: CustomCompletionError): void => {
        if (errorHandled) {
            return;
        }

        errorHandled = true;

        handleOnError(error);
    }

    while (true) {
        if (signal?.aborted) {
            onError({
                type: CompletionErrorType.Aborted,
                message: 'Aborted',
            });

            return;
        }

        let response: AxiosResponse<CreateChatCompletionResponse | Stream> | undefined;

        try {
            response = await openai.createChatCompletion(actualOptions, {
                responseType: actualOptions.stream ? 'stream' : 'json',
                signal,
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

        if (signal?.aborted) {
            onError({
                type: CompletionErrorType.Aborted,
                message: 'Aborted',
            });

            return;
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
                // ignore
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

        const streamResponse = responseData as IncomingMessage;
        if (signal) {
            if (signal.aborted) {
                streamResponse.socket.end();
            } else {
                signal.addEventListener('abort', () => {
                    streamResponse.socket.end();
                });
            }
        }

        let buffer = '';

        const handleOnData = (data: any) => {
            if (signal?.aborted) {
                streamResponse.off('data', handleOnData);

                onError({
                    type: CompletionErrorType.Aborted,
                    message: 'Stream aborted',
                });

                return;
            }

            if (errorHandled) {
                streamResponse.off('data', handleOnData);

                return;
            }

            buffer += data.toString();

            while (true) {
                const lineIndex = buffer.indexOf('\n');
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

                    streamResponse.off('data', handleOnData);
                }
            }
        };

        streamResponse.on('data', handleOnData);

        await new Promise<void>((resolve) => {
            const handleOnError = async (err: Error) => {
                streamResponse.off('data', handleOnData);

                if (signal?.aborted) {
                    onError({
                        type: CompletionErrorType.Aborted,
                        message: 'Stream aborted',
                    });

                    resolve();

                    return;
                }

                console.log('STREAM error', err);

                onError({
                    type: CompletionErrorType.Unknown,
                    message: 'Stream just had an error.',
                });

                resolve();
            };

            streamResponse.once('error', handleOnError);

            const handleOnEnd = async () => {
                resolve();
            };

            streamResponse.once('end', handleOnEnd);
        });

        return;
    }
}

export interface ChatCompletionSimpleParams {
    openai: OpenAIApi;
    messages: ChatCompletionRequestMessage[];
    options?: Exclude<Partial<ChatCompletionOptions>, "stream">;
    signal?: AbortSignal;
}

export async function getChatCompletionSimple(
    {
        openai,
        messages,
        options = {},
        signal,
    }: ChatCompletionSimpleParams,
): Promise<string> {
    return await new Promise<string>(async (resolve, reject) => {
        try {
            await getChatCompletionAdvanced(
                {
                    openai: openai, messages: messages, options: options, onProgress: result => {
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
                    }, onError: error => {
                        reject(error);
                    },
                    signal,
                }
            );
        } catch (e) {
            console.error(e);
            const error: CustomCompletionError = {
                message: "Unhandled error",
                type: CompletionErrorType.Unknown,
            };
            reject(error);
        }
    })
}
