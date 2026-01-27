if (!(globalThis as any).ResizeObserver) {
    (globalThis as any).ResizeObserver = class {
        observe() { }
        unobserve() { }
        disconnect() { }
    };
}
// Make it available globally
(globalThis as any).ResizeObserver = ResizeObserver;