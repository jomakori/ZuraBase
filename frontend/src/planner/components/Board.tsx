import React, { useState, useEffect } from "react";
import {
  DragDropContext,
  Droppable,
  Draggable,
  DropResult,
} from "@hello-pangea/dnd";
import { Planner, PlannerLane, PlannerColumn, PlannerCard } from "../types";
import Lane from "./Lane";
import { Plus } from "@phosphor-icons/react";
import {
  addLane,
  updateLane,
  deleteLane,
  splitLane,
  addCard,
  updateCard,
  deleteCard,
  reorderLanes,
  reorderCards,
  moveCard,
} from "../api";

interface BoardProps {
  planner: Planner;
  onPlannerUpdate: (planner: Planner) => void;
  onSplitLane: (
    laneId: string,
    newTitle: string,
    newDescription: string,
    splitPosition: number,
    newColor: string
  ) => void;
}

const Board: React.FC<BoardProps> = ({
  planner,
  onPlannerUpdate,
  onSplitLane,
}) => {
  const [isAddingLane, setIsAddingLane] = useState(false);
  const [newLaneTitle, setNewLaneTitle] = useState("");
  const [newLaneDescription, setNewLaneDescription] = useState("");
  const [direction, setDirection] = useState<"horizontal" | "vertical">(
    window.innerWidth < 640 ? "vertical" : "horizontal"
  );

  // Handle responsive direction change
  useEffect(() => {
    const handleResize = () => {
      setDirection(window.innerWidth < 640 ? "vertical" : "horizontal");
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Removed pendingSplit mechanism; handle splits directly

  const handleAddLane = async () => {
    if (newLaneTitle.trim()) {
      try {
        // Calculate the position for the new lane (end of the board)
        const position =
          planner.lanes.length > 0
            ? Math.max(...planner.lanes.map((lane) => lane.position)) + 1
            : 0;

        const newLane = await addLane(
          planner.id,
          newLaneTitle,
          newLaneDescription,
          position
        );

        // Update the planner with the new lane
        const updatedLanes = [...planner.lanes, newLane];

        // Sort lanes by position to ensure consistent ordering
        const sortedLanes = updatedLanes.sort(
          (a, b) => a.position - b.position
        );

        onPlannerUpdate({
          ...planner,
          lanes: sortedLanes,
        });

        // Reset form
        setNewLaneTitle("");
        setNewLaneDescription("");
        setIsAddingLane(false);
      } catch (error) {
        console.error("Failed to add lane:", error);
      }
    }
  };

  const handleUpdateLane = async (
    laneId: string,
    title: string,
    description: string,
    color?: string
  ) => {
    try {
      const updatedLane = await updateLane(
        planner.id,
        laneId,
        title,
        description,
        color
      );

      // Update the planner with the updated lane
      onPlannerUpdate({
        ...planner,
        lanes: planner.lanes.map((lane) =>
          lane.id === laneId ? updatedLane : lane
        ),
      });
    } catch (error) {
      console.error("Failed to update lane:", error);
    }
  };

  const handleDeleteLane = async (laneId: string) => {
    if (
      window.confirm(
        "Are you sure you want to delete this lane and all its cards?"
      )
    ) {
      try {
        await deleteLane(planner.id, laneId);

        // Update the planner without the deleted lane
        onPlannerUpdate({
          ...planner,
          lanes: planner.lanes.filter((lane) => lane.id !== laneId),
        });
      } catch (error) {
        console.error("Failed to delete lane:", error);
      }
    }
  };

  const handleSplitLane = async (
    laneId: string,
    newTitle: string,
    newDescription: string,
    splitPosition: number,
    newColor: string
  ) => {
    try {
      // Find the original lane
      const originalLane = planner.lanes.find((l) => l.id === laneId);
      if (!originalLane) return;

      // Use backend splitLane API instead of client-side hack
      const newLane = await splitLane(
        planner.id,
        laneId,
        newTitle,
        newDescription,
        splitPosition,
        newColor
      );

      // Update planner with new and original lane grouping
      const updatedLanes = planner.lanes.map((lane) =>
        lane.id === laneId
          ? {
              ...lane,
              cards: lane.cards.slice(0, splitPosition),
              template_lane_id: lane.template_lane_id || lane.id,
            }
          : lane
      );

      // Add the new lane
      updatedLanes.push(newLane);

      // Group lanes by template_lane_id
      const groups: { [key: string]: PlannerLane[] } = {};
      updatedLanes.forEach((lane) => {
        const groupId = lane.template_lane_id || lane.id;
        if (!groups[groupId]) groups[groupId] = [];
        groups[groupId].push(lane);
      });

      // Sort each group internally by position
      Object.values(groups).forEach((group) => {
        group.sort((a, b) => a.position - b.position);
      });

      // Flatten the groups back to a lane array and ensure contiguous positions
      const sortedLanes: PlannerLane[] = [];
      let position = 0;

      // First, add non-grouped lanes
      updatedLanes
        .filter(
          (lane) => !lane.template_lane_id || lane.template_lane_id === lane.id
        )
        .sort((a, b) => a.position - b.position)
        .forEach((lane) => {
          const groupId = lane.template_lane_id || lane.id;
          const group = groups[groupId] || [];

          // Add the parent lane first
          lane.position = position++;
          sortedLanes.push(lane);

          // Then add all child lanes
          group
            .filter((l) => l.id !== lane.id && l.template_lane_id === groupId)
            .sort((a, b) => a.position - b.position)
            .forEach((childLane) => {
              childLane.position = position++;
              sortedLanes.push(childLane);
            });
        });

      onPlannerUpdate({
        ...planner,
        lanes: sortedLanes,
      });
    } catch (error) {
      console.error("Failed to split lane:", error);
    }
  };

  const handleAddCard = async (
    laneId: string,
    title: string,
    content: string,
    position: number
  ) => {
    try {
      const fields = { title, content };
      const newCard = await addCard(
        planner.id,
        laneId,
        title,
        content,
        position
      );

      // Update the planner with the new card
      onPlannerUpdate({
        ...planner,
        lanes: planner.lanes.map((lane) => {
          if (lane.id === laneId) {
            return {
              ...lane,
              cards: [...lane.cards, { ...newCard, fields }],
            };
          }
          return lane;
        }),
      });
    } catch (error) {
      console.error("Failed to add card:", error);
    }
  };

  const handleUpdateCard = async (
    cardId: string,
    title: string,
    content: string
  ) => {
    // Find the lane containing the card
    const lane = planner.lanes.find((lane) =>
      lane.cards.some((card) => card.id === cardId)
    );

    if (!lane) return;

    try {
      const updatedCard = await updateCard(
        planner.id,
        lane.id,
        cardId,
        title,
        content
      );

      // Attach updated fields into card
      const fields = { title, content };

      // Update the planner with the updated card
      onPlannerUpdate({
        ...planner,
        lanes: planner.lanes.map((lane) => {
          const cardIndex = lane.cards.findIndex((card) => card.id === cardId);
          if (cardIndex >= 0) {
            const updatedCards = [...lane.cards];
            updatedCards[cardIndex] = { ...updatedCard, fields };
            return {
              ...lane,
              cards: updatedCards,
            };
          }
          return lane;
        }),
      });
    } catch (error) {
      console.error("Failed to update card:", error);
    }
  };

  const handleDeleteCard = async (cardId: string) => {
    // Find the lane containing the card
    const lane = planner.lanes.find((lane) =>
      lane.cards.some((card) => card.id === cardId)
    );

    if (!lane) return;

    try {
      await deleteCard(planner.id, lane.id, cardId);

      // Update the planner without the deleted card
      onPlannerUpdate({
        ...planner,
        lanes: planner.lanes.map((lane) => {
          return {
            ...lane,
            cards: lane.cards.filter((card) => card.id !== cardId),
          };
        }),
      });
    } catch (error) {
      console.error("Failed to delete card:", error);
    }
  };

  const handleMoveCard = async (
    cardId: string,
    newLaneId: string,
    newPosition: number
  ) => {
    try {
      const movedCard = await moveCard(
        planner.id,
        cardId,
        newLaneId,
        newPosition
      );

      // Preserve fields from existing card if missing
      const existingCard = planner.lanes
        .flatMap((l) => l.cards)
        .find((c) => c.id === cardId);
      const mergedCard = {
        ...existingCard,
        ...movedCard,
        fields: movedCard.fields || existingCard?.fields || {},
      };

      // Create a new planner state with updated lanes
      const updatedLanes = planner.lanes.map((lane) => {
        // If it's the source lane, remove the card
        if (lane.cards.some((c) => c.id === cardId)) {
          return {
            ...lane,
            cards: lane.cards.filter((c) => c.id !== cardId),
          };
        }

        // If it's the target lane, insert card at correct position and reindex
        if (lane.id === newLaneId) {
          // Get existing cards without the moved card (in case it's the same lane)
          const existingCards = lane.cards.filter((c) => c.id !== cardId);

          // Insert the moved card at the specified position
          const newCards = [...existingCards];
          newCards.splice(newPosition, 0, mergedCard);

          // Update positions to match array indices
          const positionedCards = newCards.map((card, idx) => ({
            ...card,
            position: idx,
          }));

          return {
            ...lane,
            cards: positionedCards,
          };
        }

        return lane;
      });

      onPlannerUpdate({
        ...planner,
        lanes: updatedLanes,
      });
    } catch (error) {
      console.error("Failed to move card:", error);
    }
  };

  const onDragEnd = async (result: DropResult) => {
    const { destination, source, draggableId, type } = result;

    // Store original state for potential rollback
    const originalPlannerState = { ...planner };

    if (!destination) {
      console.log("Drag cancelled - no destination");
      return;
    }

    // Don't do anything if the item was dropped back in the same position
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
      console.log("Drag cancelled - same position");
      return;
    }

    try {
      if (type === "lane") {
        // Normalize lane ID
        const laneId = draggableId.startsWith("lane-")
          ? draggableId.replace(/^lane-/, "")
          : draggableId;

        // Find the dragged lane
        const draggedLane = planner.lanes.find((l) => l.id === laneId);
        if (!draggedLane) {
          console.error("Dragged lane not found");
          return;
        }

        // Create a copy of lanes sorted by position
        const sortedLanes = [...planner.lanes].sort(
          (a, b) => a.position - b.position
        );

        // Group lanes by template_lane_id
        const groups: { [key: string]: PlannerLane[] } = {};
        sortedLanes.forEach((lane) => {
          const groupId = lane.template_lane_id || lane.id;
          if (!groups[groupId]) groups[groupId] = [];
          groups[groupId].push(lane);
        });

        // Sort each group internally by position
        Object.values(groups).forEach((group) => {
          group.sort((a, b) => a.position - b.position);
        });

        // Get the position of the first lane in each group for overall ordering
        let groupPositions = Object.entries(groups).map(([groupId, lanes]) => ({
          groupId,
          firstPosition: Math.min(...lanes.map((l) => l.position)),
          lanes,
        }));

        // Sort groups by the position of their first lane
        groupPositions.sort((a, b) => a.firstPosition - b.firstPosition);

        // Find the group containing the dragged lane
        const draggedGroupIndex = groupPositions.findIndex((g) =>
          g.lanes.some((l) => l.id === laneId)
        );

        if (draggedGroupIndex === -1) {
          console.error("Dragged lane group not found");
          return;
        }

        // Remove the dragged group
        const [draggedGroup] = groupPositions.splice(draggedGroupIndex, 1);

        // Insert the group at the destination index
        groupPositions.splice(destination.index, 0, draggedGroup);

        // Flatten the groups back to a lane array and assign new positions
        const newOrder: PlannerLane[] = [];
        let position = 0;

        groupPositions.forEach((group) => {
          group.lanes.forEach((lane) => {
            lane.position = position++;
            newOrder.push(lane);
          });
        });

        // Update UI optimistically first
        onPlannerUpdate({ ...planner, lanes: newOrder });

        // Then persist to backend
        await reorderLanes(
          planner.id,
          newOrder.map((l) => l.id)
        );

        console.log("Lane reorder successful");
      } else if (type === "card") {
        const sourceLane = planner.lanes.find(
          (l) => l.id === source.droppableId
        );
        const destLane = planner.lanes.find(
          (l) => l.id === destination.droppableId
        );

        if (!sourceLane || !destLane) {
          console.error("Source or destination lane not found");
          return;
        }

        // Validate that the moved card exists
        if (source.index >= sourceLane.cards.length) {
          console.error("Card index out of bounds");
          return;
        }

        const sourceCards = Array.from(sourceLane.cards);
        const [moved] = sourceCards.splice(source.index, 1);
        // Normalize card ID consistently by always stripping prefix if present
        const cardId = draggableId.startsWith("card-")
          ? draggableId.replace(/^card-/, "")
          : draggableId;

        if (sourceLane.id === destLane.id) {
          // Reordering within the same lane
          sourceCards.splice(destination.index, 0, moved);

          // Update positions to match array indices for consistent ordering
          const positionedCards = sourceCards.map((card, idx) => ({
            ...card,
            position: idx,
          }));

          // Update UI optimistically first
          onPlannerUpdate({
            ...planner,
            lanes: planner.lanes.map((l) =>
              l.id === sourceLane.id ? { ...l, cards: positionedCards } : l
            ),
          });

          // Then persist to backend
          await reorderCards(
            planner.id,
            sourceLane.id,
            positionedCards.map((c) => c.id)
          );

          console.log("Card reorder within lane successful");
        } else {
          // Moving between lanes
          // Use helper to ensure consistent state + backend update
          // ID normalization already handled above
          await handleMoveCard(cardId, destLane.id, destination.index);
          console.log("Card move between lanes successful");
        }
      }
    } catch (error) {
      console.error("Failed to persist drag and drop changes:", error);

      // Revert to original state on error
      onPlannerUpdate(originalPlannerState);

      // Show user feedback (could be enhanced with toast notifications)
      alert("Failed to save changes. Please try again.");
    }
  };

  // Sort lanes by position to ensure consistent ordering
  const orderedLanes = [...planner.lanes].sort(
    (a, b) => a.position - b.position
  );

  return (
    <DragDropContext onDragEnd={onDragEnd} enableDefaultSensors={true}>
      {/* @ts-ignore */}
      <Droppable droppableId="all-lanes" type="lane" direction={direction}>
        {(provided: any, snapshot: any) =>
          (
            <div
              className="flex flex-col sm:flex-row flex-nowrap gap-4 pb-4 h-full items-stretch overflow-y-auto sm:overflow-x-auto sm:overflow-y-hidden w-full border rounded-lg p-4 justify-center"
              style={{ borderColor: "#E5E7EB" }}
              ref={provided.innerRef}
              {...provided.droppableProps}
            >
              {(() => {
                // Group lanes by template_lane_id and ensure they're sorted by position
                const groups: { [key: string]: PlannerLane[] } = {};
                orderedLanes.forEach((lane) => {
                  const groupId = lane.template_lane_id || lane.id;
                  if (!groups[groupId]) groups[groupId] = [];
                  groups[groupId].push(lane);
                });

                // Sort each group internally by position
                Object.values(groups).forEach((group) => {
                  group.sort((a, b) => a.position - b.position);
                });

                // Get the position of the first lane in each group for overall ordering
                const groupPositions = Object.entries(groups).map(
                  ([groupId, lanes]) => ({
                    groupId,
                    firstPosition: Math.min(...lanes.map((l) => l.position)),
                    lanes,
                  })
                );

                // Sort groups by the position of their first lane
                groupPositions.sort(
                  (a, b) => a.firstPosition - b.firstPosition
                );

                return groupPositions.map(({ lanes: group }, gIndex) => {
                  // Parent is the one where template_lane_id is empty or equals itself
                  const parentLane = group.find(
                    (l) => !l.template_lane_id || l.template_lane_id === l.id
                  );
                  const subLanes = group.filter(
                    (l) => l.template_lane_id && l.template_lane_id !== l.id
                  );

                  return (
                    <Draggable
                      key={`lane-${parentLane?.id || group[0].id}`}
                      draggableId={`lane-${parentLane?.id || group[0].id}`}
                      index={gIndex}
                    >
                      {(laneProvided: any) =>
                        (
                          <div
                            ref={laneProvided.innerRef}
                            {...laneProvided.draggableProps}
                            {...laneProvided.dragHandleProps}
                            className="w-full sm:w-auto sm:h-full min-h-[200px] sm:min-h-0 sm:min-w-[280px] sm:max-w-[350px]"
                          >
                            {/* Parent Lane */}
                            {parentLane && (
                              <Lane
                                lane={parentLane}
                                onAddCard={handleAddCard}
                                onUpdateCard={handleUpdateCard}
                                onDeleteCard={handleDeleteCard}
                                onUpdateLane={handleUpdateLane}
                                onDeleteLane={handleDeleteLane}
                                onSplitLane={handleSplitLane}
                                onMoveCard={handleMoveCard}
                              />
                            )}

                            {/* Render sub-lanes differently based on screen size */}
                            {subLanes.length > 0 && (
                              <div className="mt-2 flex flex-col sm:flex-row gap-2">
                                {subLanes.map((sub) => (
                                  <Lane
                                    key={sub.id}
                                    lane={sub}
                                    onAddCard={handleAddCard}
                                    onUpdateCard={handleUpdateCard}
                                    onDeleteCard={handleDeleteCard}
                                    onUpdateLane={handleUpdateLane}
                                    onDeleteLane={handleDeleteLane}
                                    onSplitLane={handleSplitLane}
                                    onMoveCard={handleMoveCard}
                                  />
                                ))}
                              </div>
                            )}
                          </div>
                        ) as any
                      }
                    </Draggable>
                  );
                });
              })()}
              {provided.placeholder as any}
              {/* Add Lane Form */}
              <div className="w-full sm:w-auto sm:min-w-[280px] sm:max-w-[350px] min-h-[200px] sm:min-h-0">
                {isAddingLane ? (
                  <div className="bg-white p-4 rounded-lg shadow border-2 border-dashed border-gray-300">
                    <input
                      type="text"
                      value={newLaneTitle}
                      onChange={(e) => setNewLaneTitle(e.target.value)}
                      className="w-full mb-2 p-2 border border-gray-300 rounded"
                      placeholder="Lane title"
                      autoFocus
                    />
                    <textarea
                      value={newLaneDescription}
                      onChange={(e) => setNewLaneDescription(e.target.value)}
                      className="w-full mb-2 p-2 border border-gray-300 rounded"
                      placeholder="Lane description"
                      rows={2}
                    />
                    <div className="flex justify-end space-x-2">
                      <button
                        onClick={() => setIsAddingLane(false)}
                        className="px-3 py-1 text-sm bg-gray-200 rounded hover:bg-gray-300"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleAddLane}
                        className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                      >
                        Add
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsAddingLane(true)}
                    className="w-full h-32 bg-gray-100 hover:bg-gray-200 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-500"
                  >
                    <Plus size={24} className="mr-2" />
                    <span>Add Lane</span>
                  </button>
                )}
              </div>
            </div>
          ) as any
        }
      </Droppable>
    </DragDropContext>
  );
};

export default Board;
