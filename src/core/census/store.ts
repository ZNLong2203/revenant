/**
 * Where a census keeps its progress when it runs on a machine with a disk:
 * one JSON file per run in `.revenant/census/`. Server-only.
 *
 * The hosted app does not use this. A serverless function cannot outlive a
 * request, so there the browser drives the run and keeps it in localStorage.
 */
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { parseCensusRun, type CensusRun } from "./types";

export const censusDir = () => resolve(process.env.REVENANT_CENSUS_DIR ?? ".revenant/census");

const ID = /^[\w-]{1,80}$/;

function pathFor(id: string, dir: string): string {
  if (!ID.test(id)) throw new Error(`"${id}" is not a census run id.`);
  return join(dir, `${id}.json`);
}

/** Write the run so a crash never leaves half a file: write aside, then rename over. */
export async function saveRun(run: CensusRun, dir = censusDir()): Promise<string> {
  const path = pathFor(run.id, dir);
  await mkdir(dir, { recursive: true });
  await writeFile(`${path}.tmp`, JSON.stringify(run));
  await rename(`${path}.tmp`, path);
  return path;
}

export async function loadRun(id: string, dir = censusDir()): Promise<CensusRun> {
  const path = pathFor(id, dir);
  let text: string;
  try {
    text = await readFile(path, "utf8");
  } catch {
    throw new Error(`No saved census called "${id}" in ${dir}.`);
  }
  return parseCensusRun(JSON.parse(text));
}
