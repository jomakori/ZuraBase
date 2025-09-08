/** Represents a template for creating planners */
export interface PlannerTemplate {
  id: string;
  name: string;
  type: string; // 'scrum', 'kanban', or 'personal'
  description: string;
  created_at: string;
  lanes?: PlannerTemplateLane[];
}

/** Represents a predefined lane in a template */
export interface PlannerTemplateLane {
  id: string;
  template_id: string;
  name: string;
  description: string;
  position: number;
  created_at: string;
}

/** Represents a planner board */
export interface Planner {
  /** Unique planner ID */
  id: string;
  title: string;
  description: string;
  template_id: string;
  created_at: string;
  updated_at: string;
  lanes: PlannerLane[];
}

/** Represents a lane in a planner */
export interface PlannerLane {
  id: string;
  planner_id: string;
  template_lane_id?: string;
  title: string;
  description: string;
  position: number;
  created_at: string;
  updated_at: string;
  cards: PlannerCard[];
}

/** Represents a card in a lane */
export interface PlannerCard {
  id: string;
  lane_id: string;
  title: string;
  content: string; // Markdown content
  position: number;
  created_at: string;
  updated_at: string;
}
