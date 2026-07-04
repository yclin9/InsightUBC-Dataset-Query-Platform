export interface Filter {
  matches(section: any): boolean;
}

export class GTFilter implements Filter {
  constructor(
    private field: string,
    private value: number,
  ) {}
  matches(section: any): boolean {
    return section[this.field] > this.value;
  }
}

export class LTFilter implements Filter {
  constructor(
    private field: string,
    private value: number,
  ) {}
  matches(section: any): boolean {
    return section[this.field] < this.value;
  }
}

export class EQFilter implements Filter {
  constructor(
    private field: string,
    private value: number,
  ) {}
  matches(section: any): boolean {
    return section[this.field] === this.value;
  }
}

export class ISFilter implements Filter {
  constructor(
    private field: string,
    private value: string,
  ) {}
  matches(section: any): boolean {
    const sectionValue = section[this.field];
    const pattern = this.value;
    if (pattern.startsWith("*") && pattern.endsWith("*")) {
      return sectionValue.includes(pattern.slice(1, -1));
    } else if (pattern.startsWith("*")) {
      return sectionValue.endsWith(pattern.slice(1));
    } else if (pattern.endsWith("*")) {
      return sectionValue.startsWith(pattern.slice(0, -1));
    } else {
      return sectionValue === pattern;
    }
  }
}

export class ANDFilter implements Filter {
  constructor(private filters: Filter[]) {}
  matches(section: any): boolean {
    return this.filters.every((f) => f.matches(section));
  }
}

export class ORFilter implements Filter {
  constructor(private filters: Filter[]) {}
  matches(section: any): boolean {
    return this.filters.some((f) => f.matches(section));
  }
}

export class NOTFilter implements Filter {
  constructor(private filter: Filter) {}
  matches(section: any): boolean {
    return !this.filter.matches(section);
  }
}

export class EmptyFilter implements Filter {
  matches(_section: any): boolean {
    return true;
  }
}
