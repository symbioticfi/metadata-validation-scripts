import * as core from "@actions/core";
import * as github from "@actions/github";

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

let octokit: ReturnType<typeof github.getOctokit>;
const isLocalRun = process.env.LOCAL_ACTION_RUN === "true";

export const repoPath = [
  github.context.repo.owner,
  github.context.repo.repo,
].join("/");

export const getInput = core.getInput;

const getIssueNumber = () => {
  const inputNumber = getInput("issue", {
    required: true,
    trimWhitespace: true,
  });

  return +inputNumber;
};

const getToken = () => {
  const token = getInput("token", {
    required: true,
    trimWhitespace: true,
  });

  return token;
};

const getOctokit = () => {
  const token = getToken();

  if (!token) {
    throw new Error("GITHUB_TOKEN env variable is required");
  }

  octokit = octokit || github.getOctokit(token);

  return octokit;
};

export const addComment = async (body: string) => {
  const { owner, repo } = github.context.issue;

  if (isLocalRun) {
    console.group("Add Comment");
    console.log("Add comment:", body);
    console.groupEnd();

    return;
  }

  await getOctokit().rest.issues.createComment({
    owner,
    repo,
    issue_number: getIssueNumber(),
    body,
  });
};

export const addReview = async (review: Review) => {
  const { owner, repo } = github.context.issue;

  if (isLocalRun) {
    console.group("Add review");
    console.log(review);
    console.groupEnd();

    return;
  }

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
