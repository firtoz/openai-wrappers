import {CompletionError, CompletionErrorType, CompletionParams, CustomCompletionError} from "./types";
import {CreateCompletionResponse, OpenAIApi} from "openai";
import {AxiosResponse} from "axios/index";
import {Stream} from "stream";

const defaultOptions: CompletionParams = {
    model: "text-davinci-003",
    temperature: 0.7,
    max_tokens: 512,
    top_p: 0.9,
    frequency_penalty: 0,
    presence_penalty: 0,
    stream: false,
};

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
