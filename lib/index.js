"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getChatCompletion = exports.getChatCompletionSimple = exports.getCompletionAdvanced = exports.getCompletionSimple = exports.CompletionErrorType = void 0;
var types_1 = require("./types");
Object.defineProperty(exports, "CompletionErrorType", { enumerable: true, get: function () { return types_1.CompletionErrorType; } });
var completion_1 = require("./completion");
Object.defineProperty(exports, "getCompletionSimple", { enumerable: true, get: function () { return completion_1.getCompletionSimple; } });
Object.defineProperty(exports, "getCompletionAdvanced", { enumerable: true, get: function () { return completion_1.getCompletionAdvanced; } });
var chatCompletion_1 = require("./chatCompletion");
Object.defineProperty(exports, "getChatCompletionSimple", { enumerable: true, get: function () { return chatCompletion_1.getChatCompletionSimple; } });
Object.defineProperty(exports, "getChatCompletion", { enumerable: true, get: function () { return chatCompletion_1.getChatCompletion; } });
//# sourceMappingURL=index.js.map