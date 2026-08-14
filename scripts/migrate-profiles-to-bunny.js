#!/usr/bin/env node
/**
 * One-off migration: push every file in public/images/profiles to the BunnyCDN
 * storage zone and write the SQL that repoints the stored URLs at the CDN.
 *
 * Nothing is uploaded and no SQL is written until --apply is passed. The dry run
 * reports exactly what the real run would do.
 *
 * Re-running is safe: a file already in the storage zone with the same size is
 * skipped, and the SQL matches on the old URL, so a row that was migrated
 * already no longer matches.
 *
 *   node scripts/migrate-profiles-to-bunny.js
 *   node scripts/migrate-profiles-to-bunny.js --apply --out migrate-profiles.sql
 *
 * Options:
 *   --apply                 Really upload and write the SQL file.
 *   --out <path>            SQL output path (default: migrate-profiles.sql).
 *   --table <name>          Table holding the profile URLs (default: users).
 *   --columns <a,b>         Columns to rewrite (default: picture,background).
 *   --old-base <url>        Base of the URLs currently stored
 *                           (default: <project.url>/images/profiles).
 *   --dir <path>            Directory to migrate (default: public/images/profiles).
 *   --concurrency <n>       Parallel uploads (default: 4).
 *   --force                 Re-upload even when the file is already there.
 *   --config <path>         Config to read (default: config/config.json).
 */
const fs = require("fs");
const path = require("path");

const CONFIG_FLAG = process.argv.indexOf("--config");
const config = require(CONFIG_FLAG === -1 ? path.join(__dirname, "..", "config", "config.json") : path.resolve(process.argv[CONFIG_FLAG + 1]));

const UPLOAD_TIMEOUT_MS = 60000;
const LIST_TIMEOUT_MS = 30000;
const RETRIES = 3;

const parseArgs = (argv) => {
  const opts = {
    apply: false,
    force: false,
    out: "migrate-profiles.sql",
    table: "users",
    columns: ["picture", "background"],
    dir: path.join(__dirname, "..", "public", "images", "profiles"),
    concurrency: 4,
    oldBase: null,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    const next = () => {
      const value = argv[++i];
      if (value === undefined) throw new Error(`${arg} needs a value`);
      return value;
    };
    if (arg === "--apply") opts.apply = true;
    else if (arg === "--force") opts.force = true;
    else if (arg === "--out") opts.out = next();
    else if (arg === "--table") opts.table = next();
    else if (arg === "--columns") opts.columns = next().split(",").map((c) => c.trim()).filter(Boolean);
    else if (arg === "--old-base") opts.oldBase = next().replace(/\/+$/, "");
    else if (arg === "--dir") opts.dir = path.resolve(next());
    else if (arg === "--concurrency") opts.concurrency = Math.max(1, parseInt(next(), 10) || 1);
    else if (arg === "--config") next();
    else if (arg === "--help" || arg === "-h") opts.help = true;
    else throw new Error(`Unknown option: ${arg}`);
  }
  return opts;
};

// The storage zone rejects a name with a slash in it, and a name that reaches
// outside the directory has no business being uploaded either.
const SAFE_NAME = /^[A-Za-z0-9._-]+$/;

const assertConfig = () => {
  const missing = ["endpoint", "storageZone", "accessKey"].filter((key) => !config.bunny?.[key]);
  if (missing.length) throw new Error(`Missing BunnyCDN storage config: bunny.${missing.join(", bunny.")}`);
  if (!config.project?.cdn) throw new Error("Missing project.cdn");
  if (!config.project?.url) throw new Error("Missing project.url");
};

const bunnyPath = String(config.bunny.path ?? "profiles").replace(/^\/+|\/+$/g, "");
const storageHost = /^https?:\/\//.test(config.bunny.endpoint) ? config.bunny.endpoint.replace(/\/+$/, "") : `https://${config.bunny.endpoint}`;
const storageDirUrl = `${storageHost}/${config.bunny.storageZone}/${bunnyPath}/`;
const storageUrl = (name) => `${storageDirUrl}${encodeURIComponent(name)}`;
const publicUrl = (name) => `${config.project.cdn}/${bunnyPath}/${name}`;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Retries a network error or a 5xx, which are the failures worth trying again.
// A 4xx is the storage zone saying no, and repeating it would say the same.
const withRetry = async (label, fn) => {
  let lastErr;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const response = await fn();
      if (response.status >= 500) throw new Error(`responded with ${response.status}`);
      return response;
    } catch (err) {
      lastErr = err;
      if (attempt < RETRIES) await sleep(500 * attempt);
    }
  }
  throw new Error(`${label} failed after ${RETRIES} attempts: ${lastErr.message}`);
};

/** Names already in the storage zone, mapped to their size. */
const listRemote = async () => {
  const response = await withRetry("Listing the storage zone", () =>
    fetch(storageDirUrl, {
      headers: { AccessKey: config.bunny.accessKey, Accept: "application/json" },
      signal: AbortSignal.timeout(LIST_TIMEOUT_MS),
    }),
  );
  // An empty directory that was never written answers 404.
  if (response.status === 404) return new Map();
  if (!response.ok) throw new Error(`Listing the storage zone responded with ${response.status}`);
  const entries = await response.json();
  return new Map(entries.filter((e) => !e.IsDirectory).map((e) => [e.ObjectName, e.Length]));
};

const upload = async (name, filePath) => {
  const body = fs.readFileSync(filePath);
  const response = await withRetry(`Uploading ${name}`, () =>
    fetch(storageUrl(name), {
      method: "PUT",
      headers: {
        AccessKey: config.bunny.accessKey,
        "Content-Type": "application/octet-stream",
      },
      body,
      signal: AbortSignal.timeout(UPLOAD_TIMEOUT_MS),
    }),
  );
  if (!response.ok) throw new Error(`Uploading ${name} responded with ${response.status}`);
};

const sqlString = (value) => `'${String(value).replace(/\\/g, "\\\\").replace(/'/g, "''")}'`;

const buildSql = (opts, names) => {
  const oldBase = opts.oldBase ?? `${config.project.url}/images/profiles`;
  const lines = [
    "-- Repoints the profile image URLs at the CDN.",
    "-- Generated by scripts/migrate-profiles-to-bunny.js",
    `-- Files uploaded to ${storageDirUrl}`,
    "-- Every statement matches on the old URL, so re-running changes nothing.",
    "",
    "START TRANSACTION;",
    "",
  ];
  for (const column of opts.columns) {
    lines.push(`-- ${opts.table}.${column}`);
    for (const name of names) {
      const from = `${oldBase}/${name}`;
      lines.push(`UPDATE ${opts.table} SET ${column} = ${sqlString(publicUrl(name))} WHERE ${column} = ${sqlString(from)};`);
    }
    lines.push("");
  }
  lines.push("-- Rows still pointing at the old location after this ran (0 unless an upload failed):");
  for (const column of opts.columns) {
    lines.push(`SELECT COUNT(*) AS remaining_${column} FROM ${opts.table} WHERE ${column} LIKE ${sqlString(`${oldBase}/%`)};`);
  }
  lines.push("", "COMMIT;", "");
  return lines.join("\n");
};

const runPool = async (items, concurrency, worker) => {
  let index = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const item = items[index++];
      await worker(item);
    }
  });
  await Promise.all(runners);
};

const main = async () => {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.help) {
    console.log(fs.readFileSync(__filename, "utf8").split("*/")[0].replace(/^#![^\n]*\n/, ""));
    return;
  }

  assertConfig();

  if (!fs.existsSync(opts.dir)) {
    console.log(`Nothing to do: ${opts.dir} does not exist.`);
    return;
  }

  const entries = fs.readdirSync(opts.dir, { withFileTypes: true });
  const skipped = [];
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile()) {
      skipped.push([entry.name, entry.isDirectory() ? "is a directory" : "is not a regular file"]);
      continue;
    }
    if (entry.name.startsWith(".")) {
      skipped.push([entry.name, "hidden file"]);
      continue;
    }
    if (!SAFE_NAME.test(entry.name)) {
      skipped.push([entry.name, "unsafe file name"]);
      continue;
    }
    files.push(entry.name);
  }
  files.sort();

  console.log(`Source     : ${opts.dir}`);
  console.log(`Storage    : ${storageDirUrl}`);
  console.log(`Public URL : ${publicUrl("<file>")}`);
  console.log(`Files      : ${files.length}${skipped.length ? ` (${skipped.length} skipped)` : ""}`);
  for (const [name, reason] of skipped) console.log(`  skip ${name} -- ${reason}`);
  if (files.length === 0) {
    console.log("Nothing to upload.");
    return;
  }

  const remote = await listRemote();
  const pending = [];
  const alreadyThere = [];
  for (const name of files) {
    const localSize = fs.statSync(path.join(opts.dir, name)).size;
    const remoteSize = remote.get(name);
    if (!opts.force && remoteSize === localSize) alreadyThere.push(name);
    else pending.push(name);
  }

  console.log(`To upload  : ${pending.length}`);
  console.log(`Already up : ${alreadyThere.length}`);

  if (!opts.apply) {
    console.log("");
    console.log("Dry run. Nothing was uploaded and no SQL was written.");
    console.log(`Re-run with --apply to upload ${pending.length} file(s) and write ${opts.out}.`);
    console.log("");
    console.log("SQL preview:");
    console.log(
      buildSql(opts, files.slice(0, 3))
        .split("\n")
        .map((line) => `  ${line}`)
        .join("\n"),
    );
    if (files.length > 3) console.log(`  ... ${files.length - 3} more file(s)`);
    return;
  }

  const failed = [];
  let uploaded = 0;
  await runPool(pending, opts.concurrency, async (name) => {
    try {
      await upload(name, path.join(opts.dir, name));
      uploaded++;
      console.log(`  uploaded ${name} (${uploaded}/${pending.length})`);
    } catch (err) {
      failed.push([name, err.message]);
      console.error(`  FAILED   ${name}: ${err.message}`);
    }
  });

  // A row must not be repointed at a file that is not there, so the SQL only
  // covers what is confirmed to be in the storage zone.
  const after = await listRemote();
  const migrated = files.filter((name) => after.has(name));
  const missing = files.filter((name) => !after.has(name));

  const outPath = path.resolve(opts.out);
  fs.writeFileSync(outPath, buildSql(opts, migrated), "utf8");

  console.log("");
  console.log(`Uploaded   : ${uploaded}`);
  console.log(`In storage : ${migrated.length}/${files.length}`);
  console.log(`SQL        : ${outPath} (${migrated.length} file(s) x ${opts.columns.length} column(s))`);
  if (missing.length) {
    console.log(`Missing    : ${missing.length} -- left out of the SQL`);
    for (const name of missing) console.log(`  ${name}`);
  }
  if (failed.length) {
    console.log(`Failed     : ${failed.length}`);
    process.exitCode = 1;
  }
  console.log("");
  console.log("Review the SQL, then run it against the backend database.");
  console.log("Keep the local files until the CDN URLs are confirmed to serve.");
};

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
