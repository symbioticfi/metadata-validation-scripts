const contributionGuidelines = `Please, follow the [contribution guidelines](https://github.com/symbioticfi/metadata-holesky/blob/main/README.md).`;

type JSONSchemaError = {
  line: number;
  message: string;
};

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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const noInfoJson = (entityDir: string, files: string[]) =>
  `The entity folder should have \`info.json\` file. ${contributionGuidelines}`;

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const invalidInfoJson = (path: string, erros: JSONSchemaError[]) =>
  `The \`info.json\` file is invalid. ${contributionGuidelines}`;

export const invalidLogo = (path: string, errors: string[]) =>
  `The logo image is invalid. ${contributionGuidelines}

  **Unmet requirements:**
  ${errors.map((error) => `- ${error}`).join("\n")}
`;
