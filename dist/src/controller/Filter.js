"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EmptyFilter = exports.NOTFilter = exports.ORFilter = exports.ANDFilter = exports.ISFilter = exports.EQFilter = exports.LTFilter = exports.GTFilter = void 0;
class GTFilter {
    field;
    value;
    constructor(field, value) {
        this.field = field;
        this.value = value;
    }
    matches(section) {
        return section[this.field] > this.value;
    }
}
exports.GTFilter = GTFilter;
class LTFilter {
    field;
    value;
    constructor(field, value) {
        this.field = field;
        this.value = value;
    }
    matches(section) {
        return section[this.field] < this.value;
    }
}
exports.LTFilter = LTFilter;
class EQFilter {
    field;
    value;
    constructor(field, value) {
        this.field = field;
        this.value = value;
    }
    matches(section) {
        return section[this.field] === this.value;
    }
}
exports.EQFilter = EQFilter;
class ISFilter {
    field;
    value;
    constructor(field, value) {
        this.field = field;
        this.value = value;
    }
    matches(section) {
        const sectionValue = section[this.field];
        const pattern = this.value;
        if (pattern.startsWith("*") && pattern.endsWith("*")) {
            return sectionValue.includes(pattern.slice(1, -1));
        }
        else if (pattern.startsWith("*")) {
            return sectionValue.endsWith(pattern.slice(1));
        }
        else if (pattern.endsWith("*")) {
            return sectionValue.startsWith(pattern.slice(0, -1));
        }
        else {
            return sectionValue === pattern;
        }
    }
}
exports.ISFilter = ISFilter;
class ANDFilter {
    filters;
    constructor(filters) {
        this.filters = filters;
    }
    matches(section) {
        return this.filters.every((f) => f.matches(section));
    }
}
exports.ANDFilter = ANDFilter;
class ORFilter {
    filters;
    constructor(filters) {
        this.filters = filters;
    }
    matches(section) {
        return this.filters.some((f) => f.matches(section));
    }
}
exports.ORFilter = ORFilter;
class NOTFilter {
    filter;
    constructor(filter) {
        this.filter = filter;
    }
    matches(section) {
        return !this.filter.matches(section);
    }
}
exports.NOTFilter = NOTFilter;
class EmptyFilter {
    matches(_section) {
        return true;
    }
}
exports.EmptyFilter = EmptyFilter;
//# sourceMappingURL=Filter.js.map