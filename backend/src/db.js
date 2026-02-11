import initSqlJs from 'sql.js';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const defaultDbPath = path.resolve(__dirname, '..', 'data', 'plants.sqlite');
const configuredPath = process.env.DATABASE_PATH
  ? path.resolve(__dirname, '..', process.env.DATABASE_PATH)
  : defaultDbPath;
const dbDir = path.dirname(configuredPath);

const SQLPromise = initSqlJs({
  locateFile: (file) => path.resolve(__dirname, '..', 'node_modules', 'sql.js', 'dist', file)
});

let databasePromise;

async function getDatabase() {
  if (!databasePromise) {
    databasePromise = (async () => {
      const SQL = await SQLPromise;
      await fs.mkdir(dbDir, { recursive: true });

      let fileBuffer;
      try {
        fileBuffer = await fs.readFile(configuredPath);
      } catch (error) {
        if (error.code !== 'ENOENT') {
          throw error;
        }
      }

      const db = fileBuffer ? new SQL.Database(fileBuffer) : new SQL.Database();
      db.run(`
        CREATE TABLE IF NOT EXISTS plants (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          species TEXT NOT NULL,
          watering_interval_days INTEGER NOT NULL,
          last_watered_at TEXT,
          notes TEXT NOT NULL DEFAULT '',
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      return db;
    })();
  }

  return databasePromise;
}

async function persistDatabase(db) {
  const data = db.export();
  await fs.writeFile(configuredPath, Buffer.from(data));
}

export async function listPlants({ filter }) {
  const db = await getDatabase();
  let query = `
    SELECT
      id,
      name,
      species,
      watering_interval_days,
      last_watered_at,
      notes,
      created_at
    FROM plants
  `;
  if (filter === 'due') {
    query += `
      WHERE
        last_watered_at IS NULL
        OR datetime(last_watered_at, '+' || watering_interval_days || ' days') <= datetime('now')
    `;
  } else if (filter === 'upcoming') {
    query += `
      WHERE
        last_watered_at IS NOT NULL
        AND datetime(last_watered_at, '+' || watering_interval_days || ' days') > datetime('now')
    `;
  }
  query += ' ORDER BY created_at DESC, id DESC';

  const statement = db.prepare(query);
  const plants = [];
  while (statement.step()) {
    plants.push(mapRow(statement.getAsObject()));
  }
  statement.free();
  return plants;
}

export async function createPlant({
  name,
  species,
  wateringIntervalDays,
  lastWateredAt,
  notes
}) {
  const db = await getDatabase();
  db.run(
    `
      INSERT INTO plants (
        name,
        species,
        watering_interval_days,
        last_watered_at,
        notes
      )
      VALUES (?, ?, ?, ?, ?)
    `,
    [name, species, wateringIntervalDays, lastWateredAt, notes]
  );
  const idResult = db.exec('SELECT last_insert_rowid() AS id');
  await persistDatabase(db);
  const id = idResult[0]?.values?.[0]?.[0];
  return id ? getPlant(id) : null;
}

export async function getPlant(id) {
  const db = await getDatabase();
  const statement = db.prepare(
    `
      SELECT
        id,
        name,
        species,
        watering_interval_days,
        last_watered_at,
        notes,
        created_at
      FROM plants
      WHERE id = ?
    `
  );
  statement.bind([id]);
  const plant = statement.step() ? mapRow(statement.getAsObject()) : null;
  statement.free();
  return plant;
}

export async function updatePlant(id, updates) {
  const existing = await getPlant(id);
  if (!existing) {
    return null;
  }

  const db = await getDatabase();
  const nextName =
    typeof updates.name === 'string' && updates.name.length ? updates.name : existing.name;
  const nextSpecies =
    typeof updates.species === 'string' && updates.species.length ? updates.species : existing.species;
  const nextWateringIntervalDays = Number.isInteger(updates.wateringIntervalDays)
    ? updates.wateringIntervalDays
    : existing.wateringIntervalDays;
  const nextLastWateredAt =
    typeof updates.lastWateredAt === 'string' || updates.lastWateredAt === null
      ? updates.lastWateredAt
      : existing.lastWateredAt;
  const nextNotes = typeof updates.notes === 'string' ? updates.notes : existing.notes;

  db.run(
    `
      UPDATE plants
      SET
        name = ?,
        species = ?,
        watering_interval_days = ?,
        last_watered_at = ?,
        notes = ?
      WHERE id = ?
    `,
    [nextName, nextSpecies, nextWateringIntervalDays, nextLastWateredAt, nextNotes, id]
  );

  if (db.getRowsModified() > 0) {
    await persistDatabase(db);
  }

  return getPlant(id);
}

export async function deletePlant(id) {
  const db = await getDatabase();
  db.run('DELETE FROM plants WHERE id = ?', [id]);
  const removed = db.getRowsModified() > 0;
  if (removed) {
    await persistDatabase(db);
  }
  return removed;
}

const mapRow = (row) => ({
  id: row.id,
  name: row.name,
  species: row.species,
  wateringIntervalDays: row.watering_interval_days,
  lastWateredAt: row.last_watered_at,
  notes: row.notes,
  createdAt: row.created_at,
  nextWateringDueAt: nextWateringDueAt(row.last_watered_at, row.watering_interval_days)
});

function nextWateringDueAt(lastWateredAt, wateringIntervalDays) {
  if (!lastWateredAt) return null;
  const last = new Date(lastWateredAt);
  if (Number.isNaN(last.getTime())) return null;
  last.setDate(last.getDate() + Number(wateringIntervalDays));
  return last.toISOString();
}
