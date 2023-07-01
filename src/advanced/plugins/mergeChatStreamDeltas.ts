import {ChatStreamDelta, ChatStreamDeltaChoice} from "../../types";

export const concatStrings = (currentValue: string | undefined, newValue: string | undefined): string | undefined => {
    if (!newValue) {
        return currentValue;
    }

    if (!currentValue) {
        return newValue;
    }

    return currentValue + newValue;
}

export const mergeDeltas = (resultChoice: ChatStreamDeltaChoice, newChoice: ChatStreamDeltaChoice) => {
    const resultDelta = resultChoice.delta;
    const newDelta = newChoice.delta;

    if (newDelta.role) {
        resultDelta.role = newDelta.role;
    }

    resultDelta.content = concatStrings(resultDelta.content, newDelta.content);

    if (newDelta.function_call) {
        if (!resultDelta.function_call) {
            resultDelta.function_call = newDelta.function_call;
        } else {
            resultDelta.function_call.name = concatStrings(resultDelta.function_call.name, newDelta.function_call.name);
            resultDelta.function_call.arguments = concatStrings(resultDelta.function_call.arguments, newDelta.function_call.arguments);
        }
    }
};

export const mergeChoices = (resultChoice: ChatStreamDeltaChoice, newChoice: ChatStreamDeltaChoice) => {
    mergeDeltas(resultChoice, newChoice);

    if (newChoice.finish_reason) {
        resultChoice.finish_reason = newChoice.finish_reason;
    }
};

export const allChoicesFinished = (delta: ChatStreamDelta): boolean => {
    return delta.choices.every(choice => {
        return choice.finish_reason !== null;
    });
}

export const mergeChatStreamDeltas = (current: Readonly<ChatStreamDelta> | null, newDelta: Readonly<ChatStreamDelta>): ChatStreamDelta => {
    if (!current) {
        const cloned = structuredClone(newDelta) as ChatStreamDelta;

        for (const choice of cloned.choices) {
            if (!choice.delta.function_call) {
                choice.delta.function_call = undefined;
            }
        }

        return cloned;
    }

    const result = structuredClone(current) as ChatStreamDelta;

    for (const newChoice of newDelta.choices) {
        const resultChoice = result.choices.find(outputChoice => {
            return outputChoice.index === newChoice.index;
        });

        if (resultChoice === undefined) {
            result.choices = result.choices.concat(newChoice);

            // sort by index
            result.choices.sort((a, b) => {
                return (a.index ?? 0) - (b.index ?? 0);
            });

            continue;
        }

        mergeChoices(resultChoice, newChoice);
    }

    return result;
}
