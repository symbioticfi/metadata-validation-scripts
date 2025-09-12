import { repoPath } from "./github";

const contributionGuidelines = `Please, follow the [contribution guidelines](https://github.com/${repoPath}/blob/main/README.md).`;

export const notAllowedChanges = (files: string[]) =>
    `We detected changes in the pull request that are not allowed. ${contributionGuidelines}

  **Not allowed files:**
  ${files.map((file) => `- ${file}`).join("\n")}
`;

export const onlyOneEntityPerPr = (dirs: string[]) =>
    `It is not allowed to change more than one entity in a single pull request. ${contributionGuidelines}

  **Entities:**
  ${dirs.map((file) => `- ${file}`).join("\n")}
`;

export const noInfoJson = (dir: string) =>
    `The entity folder \`${dir}\` should have \`info.json\` file. ${contributionGuidelines}`;

export const invalidInfoJson = () => `The \`info.json\` file is invalid. ${contributionGuidelines}`;

export const invalidLogo = (path: string, errors: string[]) =>
    `The logo image is invalid. ${contributionGuidelines}

  **Unmet requirements:**
  ${errors.map((error) => `- ${error}`).join("\n")}
`;

export const notRegisteredEntity = (
    label: string,
    address: string,
    chain: string,
    registryContract: string,
) =>
    `${label} \`${address}\` is not registered in ${label.toLowerCase()} registry on ${chain} network (registry address: \`${registryContract}\`). ${contributionGuidelines}`;

export const invalidVault = (address: string, chain: string) =>
    `Contract \`${address}\` is not a valid Vault on ${chain} network. ${contributionGuidelines}`;

export const noVaultTokenInfo = (tokenAddress: string) =>
    `Information for the vault collateral is not found in the repository. \nPlease, make sure info for token \`${tokenAddress}\` is present in this repository. If not, please create Pull Request for it first. ${contributionGuidelines}`;

export const invalidRewardsType = (address: string, type: string) =>
    `Rewards contract \`${address}\` has invalid type \`${type}\`. Expected type is \`defaultStakingRewardsV2\`. ${contributionGuidelines}`;

export const rewardsNotFromFactory = (address: string, factoryAddress: string, chain: string) =>
    `Rewards contract \`${address}\` is not deployed by the rewards factory \`${factoryAddress}\` on ${chain} network. ${contributionGuidelines}`;

export const rewardsVaultMismatch = (
    rewardsAddress: string,
    actualVault: string,
    expectedVault: string,
) =>
    `Rewards contract \`${rewardsAddress}\` is associated with vault \`${actualVault}\`, but expected \`${expectedVault}\`. ${contributionGuidelines}`;
