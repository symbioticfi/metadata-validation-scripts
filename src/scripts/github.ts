import * as core from "@actions/core";
import * as github from "@actions/github";

let octokit: ReturnType<typeof github.getOctokit>;

const getOctokit = () => {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    throw new Error("GITHUB_TOKEN env variable is required");
  }

  octokit = octokit || github.getOctokit(token);

  return octokit;
};

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

export const repoPath = [
  github.context.repo.owner,
  github.context.repo.repo,
].join("/");

export const getInput = core.getInput;

const getIssueNumber = () => {
  const { number } = github.context.issue;

  if (number) {
    return number;
  }

  const inputNumber = getInput("issue", {
    required: false,
    trimWhitespace: true,
  });

  if (!inputNumber) {
    throw new Error("Issue number is required");
  }

  return +inputNumber;
};

export const addComment = async (body: string) => {
  const { owner, repo } = github.context.issue;

  await getOctokit().rest.issues.createComment({
    owner,
    repo,
    issue_number: getIssueNumber(),
    body,
  });
};

export const addReview = async (review: Review) => {
  const { owner, repo } = github.context.issue;

  await getOctokit().rest.pulls.createReview({
    owner,
    repo,
    pull_number: getIssueNumber(),
    event: "COMMENT",
    ...review,
  });
};

export const run = async (command: () => Promise<void>) => {
  try {
    await command();
  } catch (error) {
    if (error instanceof Error) {
      core.setFailed(error.message);
    }
  }
};
