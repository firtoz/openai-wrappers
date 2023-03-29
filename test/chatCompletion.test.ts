import {it, expect, describe, vi} from 'vitest';
import {Configuration, OpenAIApi} from "openai";
import {ChatStreamDelta, CompletionErrorType, CustomCompletionError, getChatCompletionAdvanced} from "../src";


const openai = new OpenAIApi(new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
}));

describe('getChatCompletionAdvanced', () => {
    it('should be cancellable before stream', async () => {
        let resultText = '';

        const abort = new AbortController();

        const progressReceived = vi.fn();
        const errorReceived = vi.fn();

        abort.abort();

        const promise = getChatCompletionAdvanced({
            openai,
            messages: [{
                role: 'user',
                content: 'write a short line on testing',
            }],
            onError: errorReceived,
            onProgress: progressReceived,
            options: {
                temperature: 0,
                model: 'gpt-3.5-turbo',
                stream: true,
            },
            signal: abort.signal,
        });

        await promise;

        expect(errorReceived).toBeCalled();
        expect(errorReceived.mock.calls).toHaveLength(1);
        expect(errorReceived.mock.lastCall).to.deep.eq([{
            message: 'Aborted',
            type: CompletionErrorType.Aborted,
        }]);

        expect(progressReceived).not.toBeCalled();
    }, 10000);

    it('should be cancellable mid-stream', async () => {
        let resultText = '';

        const abort = new AbortController();

        let resolveFunction: () => void | null = null;

        let firstResponsePromise = new Promise<void>(resolve => {
            resolveFunction = resolve;
        });

        const errorReceived = vi.fn();

        const promise = getChatCompletionAdvanced({
            openai,
            messages: [{
                role: 'user',
                content: 'write a short line on testing',
            }],
            onError: errorReceived,
            onProgress(result: ChatStreamDelta): void {
                const content = result.choices[0].delta.content;

                if (content) {
                    resultText += content;

                    console.log(resultText);

                    if (resolveFunction) {
                        resolveFunction();
                        resolveFunction = null;
                    }
                }
            },
            options: {
                temperature: 0,
                model: 'gpt-3.5-turbo',
                stream: true,
            },
            signal: abort.signal,
        });

        await firstResponsePromise;
        abort.abort();

        await promise;

        expect(errorReceived).toBeCalled();
        expect(errorReceived.mock.calls).toHaveLength(1);
        expect(errorReceived.mock.lastCall).to.deep.eq([{
            message: 'Stream aborted',
            type: CompletionErrorType.Aborted,
        }]);

        expect("Testing is a crucial step in software development that ensures the quality and functionality of the product.".startsWith(resultText)).to.be.true;
    }, 10000);
});
