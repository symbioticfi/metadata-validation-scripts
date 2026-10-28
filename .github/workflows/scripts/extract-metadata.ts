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
    protocols: { protocol: string; ids: string[]; subaccounts?: number[] }[];
};

type Entity = {
    info: Info | MerkleAdapterInfo;
    logo?: string;
};

const DIRECTORIES = {
    VAULTS: "vaults",
    TOKENS: "tokens",
    NETWORKS: "networks",
    OPERATORS: "operators",
    POINTS: "points",
    CURATORS: "curators",
    ADAPTERS: "adapters",
    MERKLE_ADAPTERS: "merkle-adapters",
} as const;
type Directory = (typeof DIRECTORIES)[keyof typeof DIRECTORIES];

type Template = Record<Directory, Record<string, Entity>>;

async function grabEntitiesInfo(globalDirs: Directory[]) {
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

                    result[dir][subdir] = entity;
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
