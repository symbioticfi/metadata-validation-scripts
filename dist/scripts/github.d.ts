import * as core from "@actions/core";
export type ReviewComment = {
    path: string;
    body: string;
    line?: number;
    position?: number;
};
export type Review = {
    body?: string;
    comments?: ReviewComment[];
};
export declare const repoPath: string;
export declare const getInput: typeof core.getInput;
export declare const addComment: (body: string) => Promise<void>;
export declare const addReview: (review: Review) => Promise<void>;
export declare const run: (command: () => Promise<void>) => Promise<void>;
