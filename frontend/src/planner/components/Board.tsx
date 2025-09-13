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
      const newLane = await splitLane(
        planner.id,
        laneId,
        newTitle,
        newDescription,
        splitPosition,
        newColor
      );
      onPlannerUpdate({
        ...planner,
        lanes: [...planner.lanes, newLane].sort(
          (a, b) => a.position - b.position
        ),
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

    if (!destination) return;

    // Don't do anything if the item was dropped back in the same position
    if (
      destination.droppableId === source.droppableId &&
      destination.index === source.index
    ) {
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
      } else if (type === "card") {
        const sourceLane = planner.lanes.find(
          (l) => l.id === source.droppableId
        );
        const destLane = planner.lanes.find(
          (l) => l.id === destination.droppableId
        );
        if (!sourceLane || !destLane) return;

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
        }
      }
    } catch (error) {
      console.error("Failed to persist drag and drop changes:", error);
      // TODO: Consider reverting the UI change if the backend call fails
    }
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      {/* @ts-ignore */}
      <Droppable droppableId="all-lanes" type="lane" direction="horizontal">
        {(provided: any, snapshot: any) =>
          (
            <div
              className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-4 h-full items-start auto-rows-max"
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
                        className="h-full"
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
            </div>
          ) as any
        }
      </Droppable>
    </DragDropContext>
  );
};

export default Board;
