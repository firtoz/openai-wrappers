import {describe, expect, it} from 'vitest';
import {encodeLength, numTokensFromMessages} from "../src/advanced/utils/counting";

describe('encodeLength', () => {
    it('should be able to get the length of a text using 3.5 model', () => {
        const text = 'should be able to get the length of a text using 3.5 model';
        const length = encodeLength(text, 'gpt-3.5-turbo');
        expect(length).toBe(16);
    });

    it('should be able to get the length of a text using 4.0 model', () => {
        const text = 'should be able to get the length of a text using 4.0 model';
        const length = encodeLength(text, 'gpt-4');
        expect(length).toBe(16);
    });

    it('should be able to get the length of messages using 3.5 model', () => {
        const length = numTokensFromMessages([{
            role: 'system',
            content: 'You are a human.',
        }, {
            role: 'user',
            content: 'No I am not.',
        }, {
            role: 'system',
            content: 'Yes you are.',
        }, {
            role: 'function',
            content: 'func1',
        }, {
            role: 'assistant',
            content: 'Hello, ',
        }, {
            role: 'user',
            content: 'Hi, ',
        }], 'gpt-3.5-turbo');
        expect(length).toBe(55);
    });

    it('should be able to get the length of messages using 4.0 model', () => {
        const length = numTokensFromMessages([{
            role: 'system',
            content: 'You are a human.',
        }, {
            role: 'user',
            content: 'No I am not.',
        }, {
            role: 'system',
            content: 'Yes you are.',
        }, {
            role: 'function',
            content: 'func1',
        }, {
            role: 'assistant',
            content: 'Hello, ',
        }, {
            role: 'user',
            content: 'Hi, ',
        }], 'gpt-4');
        expect(length).toBe(49);
    });
});
