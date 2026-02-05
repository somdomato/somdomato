declare module "vitest" {
  export function describe(name: string, fn: () => void): void;
  export function it(name: string, fn?: () => void): void;

  export function beforeAll(fn: () => void | Promise<void>): void;
  export function afterAll(fn: () => void | Promise<void>): void;
  export function beforeEach(fn: () => void | Promise<void>): void;
  export function afterEach(fn: () => void | Promise<void>): void;

  export function expect(value?: unknown): {
    toBe(expected: unknown): void;
    toBeTruthy(): void;
    toEqual(expected: unknown): void;
    toHaveProperty(key: string): void;
    toBeGreaterThan(expected: number): void;
    toBeNull(): void;
    not: {
      toBe(expected: unknown): void;
      toBeNull(): void;
    };
  };

  export const vi: {
    fn<T extends (...args: unknown[]) => unknown>(impl?: T): T;
    spyOn(
      obj: object,
      method: string,
    ): { mockImplementation(fn: (...args: unknown[]) => unknown): void };
    mock(modulePath: string, factory?: () => unknown): void;
    clearAllMocks(): void;
    resetAllMocks(): void;
    restoreAllMocks(): void;
  };
}

declare global {
  const describe: typeof import("vitest").describe;
  const it: typeof import("vitest").it;
  const expect: typeof import("vitest").expect;
  const beforeAll: typeof import("vitest").beforeAll;
  const afterAll: typeof import("vitest").afterAll;
  const beforeEach: typeof import("vitest").beforeEach;
  const afterEach: typeof import("vitest").afterEach;
  const vi: typeof import("vitest").vi;
}
