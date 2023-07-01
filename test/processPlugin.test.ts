import {it, expect, describe, vi} from 'vitest';
import {Configuration, OpenAIApi} from "openai";
import path from 'path';
import {processPlugin} from "../src/advanced/plugins/pluginTools";
import fs from 'fs';

// mock axios
vi.mock('axios', async () => {
    const actual = await vi.importActual<typeof import('axios')>('axios');

    return {
        default: {
            ...actual,
            get: vi.fn(async (url) => {
                if (url.startsWith('file://')) {
                    const filePath = url.slice('file://'.length);

                    const raw = fs.readFileSync(filePath, 'utf-8');

                    if (filePath.endsWith('.json')) {
                        return {
                            data: JSON.parse(raw),
                            headers: {
                                'content-type': 'application/json',
                            },
                        };
                    } else if (filePath.endsWith('.yaml')) {
                        return {
                            data: raw,
                            headers: {
                                'content-type': 'text/plain',
                            },
                        };
                    }

                    return {
                        data: raw,
                        headers: {
                            'content-type': 'text/plain',
                        }
                    };
                }

                return actual.default.get(url);
            })
        }
    }
});

const openai = new OpenAIApi(new Configuration({
    apiKey: process.env.OPENAI_API_KEY,
}));

/**
 * vi.mock('pg', () => {
 *   const Client = vi.fn()
 *   Client.prototype.connect = vi.fn()
 *   Client.prototype.query = vi.fn()
 *   Client.prototype.end = vi.fn()
 *
 *   return { Client }
 * })
 */


describe('processPlugins', () => {
    it('should be able to parse plugin specs from a local file', async () => {
        const pluginInfo = await processPlugin({
            model: undefined,
            openaiClient: openai,
            url: 'one.json',
            getProxyUrl(url) {
                return 'file://' + path.resolve(__dirname, 'data', 'plugins', url);
            }
        });

        expect(pluginInfo).not.toBeUndefined();

        if (pluginInfo === undefined) {
            return;
        }

        expect(pluginInfo.namespaceInfo).not.toBeNull();

        if (pluginInfo.namespaceInfo === null) {
            return;
        }

        // name should be 'QueryAnything'
        expect(pluginInfo.namespaceInfo.name).toBe('QueryAnything');

        // should have only one function
        expect(pluginInfo.namespaceInfo.functions).toHaveLength(1);

        // the function should be called 'search'
        expect(pluginInfo.namespaceInfo.functions[0].name).toBe('search');

        // the description should be 'Searches the web for the given query.'
        expect(pluginInfo.namespaceInfo.functions[0].description).toBe('Searches the web for the given query.');

        // the parameters should be an object with two properties
        expect(pluginInfo.namespaceInfo.functions[0].parameters).not.toBeUndefined();
        expect(pluginInfo.namespaceInfo.functions[0].parameters.type).toBe('object');
        expect(pluginInfo.namespaceInfo.functions[0].parameters.required).not.toBeUndefined();
        expect(pluginInfo.namespaceInfo.functions[0].parameters.required).toHaveLength(2);
        expect(pluginInfo.namespaceInfo.functions[0].parameters.required).toContain('url');
        expect(pluginInfo.namespaceInfo.functions[0].parameters.required).toContain('query');

        expect(pluginInfo.namespaceInfo.functions[0].parameters.properties).not.toBeUndefined();
        expect(pluginInfo.namespaceInfo.functions[0].parameters.properties.url).not.toBeUndefined();
        expect(pluginInfo.namespaceInfo.functions[0].parameters.properties.query).not.toBeUndefined();

        // the url property should be a string
        expect(pluginInfo.namespaceInfo.functions[0].parameters.properties.url.type).toBe('string');
        expect(pluginInfo.namespaceInfo.functions[0].parameters.properties.url.description).toBe('The URL for the search engine to use');
        expect(pluginInfo.namespaceInfo.functions[0].parameters.properties.url.example).toBe('https://news.ycombinator.com/');

        // the query property should be a string
        expect(pluginInfo.namespaceInfo.functions[0].parameters.properties.query.type).toBe('string');
        expect(pluginInfo.namespaceInfo.functions[0].parameters.properties.query.description).toBe('Query to search for in the url');
        expect(pluginInfo.namespaceInfo.functions[0].parameters.properties.query.example).toBe('are there any new posts about web development today');

        fs.writeFileSync(path.resolve(__dirname, 'data', 'plugins', 'output', 'namespaceResult.json'), JSON.stringify(pluginInfo, null, 2));
    }, 100_000);

    it('should be able to parse plugin specs from a local file 2', async () => {
        const pluginInfo = await processPlugin({
            model: undefined,
            openaiClient: openai,
            url: 'two.json',
            getProxyUrl(url) {
                return 'file://' + path.resolve(__dirname, 'data', 'plugins', url);
            }
        });

        expect(pluginInfo).not.toBeUndefined();

        if (pluginInfo === undefined) {
            return;
        }

        expect(pluginInfo.namespaceInfo).not.toBeNull();

        if (pluginInfo.namespaceInfo === null) {
            return;
        }

        // name should be 'QueryAnything'
        expect(pluginInfo.namespaceInfo.name).toBe('Search');

        // should have only one function
        expect(pluginInfo.namespaceInfo.functions).toHaveLength(3);

        // the function should be called 'search'
        expect(pluginInfo.namespaceInfo.functions[0].name).toBe('search');

        // the description should be 'Searches the web for the given query.'
        expect(pluginInfo.namespaceInfo.functions[0].description).toBe('Searches the web for the given query.');

        // the parameters should be an object with two properties
        expect(pluginInfo.namespaceInfo.functions[0].parameters).not.toBeUndefined();
        expect(pluginInfo.namespaceInfo.functions[0].parameters.type).toBe('object');
        expect(pluginInfo.namespaceInfo.functions[0].parameters.required).not.toBeUndefined();
        expect(pluginInfo.namespaceInfo.functions[0].parameters.required).toHaveLength(1);
        expect(pluginInfo.namespaceInfo.functions[0].parameters.required).toContain('query');

        expect(pluginInfo.namespaceInfo.functions[0].parameters.properties).not.toBeUndefined();
        expect(pluginInfo.namespaceInfo.functions[0].parameters.properties.query).not.toBeUndefined();

        // the query property should be a string
        expect(pluginInfo.namespaceInfo.functions[0].parameters.properties.query.type).toBe('string');
        expect(pluginInfo.namespaceInfo.functions[0].parameters.properties.query.description).toBe('Query to search for');
        expect(pluginInfo.namespaceInfo.functions[0].parameters.properties.query.example).toBe('who is the current monarch of the united kingdom');

        fs.writeFileSync(path.resolve(__dirname, 'data', 'plugins', 'output', 'two-pluginInfo.json'), JSON.stringify(pluginInfo, null, 2));
    }, 100_000);

    it('should be able to parse plugin specs from a url', async () => {
        const pluginInfo = await processPlugin({
            model: undefined,
            openaiClient: openai,
            url: 'https://api.tomorrow.io/.well-known/ai-plugin.json'
        });

        expect(pluginInfo).not.toBeUndefined();

        if (pluginInfo === undefined) {
            return;
        }

        expect(pluginInfo.namespaceInfo).not.toBeNull();

        if (pluginInfo.namespaceInfo === null) {
            return;
        }

        fs.writeFileSync(path.resolve(__dirname, 'data', 'plugins', 'output', 'weather.json'), JSON.stringify(pluginInfo, null, 2));

        // name should be 'QueryAnything'
        expect(pluginInfo.namespaceInfo.name).toBe('weather');

        // should have only one function
        expect(pluginInfo.namespaceInfo.functions).toHaveLength(1);

        // the function should be called 'search'
        expect(pluginInfo.namespaceInfo.functions[0].name).toBe('handleWeatherQuestion');

        // the description should be 'Searches the web for the given query.'
        expect(pluginInfo.namespaceInfo.functions[0].description).toBe('Answer weather and climate related questions');

        expect(pluginInfo.namespaceInfo.functions[0].parameters).not.toBeUndefined();
        expect(pluginInfo.namespaceInfo.functions[0].parameters.type).toBe('object');
        expect(pluginInfo.namespaceInfo.functions[0].parameters.required).not.toBeUndefined();
        expect(pluginInfo.namespaceInfo.functions[0].parameters.required).toHaveLength(1);
        expect(pluginInfo.namespaceInfo.functions[0].parameters.required).toContain('question');

        expect(pluginInfo.namespaceInfo.functions[0].parameters.properties).not.toBeUndefined();

        const questionProperty = pluginInfo.namespaceInfo.functions[0].parameters.properties.question;
        expect(questionProperty).not.toBeUndefined();

        // the query property should be a string
        expect(questionProperty.type).toBe('string');
        expect(questionProperty.description).toBe('The users question related to weather or climate.');
        // the query property should not have a required boolean
        expect((questionProperty as typeof questionProperty & { required?: boolean }).required).toBeUndefined();
    }, 100_000);
})
