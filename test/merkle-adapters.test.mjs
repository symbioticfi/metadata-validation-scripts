import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const actionPath = fileURLToPath(new URL("../dist/index.cjs", import.meta.url));
const extractorPath = fileURLToPath(
    new URL("../.github/workflows/scripts/extract-metadata.ts", import.meta.url),
);
const adapter = "0x1111111111111111111111111111111111111111";
const registry = "0x2222222222222222222222222222222222222222";
const vault = "0x3333333333333333333333333333333333333333";
const marketId = `0x${"ab".repeat(32)}`;
const metadataPath = `merkle-adapters/${adapter}/info.json`;

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
    const state = { registered: true };
    const server = createServer(async (request, response) => {
        let body = "";
        for await (const chunk of request) {
            body += chunk;
        }
        const call = JSON.parse(body);
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
        state,
        write: async (file, content) => {
            const fullPath = path.join(cwd, file);
            await mkdir(path.dirname(fullPath), { recursive: true });
            await writeFile(fullPath, content);
        },
        run: (files = [metadataPath]) =>
            execute([actionPath], { cwd, env: { ...env, INPUT_FILES: files.join(" ") } }),
        extract: () => execute(["--experimental-transform-types", extractorPath], { cwd, env }),
    };
}

test("bundled action accepts name-only RWAs, vaults, pools, and bytes32 markets", async (t) => {
    const f = await fixture(t);
    await f.write(
        metadataPath,
        JSON.stringify({
            aa_falconxusdc: [],
            mglobal: [],
            morpho_vaultv2: [vault, adapter],
            morpho_blue: [marketId],
            aave_v3: [vault],
            euler: [vault],
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
    await f.write(metadataPath, "{}");
    const result = await f.run();
    assert.equal(result.code, 0, result.output);
});

test("schema rejects malformed metadata with PR feedback", async (t) => {
    const cases = [
        ["boolean entry", { mglobal: true }],
        ["string entry", { mglobal: vault }],
        ["null entry", { mglobal: null }],
        ["uppercase name", { mGLOBAL: [] }],
        ["hyphenated name", { "morpho-vaultv2": [] }],
        ["empty name", { "": [] }],
        ["short address", { morpho_vaultv2: ["0x123"] }],
        ["non-hex address", { morpho_vaultv2: [`0x${"z".repeat(40)}`] }],
        ["number target", { morpho_blue: [123] }],
        ["duplicate targets", { morpho_vaultv2: [vault, vault] }],
        ["array root", []],
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

test("invalid protocol names are reported on their key line", async (t) => {
    const f = await fixture(t);
    await f.write(metadataPath, '{\n    "mglobal": [],\n    "Invalid_Name": []\n}\n');
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
    await f.write(metadataPath, "{}");
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
    await f.write(metadataPath, "{}");
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

    await f.write(legacyPath, JSON.stringify({ mglobal: [] }));
    const invalid = await f.run([legacyPath]);
    assert.equal(invalid.code, 1, invalid.output);
    assert.match(invalid.output, /Add review/);
});

test("full-info export preserves integration arrays and omits Merkle logos", async (t) => {
    const f = await fixture(t);
    const info = {
        aa_falconxusdc: [],
        mglobal: [],
        morpho_vaultv2: [vault],
        morpho_blue: [marketId],
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
