import { readFile } from "node:fs/promises";
import { join } from "node:path";

const fixtureDir = join(process.cwd(), "fixtures");

export async function loadFixture<T>(fileName: string): Promise<T> {
  const fullPath = join(fixtureDir, fileName);
  const raw = await readFile(fullPath, "utf8");
  return JSON.parse(raw) as T;
}
