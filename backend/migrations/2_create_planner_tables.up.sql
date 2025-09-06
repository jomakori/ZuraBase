-- Create planner_template table
CREATE TABLE planner_template (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create planner_template_lane table
CREATE TABLE planner_template_lane (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES planner_template(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  position INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create planner table
CREATE TABLE planner (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  template_id TEXT NOT NULL REFERENCES planner_template(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create planner_lane table
CREATE TABLE planner_lane (
  id TEXT PRIMARY KEY,
  planner_id TEXT NOT NULL REFERENCES planner(id) ON DELETE CASCADE,
  template_lane_id TEXT REFERENCES planner_template_lane(id),
  title TEXT NOT NULL,
  position INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create planner_card table
CREATE TABLE planner_card (
  id TEXT PRIMARY KEY,
  lane_id TEXT NOT NULL REFERENCES planner_lane(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT,
  position INTEGER NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
