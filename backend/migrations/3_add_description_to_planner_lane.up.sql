-- Migration to fix missing column issue
-- Adds description column to planner_lane table to match application code

ALTER TABLE planner_lane
ADD COLUMN description TEXT;
