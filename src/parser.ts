class Parser {
    public castValue(value: any, type: any): any {
        if (type === Date) {
            return new Date(value);

        } else if (typeof type === "function") {
            return type(value);

        }

        return value;
    }
}

export const parser = new Parser();
