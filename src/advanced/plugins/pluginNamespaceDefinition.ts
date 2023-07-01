type PluginStringParameter = {
    type: 'string',
    description?: string,
    example?: string,
    default?: string,
    enum?: string[],
};
type PluginNumberParameter = {
    type: 'number',
    description?: string,
    example?: number,
    default?: number,
};
type PluginBooleanParameter = {
    type: 'boolean',
    description?: string,
    example?: boolean,
    default?: boolean,
};
type PluginObjectParameter = {
    type: 'object',
    description?: string,
    example?: {
        [key: string]: unknown;
    },
    default?: {
        [key: string]: unknown;
    },
    properties: {
        [key: string]: PluginParameter;
    },
    required?: string[],
};
type PluginArrayParameter = {
    type: 'array',
    description?: string,
    example?: unknown[],
    default?: unknown[],
    items: PluginParameter,
};
type PluginNullParameter = {
    type: 'null',
    description?: string,
    example?: null,
    default?: null,
};
type PluginParameter =
    | PluginStringParameter
    | PluginNumberParameter
    | PluginBooleanParameter
    | PluginObjectParameter
    | PluginArrayParameter
    | PluginNullParameter;

export type PluginFunctionType = {
    name: string,
    description?: string,
    parameters: PluginObjectParameter,
};

export type PluginNamespaceDefinition = {
    name: string,
    functions: PluginFunctionType[],
};
