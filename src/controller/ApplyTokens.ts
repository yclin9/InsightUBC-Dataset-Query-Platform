import Decimal from "decimal.js";

export interface ApplyToken {
  apply(group: any[], fieldName: string): number;
}

export class MaxToken implements ApplyToken {
  apply(group: any[], fieldName: string): number {
    return Math.max(...group.map((s) => s[fieldName]));
  }
}

export class MinToken implements ApplyToken {
  apply(group: any[], fieldName: string): number {
    return Math.min(...group.map((s) => s[fieldName]));
  }
}

export class AvgToken implements ApplyToken {
  apply(group: any[], fieldName: string): number {
    const total = group.reduce(
      (sum, s) => sum.add(new Decimal(s[fieldName])),
      new Decimal(0),
    );
    return Number((total.toNumber() / group.length).toFixed(2));
  }
}

export class SumToken implements ApplyToken {
  apply(group: any[], fieldName: string): number {
    const total = group.reduce(
      (sum, s) => sum.add(new Decimal(s[fieldName])),
      new Decimal(0),
    );
    return Number(total.toFixed(2));
  }
}

export class CountToken implements ApplyToken {
  apply(group: any[], fieldName: string): number {
    const unique = new Set(group.map((s) => s[fieldName]));
    return unique.size;
  }
}
