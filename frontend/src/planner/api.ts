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

  try {
    const response = await fetch(`${getApiBase()}/planner`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ template_id: templateId, title, description }),
    });

    let planner: Planner;
    if (response.ok) {
      planner = await response.json();
    } else {
      const uniqueId = `temp-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 10)}`;
      console.log("Creating temporary planner with ID:", uniqueId);
      planner = {
        id: uniqueId,
        title,
        description,
        template_id: templateId,
        lanes: [],
        columns: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }

    // Normalize navigation to /planner/{id}
    if (typeof window !== "undefined" && planner?.id) {
      const currentPath = window.location.pathname;
      const expectedPath = `/planner/${planner.id}`;
      if (!currentPath.endsWith(expectedPath)) {
        window.history.replaceState({}, "", expectedPath);
      }
    }

    return planner;
  } catch (error) {
    console.error("Error creating planner:", error);
    const uniqueId = `temp-${Date.now()}-${Math.random()
      .toString(36)
      .substring(2, 10)}`;
    console.log("Creating temporary planner with ID after error:", uniqueId);
    const planner: Planner = {
      id: uniqueId,
      title,
      description,
      template_id: templateId,
      lanes: [],
      columns: [],
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (typeof window !== "undefined") {
      const expectedPath = `/planner/${planner.id}`;
      window.history.replaceState({}, "", expectedPath);
    }

    return planner;
  }
}

export async function getPlanner(id: string): Promise<Planner> {
  console.log("[API] getPlanner", { id });
  const response = await fetch(`${getApiBase()}/planner/${id}`, {
    credentials: "include",
  });
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
  position: number,
  color?: string
): Promise<PlannerLane> {
  console.log("[API] addLane", {
    plannerId,
    title,
    description,
    position,
    color,
  });

  const payload: any = { title, description, position };
  if (color) payload.color = color;

  const response = await fetch(`${getApiBase()}/planner/${plannerId}/lane`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  // For temporary planners, create a mock response instead of throwing an error
  if (!response.ok) {
    if (plannerId.toString().startsWith("temp-")) {
      console.log("Creating mock lane for temporary planner");
      // Return a mock lane for temporary planners
      return {
        id: `temp-lane-${Date.now()}`,
        planner_id: plannerId,
        title: title,
        description: description || "",
        position: position,
        color: color,
        cards: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as PlannerLane;
    }
    throw new Error(await response.text());
  }

  return await response.json();
}

export async function updateLane(
  plannerId: string,
  laneId: string,
  title: string,
  description: string,
  color?: string
): Promise<PlannerLane> {
  console.log("[API] updateLane", {
    plannerId,
    laneId,
    title,
    description,
    color,
  });

  const payload: any = { title, description };
  if (color) payload.color = color;

  const response = await fetch(
    `${getApiBase()}/planner/${plannerId}/lane/${laneId}`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );

  if (!response.ok) {
    if (
      plannerId.toString().startsWith("temp-") ||
      laneId.toString().startsWith("temp-")
    ) {
      console.log("Creating mock updated lane for temporary planner");
      return {
        id: laneId,
        planner_id: plannerId,
        title,
        description: description || "",
        color: color || "#E5E7EB",
        position: 0,
        cards: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as PlannerLane;
    }
    throw new Error(await response.text());
  }

  return (await response.json()) as PlannerLane;
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
  splitPosition: number,
  newColor?: string // Add optional newColor parameter
): Promise<PlannerLane> {
  console.log("[API] splitLane", {
    plannerId,
    laneId,
    newTitle,
    splitPosition,
    newColor,
  });

  // Only include new_description if it's not a temporary planner
  // This is a workaround for the backend issue with the description column
  const payload = !plannerId.toString().startsWith("temp-")
    ? {
        new_title: newTitle,
        new_description: newDescription,
        split_position: splitPosition,
        new_color: newColor,
      }
    : {
        new_title: newTitle,
        split_position: splitPosition,
        new_color: newColor,
      };

  const response = await fetch(
    `${getApiBase()}/planner/${plannerId}/lane/${laneId}/split`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );

  // For temporary planners, create a mock response instead of throwing an error
  if (!response.ok) {
    if (
      plannerId.toString().startsWith("temp-") ||
      laneId.toString().startsWith("temp-")
    ) {
      console.log("Creating mock split lane for temporary planner");
      // Return a mock lane for temporary planners
      return {
        id: `temp-lane-${Date.now()}`,
        planner_id: plannerId,
        title: newTitle,
        description: newDescription || "",
        position: splitPosition + 1, // Position after the split point
        color: newColor,
        cards: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
    throw new Error(await response.text());
  }

  return await response.json();
}

export async function getCard(cardId: string): Promise<PlannerCard> {
  console.log("[API] getCard", { cardId });
  const response = await fetch(`${getApiBase()}/planner/card/${cardId}`);
  if (!response.ok) throw new Error(await response.text());
  return await response.json();
}

export async function initializeTemplates(): Promise<void> {
  console.log("[API] initializeTemplates");
  const response = await fetch(`${getApiBase()}/planner/templates/init`, {
    method: "POST",
  });
  if (!response.ok) throw new Error(await response.text());
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

  // For temporary planners, create a mock response instead of throwing an error
  if (!response.ok) {
    if (
      plannerId.toString().startsWith("temp-") ||
      laneId.toString().startsWith("temp-")
    ) {
      console.log("Creating mock card for temporary planner");
      // Return a mock card for temporary planners
      return {
        id: `temp-card-${Date.now()}`,
        lane_id: laneId,
        fields: { title, content },
        position: position,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
    throw new Error(await response.text());
  }

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

  // For temporary planners, create a mock response instead of throwing an error
  if (!response.ok) {
    if (
      plannerId.toString().startsWith("temp-") ||
      laneId.toString().startsWith("temp-") ||
      cardId.toString().startsWith("temp-")
    ) {
      console.log("Creating mock updated card for temporary planner");
      // Return a mock updated card for temporary planners
      return {
        id: cardId,
        lane_id: laneId,
        title: title,
        content: content,
        fields: { title, content },
        position: 0, // We don't know the position, so default to 0
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as PlannerCard;
    }
    throw new Error(await response.text());
  }

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

  // For temporary planners, just log and return instead of throwing an error
  if (!response.ok) {
    if (
      plannerId.toString().startsWith("temp-") ||
      laneId.toString().startsWith("temp-") ||
      cardId.toString().startsWith("temp-")
    ) {
      console.log(
        "Mock delete card for temporary planner - no action needed on backend"
      );
      return;
    }
    throw new Error(await response.text());
  }
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

  // For temporary planners, just log and return instead of throwing an error
  if (!response.ok) {
    if (
      plannerId.toString().startsWith("temp-") ||
      laneId.toString().startsWith("temp-")
    ) {
      console.log(
        "Mock reorder cards for temporary planner - no action needed on backend"
      );
      return;
    }
    throw new Error(await response.text());
  }
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

  // For temporary planners, create a mock response instead of throwing an error
  if (!response.ok) {
    if (
      plannerId.toString().startsWith("temp-") ||
      cardId.toString().startsWith("temp-") ||
      newLaneId.toString().startsWith("temp-")
    ) {
      console.log("Creating mock moved card for temporary planner");
      // Return a mock moved card for temporary planners
      return {
        id: cardId,
        lane_id: newLaneId,
        fields: { title: "Moved Card", content: "" },
        position: newPosition,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    }
    throw new Error(await response.text());
  }

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
