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
import {AxiosRequestConfig, AxiosResponse, isAxiosError} from "axios";
import {Stream} from "stream";
import fetchAdapter from "./utils/fetchAdapter";
import {IncomingMessageWithOptionalSocket} from "./incomingMessageWithOptionalSocket";
import {CreateChatCompletionResponseChoicesInner} from "openai/dist/api";

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
    axiosConfig?: Omit<AxiosRequestConfig, 'signal' | 'responseType'>;
}

export async function getChatCompletionAdvanced(
    {
        openai,
        messages,
        options = {},
        onProgress,
        onError: handleOnError,
        signal,
        axiosConfig = {},
    }: ChatCompletionAdvancedParams,
): Promise<void> {
    const actualOptions: CreateChatCompletionRequest = {
        ...defaultChatCompletionOptions,
        ...options,
        messages,
    };

    const completionState = {
        numRetries: 0,
        errorHandled: false,
    };

    const maxRetries = 3;

    const onError = (error: CustomCompletionError): void => {
        if (completionState.errorHandled) {
            return;
        }

        completionState.errorHandled = true;

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
            const actualAxiosConfig: AxiosRequestConfig = {
                responseType: actualOptions.stream ? 'stream' : 'json',
                signal,
                ...axiosConfig,
            };

            if (actualAxiosConfig.adapter === undefined) {
                // if we're in a browser, we need to use the fetch adapter
                if (typeof window !== 'undefined') {
                    actualAxiosConfig.adapter = fetchAdapter;
                }
            }

            response = await openai.createChatCompletion(actualOptions, actualAxiosConfig);
        } catch (e: unknown) {
            if (isAxiosError<CreateChatCompletionResponse | Stream>(e)) {
                response = e.response;
            } else {
                onError({
                    type: CompletionErrorType.Unknown,
                    message: (e as Error).message,
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

            if (completionState.numRetries < maxRetries) {
                completionState.numRetries++;
                continue;
            }

            const errorData = {...responseData} as never;

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
                choices: completionResponse.choices.map((item: CreateChatCompletionResponseChoicesInner) => {
                    const message = item.message;
                    const finishReason = item.finish_reason;
                    const choice: ChatStreamDeltaChoice = {
                        delta: {
                            role: message?.role,
                            content: message?.content,
                            function_call: message?.function_call,
                        },
                        index: item.index,
                        finish_reason: finishReason ? finishReason as ChatStreamDeltaChoice['finish_reason'] : null,
                    };

                    return choice;
                }),
                usage: completionResponse.usage,
            });

            return;
        }

        const streamResponse = responseData as IncomingMessageWithOptionalSocket;
        if (signal) {
            if (signal.aborted) {
                streamResponse.socket?.end();
            } else {
                signal.addEventListener('abort', () => {
                    streamResponse.socket?.end();
                });
            }
        }

        const streamState = {
            buffer: '',
            shouldRetry: false,
        };

        await new Promise<void>((resolve) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const handleOnData = (data: any) => {
                if (signal?.aborted) {
                    streamResponse.off('data', handleOnData);

                    onError({
                        type: CompletionErrorType.Aborted,
                        message: 'Stream aborted',
                    });

                    return;
                }

                if (completionState.errorHandled) {
                    streamResponse.off('data', handleOnData);

                    return;
                }

                streamState.buffer += data.toString();

                while (true) {
                    const lineIndex = streamState.buffer.indexOf('\n');
                    if (lineIndex === -1) {
                        // no more lines
                        break;
                    }

                    const line = streamState.buffer.slice(0, lineIndex);
                    streamState.buffer = streamState.buffer.slice(lineIndex + 1);

                    if (line.trim().length === 0) {
                        continue;
                    }

                    const message = line.replace(/^data: /, '');
                    if (message === '[DONE]') {
                        // resolve();
                        continue;
                    }

                    try {
                        const parsed = JSON.parse(message) as (ChatStreamDelta | CompletionError);

                        if ((parsed as CompletionError).error) {
                            streamResponse.off('data', handleOnData);

                            if (completionState.numRetries < maxRetries) {
                                completionState.numRetries++;
                                streamState.shouldRetry = true;
                                resolve();
                                return;
                            }

                            onError({
                                type: CompletionErrorType.Unknown,
                                message: `Error: ${JSON.stringify((parsed as CompletionError).error)}`,
                            });

                            return;
                        }

                        onProgress(parsed as ChatStreamDelta);
                    } catch (error) {
                        streamResponse.off('data', handleOnData);

                        console.error('Could not JSON parse stream message', message, error);

                        if (completionState.numRetries < maxRetries) {
                            completionState.numRetries++;
                            streamState.shouldRetry = true;
                            resolve();
                            return;
                        }

                        onError({
                            type: CompletionErrorType.Unknown,
                            message: 'Cannot parse response.',
                        });
                    }
                }
            };

            streamResponse.on('data', handleOnData);

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

                if (completionState.numRetries < maxRetries) {
                    completionState.numRetries++;
                    streamState.shouldRetry = true;
                    resolve();

                    return;
                }

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

        if (streamState.shouldRetry) {
            continue;
        }

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
