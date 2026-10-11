import * as github from "@actions/github";
import fs from "fs/promises";
import path from "path";

type Info = Partial<{
    name: string;
    description: string;
    tags: string[];
    cmcId: string;
    links: [
        {
            type: string;
            name: string;
            url: string;
        },
        {
            type: string;
            name: string;
            url: string;
        },
        {
            type: string;
            name: string;
            url: string;
        },
    ];
}>;

type MerkleAdapterInfo = {
    protocols: { protocol: string; addresses: string[] }[];
};

type Entity = {
    info: Info | MerkleAdapterInfo;
    logo?: string;
};

enum DIRECTORIES {
    VAULTS = "vaults",
    TOKENS = "tokens",
    NETWORKS = "networks",
    OPERATORS = "operators",
    POINTS = "points",
    CURATORS = "curators",
    ADAPTERS = "adapters",
    MERKLE_ADAPTERS = "merkle-adapters",
}

type Template = Record<DIRECTORIES, Record<string, Entity>>;

async function grabEntitiesInfo(globalDirs: DIRECTORIES[]) {
    const repoPath = [github.context.repo.owner, github.context.repo.repo].join("/");
    const result = Object.values(DIRECTORIES).reduce<Template>((acc, curr) => {
        acc[curr] = {};

        return acc;
    }, {} as Template);

    for (const dir of globalDirs) {
        try {
            const subdirs = await fs.readdir(dir);
            for (const subdir of subdirs) {
                const entityPath = path.join(dir, subdir);
                try {
                    const infoPath = path.join(entityPath, "info.json");
                    const logoPath = path.join(entityPath, "logo.png");

                    const info: Entity["info"] = JSON.parse(await fs.readFile(infoPath, "utf8"));
                    const entity: Entity = { info };

                    const hasLogo = await fs
                        .stat(logoPath)
                        .then((stats) => stats.isFile())
                        .catch(() => false);

                    if (hasLogo && dir !== DIRECTORIES.MERKLE_ADAPTERS) {
                        const logoUrl = `https://raw.githubusercontent.com/${repoPath}/main/${entityPath}/logo.png`;

                        entity.logo = logoUrl;
                    }

                    result[dir as DIRECTORIES][subdir] = entity;
                } catch (error) {
                    console.error("Error processing entity in " + entityPath, error);
                }
            }
        } catch (error) {
            console.error("Error reading directory " + dir, error);
        }
    }

    const filePath = path.join(process.cwd(), "full-info.json");
    await fs.writeFile(filePath, JSON.stringify(result, null, "\t"), "utf8");
}

grabEntitiesInfo(Object.values(DIRECTORIES));
