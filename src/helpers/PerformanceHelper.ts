export  class PerformanceHelper {
    private _timer: [number, number] = [0, 0];

    constructor() {
        //
    }

    public start() {
        this._timer = process.hrtime();
        return this;
    }

    public read(): number {
        const diff = process.hrtime(this._timer);
        return diff[0] * 1000 + (diff[1] / 1000000);
    }

    public readResult(): {executionTime: number} {
        const executionTime = this.read();
        return {executionTime};
    }
}
