import {describe, expect, it} from 'vitest';
import {mergeChatStreamDeltas, concatStrings} from "../src/advanced/plugins/mergeChatStreamDeltas";
import {ChatStreamDelta, ChatStreamDeltaChoice} from "../src";

describe('mergeValues', () => {
    it('returns newValue when currentValue is undefined', () => {
        const result = concatStrings(undefined, 'newValue');
        expect(result).toBe('newValue');
    });

    it('returns currentValue when newValue is undefined', () => {
        const result = concatStrings('currentValue', undefined);
        expect(result).toBe('currentValue');
    });

    it('returns concatenated string when both currentValue and newValue are defined', () => {
        const result = concatStrings('current', 'new');
        expect(result).toBe('currentnew');
    });
});

describe('mergeChatStreamDeltas', () => {
    const baseDelta: ChatStreamDelta = {
        id: '1',
        object: 'baseDelta',
        created: 1,
        model: 'baseModel',
        choices: [],
    };

    it('adds new choices to the current choices', () => {
        const input: ChatStreamDelta = {
            ...baseDelta,
            choices: [
                {
                    delta: { },
                    index: 1,
                    finish_reason: null,
                },
            ],
        };

        const result = mergeChatStreamDeltas(baseDelta, input);
        expect(result.choices.length).toBe(1);
        expect(result.choices[0]).toEqual(input.choices[0]);
    });

    it('merges role, content, and function_call for the matching choices', () => {
        const current: ChatStreamDeltaChoice = {
            delta: {
                role: 'assistant',
                content: 'Hello, ',
                function_call: {
                    name: 'func1',
                },
            },

            index: 1,
            finish_reason: null,
        };

        const newChoice: ChatStreamDeltaChoice = {
            delta: {
                role: 'assistant',
                content: "I'm well.",
                function_call: {
                    arguments: 'arg1',
                },
            },


            index: 1,
            finish_reason: 'stop',
        };

        const currentDelta: ChatStreamDelta = { ...baseDelta, choices: [current] };
        const inputDelta: ChatStreamDelta = { ...baseDelta, choices: [newChoice] };

        const result = mergeChatStreamDeltas(currentDelta, inputDelta);
        const mergedChoice = result.choices.find(choice => choice.index === 1);

        expect(mergedChoice).toBeDefined();
        expect(mergedChoice!.delta.role).toBe('assistant');
        expect(mergedChoice!.delta.content).toBe("Hello, I'm well.");
        expect(mergedChoice!.delta.function_call).toEqual({ name: 'func1', arguments: 'arg1' });
        expect(mergedChoice!.finish_reason).toBe('stop');
    });
});
