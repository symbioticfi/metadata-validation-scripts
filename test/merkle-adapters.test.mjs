import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { encodePng, Image } from "image-js";

const actionPath = fileURLToPath(new URL("../dist/index.cjs", import.meta.url));
const extractorPath = fileURLToPath(
    new URL("../.github/workflows/scripts/extract-metadata.ts", import.meta.url),
);
const adapter = "0x1111111111111111111111111111111111111111";
const registry = "0x2222222222222222222222222222222222222222";
const vault = "0x3333333333333333333333333333333333333333";
const marketId = `0x${"ab".repeat(32)}`;
const metadataPath = `merkle-adapters/${adapter}/info.json`;
const emptyInfo = { protocols: [] };
const allowlist = JSON.parse(
    await readFile(new URL("../src/scripts/config/merkle-protocols.json", import.meta.url), "utf8"),
);
const tokenAllowlist = JSON.parse(
    await readFile(new URL("../src/scripts/config/merkle-tokens.json", import.meta.url), "utf8"),
);
const tokenIds = Object.values(tokenAllowlist["1"]);
const usdc = "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48";
const targetProtocols = ["aave_v3", "aave_v4", "euler", "morpho_blue", "morpho_vaultv2", "tokens"];
const namedProducts = {
    midas: [
        "carrytradeusdtryleverage",
        "stockmarkettrbasistrade",
        "mapollo",
        "mbasis",
        "mbtc",
        "medge",
        "mevusd",
        "mfarm",
        "mfone",
        "mglobal",
        "mhyper",
        "mhyperbtc",
        "mhypereth",
        "mm1usd",
        "mmev",
        "mrox",
        "mre7btc",
        "mre7yield",
        "msl",
        "mtbill",
        "mevbtc",
        "msyrupusd",
        "msyrupusdp",
    ],
    centrifuge: ["acrdx", "hyb", "jaaa", "jtrsy", "dejaaa", "dejtrsy"],
    pareto: [
        "aa_falconxusdc",
        "bb_falconxusdc",
        "aa_fasanara",
        "bb_fasanara",
        "aa_bastion",
        "bb_bastion",
        "aa_adaptivefrontier",
        "bb_adaptivefrontier",
        "aa_rockawayx",
        "bb_rockawayx",
        "aa_abraxas",
        "bb_abraxas",
    ],
    hastra: ["prime", "auto", "wylds"],
    openeden: ["hybond", "tbill"],
    noon: ["susn", "usn"],
};

const execute = (args, options) =>
    new Promise((resolve) => {
        execFile(process.execPath, args, options, (error, stdout, stderr) => {
            resolve({ code: error?.code ?? 0, output: stdout + stderr });
        });
    });

async function fixture(t) {
    const cwd = await mkdtemp(path.join(tmpdir(), "merkle-metadata-"));
    t.after(() => rm(cwd, { recursive: true, force: true }));

    const calls = [];
    const githubCalls = [];
    const state = { registered: true };
    const server = createServer(async (request, response) => {
        let body = "";
        for await (const chunk of request) {
            body += chunk;
        }
        const call = JSON.parse(body);
        if (request.url.startsWith("/repos/")) {
            githubCalls.push({ method: request.method, url: request.url, body: call });
            response.writeHead(201, { "content-type": "application/json" });
            response.end(JSON.stringify({ id: 1 }));
            return;
        }
        calls.push(call);
        response.setHeader("content-type", "application/json");
        response.end(
            JSON.stringify({
                jsonrpc: "2.0",
                id: call.id,
                result: `0x${(state.registered ? "1" : "0").padStart(64, "0")}`,
            }),
        );
    });
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    t.after(() => new Promise((resolve) => server.close(resolve)));

    const env = {
        ...process.env,
        GITHUB_REPOSITORY: "symbioticfi/metadata-mainnet",
        GITHUB_API_URL: `http://127.0.0.1:${server.address().port}`,
        LOCAL_ACTION_RUN: "true",
        INPUT_ISSUE: "1",
        INPUT_TOKEN: "local-test",
        "INPUT_CHAIN-ID": "1",
        "INPUT_RPC-URL": `http://127.0.0.1:${server.address().port}`,
        "INPUT_VAULT-REGISTRY": registry,
        "INPUT_OPERATOR-REGISTRY": registry,
        "INPUT_NETWORK-REGISTRY": registry,
        "INPUT_ADAPTER-REGISTRY": registry,
    };

    return {
        cwd,
        calls,
        githubCalls,
        state,
        write: async (file, content) => {
            const fullPath = path.join(cwd, file);
            await mkdir(path.dirname(fullPath), { recursive: true });
            await writeFile(fullPath, content);
        },
        run: (files = [metadataPath], inputs = {}) =>
            execute([actionPath], {
                cwd,
                env: { ...env, INPUT_FILES: files.join(" "), ...inputs },
            }),
        extract: () => execute(["--experimental-transform-types", extractorPath], { cwd, env }),
    };
}

test("bundled action accepts name-only RWAs, vaults, pools, and bytes32 markets", async (t) => {
    const f = await fixture(t);
    await f.write(
        metadataPath,
        JSON.stringify({
            protocols: [
                { protocol: "aa_falconxusdc", ids: [] },
                { protocol: "mglobal", ids: [] },
                { protocol: "morpho_vaultv2", ids: [vault, adapter] },
                { protocol: "morpho_blue", ids: [marketId] },
                { protocol: "aave_v3", ids: ["core"] },
                { protocol: "euler", ids: [vault], subaccounts: [0, 1] },
                { protocol: "tokens", ids: [usdc] },
            ],
        }),
    );
    const result = await f.run();
    assert.equal(result.code, 0, result.output);
    assert.equal(f.calls.length, 1);
    assert.equal(f.calls[0].method, "eth_call");
    assert.equal(f.calls[0].params[0].to, registry);
    assert.ok(f.calls[0].params[0].data.endsWith(adapter.slice(2)));
});

test("empty metadata declares no integrations", async (t) => {
    const f = await fixture(t);
    await f.write(metadataPath, JSON.stringify(emptyInfo));
    const result = await f.run();
    assert.equal(result.code, 0, result.output);
});

test("bundled allowlist accepts every collected protocol and product", async (t) => {
    assert.deepEqual(
        Object.keys(allowlist).sort(),
        [...targetProtocols, "three_f", "ember", ...Object.values(namedProducts).flat()].sort(),
    );
    assert.deepEqual(
        Object.keys(allowlist)
            .filter((protocol) => allowlist[protocol].requiresIds)
            .sort(),
        targetProtocols,
    );
    for (const [protocol, rule] of Object.entries(allowlist)) {
        assert.match(protocol, /^[a-z0-9]+(?:_[a-z0-9]+)*$/);
        assert.equal(typeof rule.requiresIds, "boolean");
        assert.ok(["none", "address", "bytes32", "name"].includes(rule.idType));
        assert.equal(rule.requiresIds, rule.idType !== "none");
    }

    const f = await fixture(t);
    await f.write(
        metadataPath,
        JSON.stringify({
            protocols: Object.entries(allowlist).map(([protocol, rule]) => ({
                protocol,
                ids:
                    protocol === "tokens"
                        ? tokenIds
                        : rule.requiresIds
                          ? [rule.allowedIds?.[0] ?? (rule.idType === "bytes32" ? marketId : vault)]
                          : [],
                ...(protocol === "euler" ? { subaccounts: [0] } : {}),
            })),
        }),
    );
    const result = await f.run();
    assert.equal(result.code, 0, result.output);
});

test("tokens accepts exactly the seventeen NAV wallet token addresses", async (t) => {
    assert.deepEqual(Object.keys(tokenAllowlist), ["1"]);
    assert.deepEqual(Object.keys(tokenAllowlist["1"]).sort(), [
        "cbbtc",
        "dai",
        "lbtc",
        "paxg",
        "pyusd",
        "solvbtc",
        "tbtc",
        "teth",
        "unibtc",
        "usdc",
        "usde",
        "usds",
        "usdt",
        "wbtc",
        "weeth",
        "weth",
        "wsteth",
    ]);
    assert.equal(new Set(tokenIds).size, 17);
    const f = await fixture(t);
    await f.write(
        metadataPath,
        JSON.stringify({ protocols: [{ protocol: "tokens", ids: tokenIds }] }),
    );
    const result = await f.run();
    assert.equal(result.code, 0, result.output);
});

test("token address matching accepts checksum and uppercase hex spelling", async (t) => {
    const f = await fixture(t);
    await f.write(
        metadataPath,
        JSON.stringify({
            protocols: [
                {
                    protocol: "tokens",
                    ids: [
                        "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
                        "0x" + tokenAllowlist["1"].weth.slice(2).toUpperCase(),
                        "0xD11c452fc99cF405034ee446803b6F6c1F6d5ED8",
                        "0x7A56E1C57C7475CCf742a1832B028F0456652F97",
                        "0x45804880De22913dAFE09f4980848ECE6EcbAf78",
                        "0x004E9C3EF86bc1ca1f0bB5C7662861Ee93350568",
                        "0xdC035D45d973E3EC169d2276DDab16f1e407384F",
                    ],
                },
            ],
        }),
    );
    const result = await f.run();
    assert.equal(result.code, 0, result.output);
});

test("token addresses cannot be reused on a chain without a token allowlist", async (t) => {
    const f = await fixture(t);
    await f.write(
        metadataPath,
        JSON.stringify({ protocols: [{ protocol: "tokens", ids: tokenIds }] }),
    );
    const result = await f.run([metadataPath], { "INPUT_CHAIN-ID": "11155111" });
    assert.equal(result.code, 1, result.output);
    assert.match(result.output, /Add review/);
    assert.match(result.output, /info.json.*invalid/);
});

test("unsupported products and execution-only integrations are not allowlisted", async (t) => {
    for (const protocol of [
        "acred",
        "beqty",
        "buidl",
        "decrdx",
        "derive_v3",
        "dusd",
        "erc4626",
        "hinc",
        "liusd13w",
        "liusd4w",
        "morpho_midnight",
        "said",
        "spkcc",
        "stac",
        "sthusd",
        "susd3",
        "uscc",
        "vbill",
        "pplus",
        "pareto_receipt",
        "usd3",
        "weeth",
        "wsteth",
        "liquid_lane_connector",
        "merkl",
        "cow_swap",
        "liquid_lane_redeem",
    ]) {
        await t.test(protocol, async (context) => {
            const f = await fixture(context);
            await f.write(metadataPath, JSON.stringify({ protocols: [{ protocol, ids: [] }] }));
            const result = await f.run();
            assert.equal(result.code, 1, result.output);
            assert.match(result.output, /Add review/);
            assert.match(result.output, /allowed values/);
        });
    }
});

test("unpriced tokens are rejected even when their addresses are valid", async (t) => {
    for (const token of [
        "0x58d97b57bb95320f9a05dc918aef65434969c2b2", // MORPHO
        "0xd9fcd98c322942075a5c3860693e9f4f03aae07b", // EUL
    ]) {
        await t.test(token, async (context) => {
            const f = await fixture(context);
            await f.write(
                metadataPath,
                JSON.stringify({ protocols: [{ protocol: "tokens", ids: [token] }] }),
            );
            const result = await f.run();
            assert.equal(result.code, 1, result.output);
            assert.match(result.output, /Add review/);
        });
    }
});

test("target-based integrations require at least one identifier", async (t) => {
    for (const protocol of targetProtocols) {
        await t.test(protocol, async (context) => {
            const f = await fixture(context);
            await f.write(
                metadataPath,
                JSON.stringify({
                    protocols: [
                        {
                            protocol,
                            ids: [],
                            ...(protocol === "euler" ? { subaccounts: [0] } : {}),
                        },
                    ],
                }),
            );
            const result = await f.run();
            assert.equal(result.code, 1, result.output);
            assert.match(result.output, /Add review/);
            assert.match(result.output, /fewer than 1 items/);
        });
    }
});

test("Euler accepts explicit owner and XOR subaccount offsets through 255", async (t) => {
    const f = await fixture(t);
    await f.write(
        metadataPath,
        JSON.stringify({ protocols: [{ protocol: "euler", ids: [vault], subaccounts: [0, 255] }] }),
    );
    const result = await f.run();
    assert.equal(result.code, 0, result.output);
});

test("Euler rejects invalid or missing account scope with inline feedback", async (t) => {
    const cases = [
        ["missing", undefined],
        ["null", null],
        ["empty", []],
        ["duplicate", [0, 0]],
        ["fractional", [0.5]],
        ["negative", [-1]],
        ["256", [256]],
        ["string offset", ["1"]],
        ["boolean offset", [true]],
        ["null offset", [null]],
        ["non-array", 0],
    ];
    for (const [name, subaccounts] of cases) {
        await t.test(name, async (context) => {
            const f = await fixture(context);
            await f.write(
                metadataPath,
                JSON.stringify({ protocols: [{ protocol: "euler", ids: [vault], subaccounts }] }),
            );
            const result = await f.run();
            assert.equal(result.code, 1, result.output);
            assert.match(result.output, /Add review/);
        });
    }
});

test("other protocols reject Euler subaccount scope", async (t) => {
    for (const protocol of ["mglobal", "tokens", "aave_v3", "morpho_blue", "morpho_vaultv2"]) {
        await t.test(protocol, async (context) => {
            const f = await fixture(context);
            const ids =
                protocol === "mglobal" ? [] : [protocol === "morpho_blue" ? marketId : usdc];
            await f.write(
                metadataPath,
                JSON.stringify({ protocols: [{ protocol, ids, subaccounts: [0] }] }),
            );
            const result = await f.run();
            assert.equal(result.code, 1, result.output);
            assert.match(result.output, /Add review/);
        });
    }
});

test("Euler rejects zero and case-duplicate vault addresses", async (t) => {
    for (const [name, ids] of [
        ["zero", [`0x${"0".repeat(40)}`]],
        ["case duplicate", [usdc, `0x${usdc.slice(2).toUpperCase()}`]],
    ]) {
        await t.test(name, async (context) => {
            const f = await fixture(context);
            await f.write(
                metadataPath,
                JSON.stringify({ protocols: [{ protocol: "euler", ids, subaccounts: [0] }] }),
            );
            const result = await f.run();
            assert.equal(result.code, 1, result.output);
            assert.match(result.output, /Add review/);
        });
    }
});

test("Euler bounds the market and subaccount product at 48 pairs", async (t) => {
    for (const [markets, accounts, code] of [
        [48, 1, 0],
        [1, 48, 0],
        [6, 8, 0],
        [7, 7, 1],
    ]) {
        await t.test(`${markets} markets by ${accounts} subaccounts`, async (context) => {
            const f = await fixture(context);
            const ids = Array.from(
                { length: markets },
                (_, i) => `0x${(i + 1).toString(16).padStart(40, "0")}`,
            );
            const subaccounts = Array.from({ length: accounts }, (_, i) => i);
            await f.write(
                metadataPath,
                JSON.stringify({ protocols: [{ protocol: "euler", ids, subaccounts }] }),
            );
            const result = await f.run();
            assert.equal(result.code, code, result.output);
            if (code) assert.match(result.output, /Add review/);
        });
    }
});

test("portfolio protocols cannot be declared twice", async (t) => {
    for (const protocol of ["euler", "morpho_blue", "morpho_vaultv2", "tokens", "mglobal"]) {
        await t.test(protocol, async (context) => {
            const f = await fixture(context);
            const entry = {
                protocol,
                ids: protocol === "mglobal" ? [] : [protocol === "morpho_blue" ? marketId : usdc],
                ...(protocol === "euler" ? { subaccounts: [0] } : {}),
            };
            await f.write(metadataPath, JSON.stringify({ protocols: [entry, entry] }));
            const result = await f.run();
            assert.equal(result.code, 1, result.output);
            assert.match(result.output, /Add review/);
        });
    }
});

test("Morpho metadata keeps the 16-market runtime bounds", async (t) => {
    for (const protocol of ["morpho_blue", "morpho_vaultv2"]) {
        for (const [count, code] of [
            [16, 0],
            [17, 1],
        ]) {
            await t.test(`${protocol}: ${count} ids`, async (context) => {
                const f = await fixture(context);
                const width = protocol === "morpho_blue" ? 64 : 40;
                const ids = Array.from(
                    { length: count },
                    (_, i) => `0x${(i + 1).toString(16).padStart(width, "0")}`,
                );
                await f.write(metadataPath, JSON.stringify({ protocols: [{ protocol, ids }] }));
                const result = await f.run();
                assert.equal(result.code, code, result.output);
                if (code) assert.match(result.output, /Add review/);
            });
        }
    }
});

test("Morpho rejects zero and case-duplicate market identifiers", async (t) => {
    for (const [protocol, name, ids] of [
        ["morpho_blue", "zero", [`0x${"0".repeat(64)}`]],
        ["morpho_blue", "case duplicate", [marketId, `0x${marketId.slice(2).toUpperCase()}`]],
        ["morpho_vaultv2", "zero", [`0x${"0".repeat(40)}`]],
        ["morpho_vaultv2", "case duplicate", [usdc, `0x${usdc.slice(2).toUpperCase()}`]],
    ]) {
        await t.test(`${protocol}: ${name}`, async (context) => {
            const f = await fixture(context);
            await f.write(metadataPath, JSON.stringify({ protocols: [{ protocol, ids }] }));
            const result = await f.run();
            assert.equal(result.code, 1, result.output);
            assert.match(result.output, /Add review/);
        });
    }
});

test("duplicate protocol errors retain the second protocol value line", async (t) => {
    const f = await fixture(t);
    await f.write(
        metadataPath,
        '{\n  "protocols": [\n    {"protocol": "mglobal", "ids": []},\n    {"protocol": "mglobal", "ids": []}\n  ]\n}\n',
    );
    const result = await f.run([metadataPath], { LOCAL_ACTION_RUN: "false" });
    assert.equal(result.code, 1, result.output);
    assert.equal(f.githubCalls.length, 1);
    assert.equal(f.githubCalls[0].body.comments[0].line, 4);
});

test("schema rejects malformed metadata with PR feedback", async (t) => {
    const info = (entry) => ({ protocols: [entry] });
    const cases = [
        ["boolean ids", info({ protocol: "mglobal", ids: true })],
        ["string ids", info({ protocol: "mglobal", ids: vault })],
        ["null ids", info({ protocol: "mglobal", ids: null })],
        ["uppercase name", info({ protocol: "mGLOBAL", ids: [] })],
        ["unknown lowercase name", info({ protocol: "unknown_protocol", ids: [] })],
        ["hyphenated name", info({ protocol: "morpho-vaultv2", ids: [] })],
        ["empty name", info({ protocol: "", ids: [] })],
        ["short address", info({ protocol: "morpho_vaultv2", ids: ["0x123"] })],
        ["non-hex address", info({ protocol: "morpho_vaultv2", ids: [`0x${"z".repeat(40)}`] })],
        ["number target", info({ protocol: "morpho_blue", ids: [123] })],
        ["vault cannot use a market ID", info({ protocol: "morpho_vaultv2", ids: [marketId] })],
        ["pool cannot use a market ID", info({ protocol: "aave_v3", ids: [marketId] })],
        ["Blue requires a market ID", info({ protocol: "morpho_blue", ids: [vault] })],
        ["named product has no targets", info({ protocol: "mglobal", ids: [vault] })],
        ["3F discovers requests without supplied IDs", info({ protocol: "three_f", ids: [vault] })],
        ["Ember uses the canonical PPLUS binding", info({ protocol: "ember", ids: [vault] })],
        ["unlisted token contract", info({ protocol: "tokens", ids: [vault] })],
        ["token symbol is not an ID", info({ protocol: "tokens", ids: ["usdc"] })],
        ["token cannot use a market ID", info({ protocol: "tokens", ids: [marketId] })],
        ["duplicate token IDs", info({ protocol: "tokens", ids: [usdc, usdc] })],
        [
            "different-chain token contract",
            info({ protocol: "tokens", ids: ["0x833589fcd6edb6e08f4c7c32d4f71b54bda02913"] }),
        ],
        ["duplicate targets", info({ protocol: "morpho_vaultv2", ids: [vault, vault] })],
        ["array root", []],
        ["missing protocols", {}],
        ["legacy flat map", { mglobal: [] }],
        ["extra root field", { protocols: [], extra: [] }],
        ["protocols must be an array", { protocols: {} }],
        ["entry must be an object", { protocols: ["mglobal"] }],
        ["missing protocol name", info({ ids: [] })],
        ["missing ids", info({ protocol: "mglobal" })],
        ["old addresses field", info({ protocol: "mglobal", addresses: [] })],
        [
            "old addresses field alongside IDs",
            info({ protocol: "mglobal", ids: [], addresses: [] }),
        ],
        ["singular address field", info({ protocol: "mglobal", address: [] })],
        ["extra entry field", info({ protocol: "mglobal", ids: [], extra: true })],
        ["protocol must be a string", info({ protocol: 123, ids: [] })],
    ];

    for (const [name, metadata] of cases) {
        await t.test(name, async (context) => {
            const f = await fixture(context);
            await f.write(metadataPath, JSON.stringify(metadata, null, 4));
            const result = await f.run();
            assert.equal(result.code, 1, result.output);
            assert.match(result.output, /Add review/);
            assert.match(result.output, /info.json.*invalid/);
        });
    }
});

test("invalid protocol names are reported on their value line", async (t) => {
    const f = await fixture(t);
    await f.write(
        metadataPath,
        '{\n    "protocols": [{\n        "protocol": "Invalid_Name",\n        "ids": []\n    }]\n}\n',
    );
    const result = await f.run();
    assert.equal(result.code, 1, result.output);
    assert.match(result.output, /line: 3/);
});

test("invalid JSON receives a PR comment", async (t) => {
    const f = await fixture(t);
    await f.write(metadataPath, '{"mglobal", "morpho_vaultv2": []}');
    const result = await f.run();
    assert.equal(result.code, 1, result.output);
    assert.match(result.output, /Add Comment/);
    assert.match(result.output, /not valid JSON/);
});

test("folders accept only info.json at the adapter address", async (t) => {
    const cases = [
        ["logo", `merkle-adapters/${adapter}/logo.png`],
        ["extra file", `merkle-adapters/${adapter}/extra.json`],
        ["nested file", `merkle-adapters/${adapter}/info.json/extra.json`],
        ["name identifier", "merkle-adapters/my-adapter/info.json"],
        ["short identifier", "merkle-adapters/0x123/info.json"],
    ];

    for (const [name, changedPath] of cases) {
        await t.test(name, async (context) => {
            const f = await fixture(context);
            const result = await f.run([changedPath]);
            assert.equal(result.code, 1, result.output);
            assert.match(result.output, /Add Comment/);
            assert.match(result.output, /not allowed/);
            assert.equal(f.calls.length, 0);
        });
    }
});

test("pre-existing logos are rejected when only metadata changes", async (t) => {
    const f = await fixture(t);
    await f.write(metadataPath, JSON.stringify(emptyInfo));
    await f.write(`merkle-adapters/${adapter}/logo.png`, "not a logo");
    const result = await f.run();
    assert.equal(result.code, 1, result.output);
    assert.match(result.output, /only `info.json`/);
    assert.match(result.output, /Add Comment/);
    assert.equal(f.calls.length, 0);
});

test("info.json must be a regular file", async (t) => {
    const f = await fixture(t);
    await mkdir(path.join(f.cwd, metadataPath), { recursive: true });
    const result = await f.run();
    assert.equal(result.code, 1, result.output);
    assert.match(result.output, /Add Comment/);
    assert.match(result.output, /info.json.*not found/);
    assert.equal(f.calls.length, 0);
});

test("multiple adapter folders are rejected", async (t) => {
    const f = await fixture(t);
    const result = await f.run([metadataPath, `merkle-adapters/${vault}/info.json`]);
    assert.equal(result.code, 1, result.output);
    assert.match(result.output, /Several entities/);
    assert.match(result.output, /Add Comment/);
    assert.equal(f.calls.length, 0);
});

test("unregistered adapter is rejected with a PR comment", async (t) => {
    const f = await fixture(t);
    f.state.registered = false;
    await f.write(metadataPath, JSON.stringify(emptyInfo));
    const result = await f.run();
    assert.equal(result.code, 1, result.output);
    assert.match(result.output, /not registered in adapter registry/);
    assert.match(result.output, /Add Comment/);
    assert.equal(f.calls.length, 1);
});

test("deleted adapter metadata skips registry and schema validation", async (t) => {
    const f = await fixture(t);
    const result = await f.run();
    assert.equal(result.code, 0, result.output);
    assert.equal(f.calls.length, 0);
});

test("ordinary adapters retain metadata, registry, and logo behavior", async (t) => {
    const f = await fixture(t);
    const legacyPath = `adapters/${adapter}/info.json`;
    await f.write(
        legacyPath,
        JSON.stringify({ name: "Adapter", description: "Example", links: [] }),
    );
    await f.write(`adapters/${adapter}/logo.png`, "unchanged logo");
    const result = await f.run([legacyPath]);
    assert.equal(result.code, 0, result.output);
    assert.equal(f.calls.length, 1);

    await f.write(legacyPath, JSON.stringify(emptyInfo));
    const invalid = await f.run([legacyPath]);
    assert.equal(invalid.code, 1, invalid.output);
    assert.match(invalid.output, /Add review/);
});

test("updated image decoder accepts a 256x256 PNG", async (t) => {
    const f = await fixture(t);
    const infoPath = `adapters/${adapter}/info.json`;
    const logoPath = `adapters/${adapter}/logo.png`;
    await f.write(infoPath, JSON.stringify({ name: "Adapter", description: "Example", links: [] }));
    await f.write(logoPath, encodePng(new Image(256, 256)));
    const result = await f.run([logoPath]);
    assert.equal(result.code, 0, result.output);
});

test("updated image decoder retains dimension and file-size rejection", async (t) => {
    const cases = [
        [new Image(64, 256), /Current size is 64x256/],
        [new Image(256, 64), /Current size is 256x64/],
        [new Image(256, 256, { data: randomBytes(256 * 256 * 3) }), /maximum size is 100KB/],
    ];
    for (const [image, error] of cases) {
        await t.test(error.source, async (context) => {
            const f = await fixture(context);
            const infoPath = `adapters/${adapter}/info.json`;
            const logoPath = `adapters/${adapter}/logo.png`;
            await f.write(
                infoPath,
                JSON.stringify({ name: "Adapter", description: "Example", links: [] }),
            );
            await f.write(logoPath, encodePng(image));
            const result = await f.run([logoPath]);
            assert.equal(result.code, 1, result.output);
            assert.match(result.output, /Add Comment/);
            assert.match(result.output, error);
        });
    }
});

test("updated Actions SDK sends inline schema feedback through the GitHub API", async (t) => {
    const f = await fixture(t);
    await f.write(
        metadataPath,
        JSON.stringify({ protocols: [{ protocol: "mglobal", ids: [vault] }] }),
    );
    const result = await f.run([metadataPath], { LOCAL_ACTION_RUN: "false" });
    assert.equal(result.code, 1, result.output);
    assert.equal(f.githubCalls.length, 1);
    assert.equal(f.githubCalls[0].method, "POST");
    assert.equal(f.githubCalls[0].url, "/repos/symbioticfi/metadata-mainnet/pulls/1/reviews");
    assert.equal(f.githubCalls[0].body.event, "COMMENT");
    assert.equal(f.githubCalls[0].body.comments[0].path, metadataPath);
    assert.equal(f.githubCalls[0].body.comments[0].line, 1);
});

test("updated Actions SDK sends registry errors through the GitHub API", async (t) => {
    const f = await fixture(t);
    f.state.registered = false;
    await f.write(metadataPath, JSON.stringify(emptyInfo));
    const result = await f.run([metadataPath], { LOCAL_ACTION_RUN: "false" });
    assert.equal(result.code, 1, result.output);
    assert.equal(f.githubCalls.length, 1);
    assert.equal(f.githubCalls[0].method, "POST");
    assert.equal(f.githubCalls[0].url, "/repos/symbioticfi/metadata-mainnet/issues/1/comments");
    assert.match(f.githubCalls[0].body.body, /not registered/);
});

test("full-info export preserves integration arrays and omits Merkle logos", async (t) => {
    const f = await fixture(t);
    const info = {
        protocols: [
            { protocol: "aa_falconxusdc", ids: [] },
            { protocol: "mglobal", ids: [] },
            { protocol: "morpho_vaultv2", ids: [vault] },
            { protocol: "morpho_blue", ids: [marketId] },
            { protocol: "euler", ids: [vault], subaccounts: [0, 255] },
            { protocol: "tokens", ids: [usdc] },
        ],
    };
    const legacyInfo = { name: "Adapter", description: "Example", links: [] };
    await f.write(metadataPath, JSON.stringify(info));
    await f.write(`merkle-adapters/${adapter}/logo.png`, "stray logo");
    await f.write(`adapters/${adapter}/info.json`, JSON.stringify(legacyInfo));
    await f.write(`adapters/${adapter}/logo.png`, "legacy logo");
    const result = await f.extract();
    assert.equal(result.code, 0, result.output);
    const output = JSON.parse(await readFile(path.join(f.cwd, "full-info.json"), "utf8"));
    assert.deepEqual(output["merkle-adapters"][adapter], { info });
    assert.deepEqual(output.adapters[adapter].info, legacyInfo);
    assert.match(output.adapters[adapter].logo, /\/adapters\/0x[0-9a-f]{40}\/logo\.png$/);
});

const aaveV3Ids = ["core", "etherfi", "lido", "horizon"];
const aaveV4Ids = [
    "0x973a023a77420ba610f06b3858ad991df6d85a08",
    "0x58131e79531cab1d52301228d1f7b842f26b9649",
    "0xba1b3d55d249692b669a164024a838309b7508af",
    "0xd8b93635b8c6d0ff98cbe90b5988e3f2d1cd9da1",
    "0x65407b940966954b23dfa3caa5c0702bb42984dc",
    "0x7ec68b5695e803e98a21a9a05d744f28b0a7753d",
    "0x94e7a5dcbe816e498b89ab752661904e2f56c485",
    "0x956d8e0a89cfa3744428c4641b5a53b56167a7f9",
    "0xbf10bdfe177de0336afd7fccf80a904e15386219",
    "0x3131fe68c4722e726fe6b2819ed68e514395b9a4",
    "0xe1900480ac69f0b296841cd01cc37546d92f35cd",
    "0x774b9655413c34809c1f1b16b654465a89ebe989",
];

test("Aave metadata admits only reviewed market names and user-position spokes", async (t) => {
    const f = await fixture(t);
    for (const protocols of [
        [{ protocol: "aave_v3", ids: ["core", "horizon"] }],
        [{ protocol: "aave_v3", ids: aaveV3Ids }],
        [{ protocol: "aave_v4", ids: aaveV4Ids }],
        [{ protocol: "aave_v4", ids: ["0x" + aaveV4Ids[0].slice(2).toUpperCase()] }],
    ]) {
        await f.write(metadataPath, JSON.stringify({ protocols }));
        const result = await f.run();
        assert.equal(result.code, 0, result.output);
    }
    assert.deepEqual(allowlist.aave_v3.allowedIds, aaveV3Ids);
    assert.deepEqual(allowlist.aave_v4.allowedIds, aaveV4Ids);
});

test("Aave metadata rejects aliases, omitted or invalid IDs, and subaccounts", async (t) => {
    const f = await fixture(t);
    const cases = [
        { protocol: "aave_v3", ids: [vault] },
        { protocol: "aave_v3", ids: ["ethereum"] },
        { protocol: "aave_v3", ids: ["Core"] },
        { protocol: "aave_v3", ids: ["core", "core"] },
        { protocol: "aave_v4", ids: [aaveV4Ids[0], "0x" + aaveV4Ids[0].slice(2).toUpperCase()] },
        { protocol: "aave_v4", ids: [vault] },
        { protocol: "aave_v4", ids: ["0xB9B0b8616f6Bf6841972a52058132BE08d723155"] },
        { protocol: "aave_v4", ids: ["0x" + "0".repeat(40)] },
        // A V3 pool is not a V4 ISpoke user-position deployment.
        { protocol: "aave_v4", ids: ["0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2"] },
        ...["aave_v3", "aave_v4"].flatMap((protocol) => [
            { protocol },
            { protocol, ids: [] },
            { protocol, ids: null },
            { protocol, ids: "core" },
            { protocol, ids: [protocol === "aave_v3" ? "core" : aaveV4Ids[0]], subaccounts: [0] },
        ]),
    ];
    for (const entry of cases) {
        await f.write(metadataPath, JSON.stringify({ protocols: [entry] }));
        const result = await f.run();
        assert.equal(result.code, 1, JSON.stringify(entry) + result.output);
        assert.match(result.output, /info.json.*invalid/);
    }
});
