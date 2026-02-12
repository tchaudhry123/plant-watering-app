import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import './App.css';
import type { Plant, PlantFilter } from './api';
import { createPlant, deletePlant, fetchPlants, updatePlant } from './api';

type PlantDraft = {
  name: string;
  species: string;
  wateringIntervalDays: string;
  lastWateredAt: string;
  notes: string;
};

const FILTER_OPTIONS: { label: string; value: PlantFilter }[] = [
  { label: 'All', value: 'all' },
  { label: 'Due', value: 'due' },
  { label: 'Upcoming', value: 'upcoming' }
];

const emptyDraft: PlantDraft = {
  name: '',
  species: '',
  wateringIntervalDays: '7',
  lastWateredAt: '',
  notes: ''
};

function App() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [filter, setFilter] = useState<PlantFilter>('all');
  const [newPlant, setNewPlant] = useState<PlantDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingPlant, setEditingPlant] = useState<PlantDraft>(emptyDraft);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPlants = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchPlants(filter);
      setPlants(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load plants');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    loadPlants();
  }, [loadPlants]);

  const dueNowCount = useMemo(() => plants.filter((plant) => isDueNow(plant)).length, [plants]);
  const upcomingCount = useMemo(() => plants.length - dueNowCount, [plants, dueNowCount]);

  const handleCreatePlant = async (event: FormEvent) => {
    event.preventDefault();

    const parsed = validateDraft(newPlant);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    try {
      await createPlant(parsed.value);
      setNewPlant(emptyDraft);
      setError(null);
      await loadPlants();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add plant');
    }
  };

  const startEditing = (plant: Plant) => {
    setEditingId(plant.id);
    setEditingPlant({
      name: plant.name,
      species: plant.species,
      wateringIntervalDays: String(plant.wateringIntervalDays),
      lastWateredAt: toDateInputValue(plant.lastWateredAt),
      notes: plant.notes
    });
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingPlant(emptyDraft);
  };

  const saveEdit = async (id: number) => {
    const parsed = validateDraft(editingPlant);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    try {
      await updatePlant(id, parsed.value);
      setError(null);
      cancelEditing();
      await loadPlants();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update plant');
    }
  };

  const markWateredNow = async (plant: Plant) => {
    try {
      await updatePlant(plant.id, { lastWateredAt: new Date().toISOString() });
      setError(null);
      await loadPlants();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update watering date');
    }
  };

  const removePlant = async (plant: Plant) => {
    try {
      await deletePlant(plant.id);
      setError(null);
      await loadPlants();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete plant');
    }
  };

  return (
    <div className="app-shell">
      <main className="app">
        <header className="app__header">
          <p className="app__eyebrow">Plant Care Dashboard</p>
          <h1>Plant Watering App</h1>
          <p>Track watering dates, spot overdue plants fast, and keep your collection healthy.</p>
        </header>

        <section className="summary">
          <div className="summary__item">
            <span className="summary__value">{plants.length}</span>
            <span className="summary__label">Total</span>
          </div>
          <div className="summary__item summary__item--due">
            <span className="summary__value">{dueNowCount}</span>
            <span className="summary__label">Due</span>
          </div>
          <div className="summary__item">
            <span className="summary__value">{upcomingCount}</span>
            <span className="summary__label">Upcoming</span>
          </div>
        </section>

        <section className="card">
          <h2>Add Plant</h2>
          <form className="plant-form" onSubmit={handleCreatePlant}>
            <input
              aria-label="Plant name"
              placeholder="Plant name (e.g., Snake Plant)"
              value={newPlant.name}
              onChange={(event) => setNewPlant((prev) => ({ ...prev, name: event.target.value }))}
            />
            <input
              aria-label="Species"
              placeholder="Species"
              value={newPlant.species}
              onChange={(event) => setNewPlant((prev) => ({ ...prev, species: event.target.value }))}
            />
            <div className="form-row">
              <input
                aria-label="Watering interval in days"
                type="number"
                min={1}
                max={365}
                placeholder="Interval (days)"
                value={newPlant.wateringIntervalDays}
                onChange={(event) =>
                  setNewPlant((prev) => ({ ...prev, wateringIntervalDays: event.target.value }))
                }
              />
              <input
                aria-label="Last watered date"
                type="date"
                value={newPlant.lastWateredAt}
                onChange={(event) =>
                  setNewPlant((prev) => ({ ...prev, lastWateredAt: event.target.value }))
                }
              />
            </div>
            <textarea
              aria-label="Notes"
              placeholder="Notes (light, location, soil, etc.)"
              rows={3}
              value={newPlant.notes}
              onChange={(event) => setNewPlant((prev) => ({ ...prev, notes: event.target.value }))}
            />
            <button type="submit">Add Plant</button>
          </form>
        </section>

        <section className="filters" role="radiogroup" aria-label="Filter plants">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={option.value === filter ? 'active' : ''}
              onClick={() => setFilter(option.value)}
            >
              {option.label}
            </button>
          ))}
        </section>

        <section className="status-row">
          {loading && <span className="status status--loading">Loading...</span>}
          {error && <span className="status status--error">{error}</span>}
        </section>

        <section className="plant-list">
          {plants.map((plant) => {
            const due = dueLabel(plant);
            const isEditing = editingId === plant.id;

            return (
              <article key={plant.id} className="plant-card">
                <div className="plant-card__top">
                  <div>
                    <h3>{plant.name}</h3>
                    <p className="species">{plant.species}</p>
                  </div>
                  <span className={`badge badge--${due.tone}`}>{due.text}</span>
                </div>

                {isEditing ? (
                  <div className="edit-form">
                    <input
                      value={editingPlant.name}
                      onChange={(event) =>
                        setEditingPlant((prev) => ({ ...prev, name: event.target.value }))
                      }
                    />
                    <input
                      value={editingPlant.species}
                      onChange={(event) =>
                        setEditingPlant((prev) => ({ ...prev, species: event.target.value }))
                      }
                    />
                    <div className="form-row">
                      <input
                        type="number"
                        min={1}
                        max={365}
                        value={editingPlant.wateringIntervalDays}
                        onChange={(event) =>
                          setEditingPlant((prev) => ({
                            ...prev,
                            wateringIntervalDays: event.target.value
                          }))
                        }
                      />
                      <input
                        type="date"
                        value={editingPlant.lastWateredAt}
                        onChange={(event) =>
                          setEditingPlant((prev) => ({ ...prev, lastWateredAt: event.target.value }))
                        }
                      />
                    </div>
                    <textarea
                      rows={3}
                      value={editingPlant.notes}
                      onChange={(event) =>
                        setEditingPlant((prev) => ({ ...prev, notes: event.target.value }))
                      }
                    />
                    <div className="actions">
                      <button type="button" onClick={() => saveEdit(plant.id)}>
                        Save
                      </button>
                      <button type="button" className="ghost" onClick={cancelEditing}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <ul className="plant-meta">
                      <li>Every {plant.wateringIntervalDays} day(s)</li>
                      <li>Last watered: {plant.lastWateredAt ? formatDate(plant.lastWateredAt) : 'Never'}</li>
                      {plant.notes && <li>{plant.notes}</li>}
                    </ul>
                    <div className="actions">
                      <button type="button" onClick={() => markWateredNow(plant)}>
                        Watered Now
                      </button>
                      <button type="button" className="ghost" onClick={() => startEditing(plant)}>
                        Edit
                      </button>
                      <button type="button" className="danger" onClick={() => removePlant(plant)}>
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </article>
            );
          })}

          {!loading && plants.length === 0 && (
            <article className="empty">
              No plants in this view yet. Add your first plant above.
            </article>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;

function validateDraft(draft: PlantDraft):
  | { ok: true; value: { name: string; species: string; wateringIntervalDays: number; lastWateredAt: string | null; notes: string } }
  | { ok: false; error: string } {
  const name = draft.name.trim();
  if (!name) return { ok: false, error: 'Plant name is required' };

  const species = draft.species.trim();
  if (!species) return { ok: false, error: 'Species is required' };

  const wateringIntervalDays = Number.parseInt(draft.wateringIntervalDays, 10);
  if (!Number.isInteger(wateringIntervalDays) || wateringIntervalDays < 1 || wateringIntervalDays > 365) {
    return { ok: false, error: 'Watering interval must be between 1 and 365 days' };
  }

  return {
    ok: true,
    value: {
      name,
      species,
      wateringIntervalDays,
      lastWateredAt: fromDateInputValue(draft.lastWateredAt),
      notes: draft.notes.trim()
    }
  };
}

function fromDateInputValue(value: string): string | null {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toDateInputValue(value: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 10);
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function isDueNow(plant: Plant): boolean {
  if (!plant.lastWateredAt) return true;
  if (!plant.nextWateringDueAt) return true;
  const dueDate = new Date(plant.nextWateringDueAt);
  if (Number.isNaN(dueDate.getTime())) return true;
  return dueDate.getTime() <= Date.now();
}

function dueLabel(plant: Plant): { text: string; tone: 'due' | 'soon' | 'ok' } {
  if (!plant.lastWateredAt || !plant.nextWateringDueAt) {
    return { text: 'Needs water', tone: 'due' };
  }

  const dueDate = new Date(plant.nextWateringDueAt);
  if (Number.isNaN(dueDate.getTime())) {
    return { text: 'Needs water', tone: 'due' };
  }

  const msPerDay = 1000 * 60 * 60 * 24;
  const diffDays = Math.ceil((dueDate.getTime() - Date.now()) / msPerDay);

  if (diffDays <= 0) {
    return { text: diffDays < 0 ? `Overdue ${Math.abs(diffDays)}d` : 'Due today', tone: 'due' };
  }
  if (diffDays <= 2) {
    return { text: `Due in ${diffDays}d`, tone: 'soon' };
  }
  return { text: `Due in ${diffDays}d`, tone: 'ok' };
}
