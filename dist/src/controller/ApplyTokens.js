"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CountToken = exports.SumToken = exports.AvgToken = exports.MinToken = exports.MaxToken = void 0;
const decimal_js_1 = __importDefault(require("decimal.js"));
class MaxToken {
    apply(group, fieldName) {
        return Math.max(...group.map((s) => s[fieldName]));
    }
}
exports.MaxToken = MaxToken;
class MinToken {
    apply(group, fieldName) {
        return Math.min(...group.map((s) => s[fieldName]));
    }
}
exports.MinToken = MinToken;
class AvgToken {
    apply(group, fieldName) {
        const total = group.reduce((sum, s) => sum.add(new decimal_js_1.default(s[fieldName])), new decimal_js_1.default(0));
        return Number((total.toNumber() / group.length).toFixed(2));
    }
}
exports.AvgToken = AvgToken;
class SumToken {
    apply(group, fieldName) {
        const total = group.reduce((sum, s) => sum.add(new decimal_js_1.default(s[fieldName])), new decimal_js_1.default(0));
        return Number(total.toFixed(2));
    }
}
exports.SumToken = SumToken;
class CountToken {
    apply(group, fieldName) {
        const unique = new Set(group.map((s) => s[fieldName]));
        return unique.size;
    }
}
exports.CountToken = CountToken;
//# sourceMappingURL=ApplyTokens.js.map