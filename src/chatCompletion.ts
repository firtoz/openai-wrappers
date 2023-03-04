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

const defaultChatCompletionOptions: ChatCompletionOptions = {
    model: "gpt-3.5-turbo",
    temperature: 0.7,
    top_p: 0.9,
    frequency_penalty: 0,
    presence_penalty: 0,
    stream: false,
};

export async function getChatCompletionAdvanced(
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

export async function getChatCompletionSimple(
    openai: OpenAIApi,
    messages: ChatCompletionRequestMessage[],
    options: Exclude<Partial<ChatCompletionOptions>, 'stream'> = {},
): Promise<string> {
    return await new Promise<string>(async (resolve, reject) => {
        await getChatCompletionAdvanced(openai, messages, options, result => {
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
