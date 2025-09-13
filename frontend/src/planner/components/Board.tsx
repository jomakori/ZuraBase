import React, { useState } from "react";
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

  // Removed pendingSplit mechanism; handle splits directly

  const handleAddLane = async () => {
    if (newLaneTitle.trim()) {
      try {
        const newLane = await addLane(
          planner.id,
          newLaneTitle,
          newLaneDescription,
          planner.lanes.length // Add to the end of the board
        );

        // Update the planner with the new lane
        onPlannerUpdate({
          ...planner,
          lanes: [...planner.lanes, newLane],
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

      // Create new lane with proper position
      const newLanePosition = originalLane.position + 1;
      const newLane = await addLane(
        planner.id,
        newTitle,
        newDescription,
        newLanePosition,
        newColor
      );

      // Move cards from original lane to new lane (client-side redistribution)
      const cardsToMove = originalLane.cards.slice(splitPosition);

      // Update original lane to remove moved cards
      const updatedOriginalLane = {
        ...originalLane,
        cards: originalLane.cards.slice(0, splitPosition),
      };

      // Add moved cards to new lane
      const updatedNewLane = {
        ...newLane,
        cards: cardsToMove,
      };

      // Update all lanes with new positions
      const updatedLanes = planner.lanes.map((lane) => {
        if (lane.id === laneId) return updatedOriginalLane;
        // Shift positions for lanes after the original lane
        if (lane.position > originalLane.position) {
          return { ...lane, position: lane.position + 1 };
        }
        return lane;
      });

      // Insert the new lane at the correct position
      updatedLanes.splice(originalLane.position + 1, 0, updatedNewLane);

      onPlannerUpdate({
        ...planner,
        lanes: updatedLanes,
      });

      // Move cards to new lane in backend (async, won't block UI)
      cardsToMove.forEach(async (card, index) => {
        try {
          await moveCard(planner.id, card.id, newLane.id, index);
        } catch (error) {
          console.error("Failed to move card during split:", error);
        }
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

      onPlannerUpdate({
        ...planner,
        lanes: planner.lanes.map((lane) => {
          // If it's the source lane, remove the card
          if (lane.cards.some((c) => c.id === cardId)) {
            return {
              ...lane,
              cards: lane.cards.filter((c) => c.id !== cardId),
            };
          }
          // If it's the target lane, insert card at correct position
          if (lane.id === newLaneId) {
            const newCards = [...lane.cards];
            newCards.splice(newPosition, 0, movedCard);
            return {
              ...lane,
              cards: newCards,
            };
          }
          return lane;
        }),
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
        const newOrder = Array.from(planner.lanes);
        const [removed] = newOrder.splice(source.index, 1);
        newOrder.splice(destination.index, 0, removed);

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

        if (sourceLane.id === destLane.id) {
          // Reordering within the same lane
          sourceCards.splice(destination.index, 0, moved);

          // Update UI optimistically first
          onPlannerUpdate({
            ...planner,
            lanes: planner.lanes.map((l) =>
              l.id === sourceLane.id ? { ...l, cards: sourceCards } : l
            ),
          });

          // Then persist to backend
          await reorderCards(
            planner.id,
            sourceLane.id,
            sourceCards.map((c) => c.id)
          );
          
          console.log("Card reorder within lane successful");

        } else {
          // Moving between lanes
          const destCards = Array.from(destLane.cards);
          destCards.splice(destination.index, 0, moved);

          // Update UI optimistically first
          onPlannerUpdate({
            ...planner,
            lanes: planner.lanes.map((l) => {
              if (l.id === sourceLane.id) return { ...l, cards: sourceCards };
              if (l.id === destLane.id) return { ...l, cards: destCards };
              return l;
            }),
          });

          // Then persist to backend
          await moveCard(planner.id, moved.id, destLane.id, destination.index);
          
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

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      {/* @ts-ignore */}
      <Droppable droppableId="all-lanes" type="lane" direction="horizontal">
        {(provided: any, snapshot: any) =>
          (
            <div
              className="flex flex-nowrap gap-4 pb-4 h-full items-start overflow-x-auto"
              ref={provided.innerRef}
              {...provided.droppableProps}
            >
              {planner.lanes.map((lane, index) => (
                <Draggable key={lane.id} draggableId={lane.id} index={index}>
                  {(laneProvided: any) =>
                    (
                      <div
                        ref={laneProvided.innerRef}
                        {...laneProvided.draggableProps}
                        {...laneProvided.dragHandleProps}
                        className="h-full min-w-[280px]"
                      >
                        <Lane
                          lane={{
                            ...lane,
                            color:
                              lane.color ||
                              (lane.title.toLowerCase().includes("done")
                                ? "#34D399"
                                : lane.title.toLowerCase().includes("progress")
                                ? "#FBBF24"
                                : lane.title.toLowerCase().includes("stuck")
                                ? "#F87171"
                                : lane.title.toLowerCase().includes("live")
                                ? "#60A5FA"
                                : "#E5E7EB"),
                          }}
                          onAddCard={handleAddCard}
                          onUpdateCard={handleUpdateCard}
                          onDeleteCard={handleDeleteCard}
                          onUpdateLane={handleUpdateLane}
                          onDeleteLane={handleDeleteLane}
                          onSplitLane={handleSplitLane}
                          onMoveCard={handleMoveCard}
                        />
                      </div>
                    ) as any
                  }
                </Draggable>
              ))}
              {provided.placeholder as any}
              {/* Add Lane Form */}
              <div className="min-w-[280px]">
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
