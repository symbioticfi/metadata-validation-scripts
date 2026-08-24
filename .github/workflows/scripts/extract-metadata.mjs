import fs from "fs/promises";
import path from "path";
import { pathToFileURL } from "url";

const DIRECTORIES = Object.freeze([
    "vaults",
    "tokens",
    "networks",
    "operators",
    "points",
    "curators",
    "adapters",
]);

async function grabEntitiesInfo(globalDirs) {
    const repoPath = process.env.GITHUB_REPOSITORY;
    if (!repoPath) {
        throw new Error("GITHUB_REPOSITORY is required");
    }

    const result = Object.fromEntries(DIRECTORIES.map((directory) => [directory, {}]));

    for (const directory of globalDirs) {
        const directoryStats = await fs.stat(directory).catch(() => null);
        if (!directoryStats?.isDirectory()) {
            continue;
        }

        try {
            const subdirectories = await fs.readdir(directory, { withFileTypes: true });
            for (const subdirectory of subdirectories) {
                if (!subdirectory.isDirectory()) {
                    continue;
                }

                const entityPath = path.join(directory, subdirectory.name);
                try {
                    const infoPath = path.join(entityPath, "info.json");
                    const logoPath = path.join(entityPath, "logo.png");
                    const info = JSON.parse(await fs.readFile(infoPath, "utf8"));
                    const entity = { info };
                    const logoStats = await fs.stat(logoPath).catch(() => null);

                    if (logoStats?.isFile()) {
                        entity.logo = `https://raw.githubusercontent.com/${repoPath}/main/${entityPath.replaceAll(path.sep, "/")}/logo.png`;
                    }

                    result[directory][subdirectory.name] = entity;
                } catch (error) {
                    console.error(`Error processing entity ${entityPath}`, error);
                }
            }
        } catch (error) {
            console.error(`Error reading directory ${directory}`, error);
        }
    }

    const outputPath = path.join(process.cwd(), "full-info.json");
    await fs.writeFile(outputPath, JSON.stringify(result, null, "\t"), "utf8");
}

grabEntitiesInfo(DIRECTORIES).catch((error) => {
    console.error("Failed to generate full-info.json", error);
    process.exitCode = 1;
});
