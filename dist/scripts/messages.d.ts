type JSONSchemaError = {
    line: number;
    message: string;
};
export declare const notAllowedChanges: (files: string[]) => string;
export declare const onlyOneEntityPerPr: (dirs: string[]) => string;
export declare const noInfoJson: (entityDir: string, files: string[]) => string;
export declare const invalidInfoJson: (path: string, erros: JSONSchemaError[]) => string;
export declare const invalidLogo: (path: string, errors: string[]) => string;
export {};
