import cors from 'cors';
import dotenv from 'dotenv';
import express from 'express';
import {
  createPlant,
  deletePlant,
  listPlants,
  updatePlant
} from './db.js';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT) || 4000;

app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.get('/plants', async (req, res, next) => {
  try {
    const filter = typeof req.query.filter === 'string' ? req.query.filter.toLowerCase() : undefined;
    const plants = await listPlants({ filter });
    res.json(plants);
  } catch (error) {
    next(error);
  }
});

app.post('/plants', async (req, res, next) => {
  try {
    const name = formatText(req.body?.name);
    const species = formatText(req.body?.species);
    const wateringIntervalDays = parseInterval(req.body?.wateringIntervalDays);
    const notes = formatNotes(req.body?.notes);
    const lastWateredAt = parseDateOrNull(req.body?.lastWateredAt);

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    if (!species) {
      return res.status(400).json({ error: 'Species is required' });
    }
    if (!wateringIntervalDays) {
      return res.status(400).json({ error: 'wateringIntervalDays must be between 1 and 365' });
    }
    if (lastWateredAt === undefined) {
      return res.status(400).json({ error: 'lastWateredAt must be a valid date or null' });
    }

    const plant = await createPlant({
      name,
      species,
      wateringIntervalDays,
      lastWateredAt,
      notes
    });
    if (!plant) {
      return res.status(500).json({ error: 'Could not create plant' });
    }
    res.status(201).json(plant);
  } catch (error) {
    next(error);
  }
});

app.put('/plants/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const name = formatText(req.body?.name);
    const species = formatText(req.body?.species);
    const wateringIntervalDays = parseInterval(req.body?.wateringIntervalDays);
    const notes = formatNotes(req.body?.notes);
    const lastWateredAt = parseDateOrNull(req.body?.lastWateredAt);

    if (!name || !species || !wateringIntervalDays) {
      return res.status(400).json({ error: 'name, species, and wateringIntervalDays are required' });
    }
    if (lastWateredAt === undefined) {
      return res.status(400).json({ error: 'lastWateredAt must be a valid date or null' });
    }

    const updated = await updatePlant(id, {
      name,
      species,
      wateringIntervalDays,
      lastWateredAt,
      notes
    });
    if (!updated) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

app.patch('/plants/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const payload = {};
    if (typeof req.body?.name === 'string') {
      const name = formatText(req.body.name);
      if (!name) {
        return res.status(400).json({ error: 'Name cannot be empty' });
      }
      payload.name = name;
    }
    if (typeof req.body?.species === 'string') {
      const species = formatText(req.body.species);
      if (!species) {
        return res.status(400).json({ error: 'Species cannot be empty' });
      }
      payload.species = species;
    }
    if (typeof req.body?.wateringIntervalDays !== 'undefined') {
      const wateringIntervalDays = parseInterval(req.body.wateringIntervalDays);
      if (!wateringIntervalDays) {
        return res.status(400).json({ error: 'wateringIntervalDays must be between 1 and 365' });
      }
      payload.wateringIntervalDays = wateringIntervalDays;
    }
    if (typeof req.body?.notes !== 'undefined') {
      payload.notes = formatNotes(req.body.notes);
    }
    if (Object.prototype.hasOwnProperty.call(req.body ?? {}, 'lastWateredAt')) {
      const lastWateredAt = parseDateOrNull(req.body.lastWateredAt);
      if (lastWateredAt === undefined) {
        return res.status(400).json({ error: 'lastWateredAt must be a valid date or null' });
      }
      payload.lastWateredAt = lastWateredAt;
    }

    if (!Object.keys(payload).length) {
      return res.status(400).json({ error: 'Nothing to update' });
    }

    const updated = await updatePlant(id, payload);
    if (!updated) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    res.json(updated);
  } catch (error) {
    next(error);
  }
});

app.delete('/plants/:id', async (req, res, next) => {
  try {
    const id = parseId(req.params.id);
    if (!id) {
      return res.status(400).json({ error: 'Invalid id' });
    }

    const removed = await deletePlant(id);
    if (!removed) {
      return res.status(404).json({ error: 'Plant not found' });
    }

    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Unexpected server error' });
});

app.listen(PORT, () => {
  console.log(`API listening on http://localhost:${PORT}`);
});

function formatText(raw) {
  if (typeof raw !== 'string') return '';
  const trimmed = raw.trim();
  return trimmed.length ? trimmed : '';
}

function parseId(raw) {
  const id = Number.parseInt(raw, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function parseInterval(raw) {
  const value = Number(raw);
  if (!Number.isInteger(value)) return null;
  return value >= 1 && value <= 365 ? value : null;
}

function parseDateOrNull(raw) {
  if (typeof raw === 'undefined') return null;
  if (raw === null || raw === '') return null;
  if (typeof raw !== 'string') return undefined;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function formatNotes(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim();
}
