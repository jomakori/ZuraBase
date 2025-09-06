import { getApiBase } from "../getApiBase";
import { PlannerTemplate, Planner, PlannerLane, PlannerCard } from "./types";

// Template API functions
export async function getTemplates(): Promise<PlannerTemplate[]> {
  console.log("[API] getTemplates");
  const response = await fetch(`${getApiBase()}/planner/templates`);
  if (!response.ok) throw new Error(await response.text());
  return await response.json();
}

export async function getTemplate(id: string): Promise<PlannerTemplate> {
  console.log("[API] getTemplate", { id });
  const response = await fetch(`${getApiBase()}/planner/templates/${id}`);
  if (!response.ok) throw new Error(await response.text());
  return await response.json();
}

// Planner API functions
export async function createPlanner(
  templateId: string,
  title: string,
  description: string
): Promise<Planner> {
  console.log("[API] createPlanner", { templateId, title });
  const response = await fetch(`${getApiBase()}/planner`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ template_id: templateId, title, description }),
  });
  if (!response.ok) throw new Error(await response.text());
  return await response.json();
}

export async function getPlanner(id: string): Promise<Planner> {
  console.log("[API] getPlanner", { id });
  const response = await fetch(`${getApiBase()}/planner/${id}`);
  if (!response.ok) throw new Error(await response.text());
  return await response.json();
}

export async function updatePlanner(
  id: string,
  title: string,
  description: string
): Promise<Planner> {
  console.log("[API] updatePlanner", { id, title });
  const response = await fetch(`${getApiBase()}/planner/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description }),
  });
  if (!response.ok) throw new Error(await response.text());
  return await response.json();
}

export async function deletePlanner(id: string): Promise<void> {
  console.log("[API] deletePlanner", { id });
  const response = await fetch(`${getApiBase()}/planner/${id}`, {
    method: "DELETE",
  });
  if (!response.ok) throw new Error(await response.text());
}

// Lane API functions
export async function addLane(
  plannerId: string,
  title: string,
  description: string,
  position: number
): Promise<PlannerLane> {
  console.log("[API] addLane", { plannerId, title, position });
  const response = await fetch(`${getApiBase()}/planner/${plannerId}/lane`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, description, position }),
  });
  if (!response.ok) throw new Error(await response.text());
  return await response.json();
}

export async function updateLane(
  plannerId: string,
  laneId: string,
  title: string,
  description: string
): Promise<PlannerLane> {
  console.log("[API] updateLane", { plannerId, laneId, title });
  const response = await fetch(
    `${getApiBase()}/planner/${plannerId}/lane/${laneId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, description }),
    }
  );
  if (!response.ok) throw new Error(await response.text());
  return await response.json();
}

export async function deleteLane(
  plannerId: string,
  laneId: string
): Promise<void> {
  console.log("[API] deleteLane", { plannerId, laneId });
  const response = await fetch(
    `${getApiBase()}/planner/${plannerId}/lane/${laneId}`,
    {
      method: "DELETE",
    }
  );
  if (!response.ok) throw new Error(await response.text());
}

export async function splitLane(
  plannerId: string,
  laneId: string,
  newTitle: string,
  newDescription: string,
  splitPosition: number
): Promise<PlannerLane> {
  console.log("[API] splitLane", {
    plannerId,
    laneId,
    newTitle,
    splitPosition,
  });
  const response = await fetch(
    `${getApiBase()}/planner/${plannerId}/lane/${laneId}/split`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        new_title: newTitle,
        new_description: newDescription,
        split_position: splitPosition,
      }),
    }
  );
  if (!response.ok) throw new Error(await response.text());
  return await response.json();
}

export async function reorderLanes(
  plannerId: string,
  laneIds: string[]
): Promise<void> {
  console.log("[API] reorderLanes", { plannerId, laneCount: laneIds.length });
  const response = await fetch(
    `${getApiBase()}/planner/${plannerId}/lanes/reorder`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lane_ids: laneIds }),
    }
  );
  if (!response.ok) throw new Error(await response.text());
}

// Card API functions
export async function addCard(
  plannerId: string,
  laneId: string,
  title: string,
  content: string,
  position: number
): Promise<PlannerCard> {
  console.log("[API] addCard", { plannerId, laneId, title, position });
  const response = await fetch(
    `${getApiBase()}/planner/${plannerId}/lane/${laneId}/card`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content, position }),
    }
  );
  if (!response.ok) throw new Error(await response.text());
  return await response.json();
}

export async function updateCard(
  plannerId: string,
  laneId: string,
  cardId: string,
  title: string,
  content: string
): Promise<PlannerCard> {
  console.log("[API] updateCard", { plannerId, laneId, cardId, title });
  const response = await fetch(
    `${getApiBase()}/planner/${plannerId}/lane/${laneId}/card/${cardId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, content }),
    }
  );
  if (!response.ok) throw new Error(await response.text());
  return await response.json();
}

export async function deleteCard(
  plannerId: string,
  laneId: string,
  cardId: string
): Promise<void> {
  console.log("[API] deleteCard", { plannerId, laneId, cardId });
  const response = await fetch(
    `${getApiBase()}/planner/${plannerId}/lane/${laneId}/card/${cardId}`,
    {
      method: "DELETE",
    }
  );
  if (!response.ok) throw new Error(await response.text());
}

export async function reorderCards(
  plannerId: string,
  laneId: string,
  cardIds: string[]
): Promise<void> {
  console.log("[API] reorderCards", {
    plannerId,
    laneId,
    cardCount: cardIds.length,
  });
  const response = await fetch(
    `${getApiBase()}/planner/${plannerId}/lane/${laneId}/cards/reorder`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ card_ids: cardIds }),
    }
  );
  if (!response.ok) throw new Error(await response.text());
}

export async function moveCard(
  plannerId: string,
  cardId: string,
  newLaneId: string,
  newPosition: number
): Promise<PlannerCard> {
  console.log("[API] moveCard", { plannerId, cardId, newLaneId, newPosition });
  const response = await fetch(
    `${getApiBase()}/planner/${plannerId}/card/${cardId}/move`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        new_lane_id: newLaneId,
        new_position: newPosition,
      }),
    }
  );
  if (!response.ok) throw new Error(await response.text());
  return await response.json();
}

// Markdown import/export functions
export async function exportPlannerMarkdown(
  plannerId: string
): Promise<string> {
  console.log("[API] exportPlannerMarkdown", { plannerId });
  const response = await fetch(`${getApiBase()}/planner/${plannerId}/export`);
  if (!response.ok) throw new Error(await response.text());
  return await response.text();
}

export async function importPlannerFromMarkdown(
  markdown: string,
  templateId: string
): Promise<Planner> {
  console.log("[API] importPlannerFromMarkdown", { templateId });
  const response = await fetch(`${getApiBase()}/planner/import`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ markdown, template_id: templateId }),
  });
  if (!response.ok) throw new Error(await response.text());
  return await response.json();
}
