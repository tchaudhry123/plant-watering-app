export type Plant = {
  id: number;
  name: string;
  species: string;
  wateringIntervalDays: number;
  lastWateredAt: string | null;
  notes: string;
  createdAt: string;
  nextWateringDueAt: string | null;
};

export type PlantFilter = 'all' | 'due' | 'upcoming';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export async function fetchPlants(filter: PlantFilter): Promise<Plant[]> {
  const url = new URL('/plants', API_URL);
  if (filter && filter !== 'all') {
    url.searchParams.set('filter', filter);
  }
  const response = await fetch(url);
  await ensureOk(response);
  return response.json();
}

export type CreatePlantPayload = {
  name: string;
  species: string;
  wateringIntervalDays: number;
  lastWateredAt: string | null;
  notes: string;
};

export type UpdatePlantPayload = Partial<CreatePlantPayload>;

export async function createPlant(payload: CreatePlantPayload): Promise<Plant> {
  const response = await fetch(`${API_URL}/plants`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  await ensureOk(response);
  return response.json();
}

export async function updatePlant(id: number, payload: UpdatePlantPayload): Promise<Plant> {
  const response = await fetch(`${API_URL}/plants/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  await ensureOk(response);
  return response.json();
}

export async function deletePlant(id: number): Promise<void> {
  const response = await fetch(`${API_URL}/plants/${id}`, { method: 'DELETE' });
  await ensureOk(response);
}

async function ensureOk(response: Response) {
  if (!response.ok) {
    let message = response.statusText;
    try {
      const data = await response.json();
      message = (data && data.error) || message;
    } catch (error) {
      // ignore json parse errors
    }
    throw new Error(message || 'Request failed');
  }
}
