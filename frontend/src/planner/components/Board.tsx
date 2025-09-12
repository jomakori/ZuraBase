import React, { useState } from "react";
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

  return (
    <div className="h-full w-full overflow-x-auto">
      <div
        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 pb-4 h-full items-start auto-rows-max"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          const draggedLaneId = e.dataTransfer.getData("laneId");
          if (draggedLaneId) {
            const newOrder = [...planner.lanes.map((l) => l.id)];
            const targetIndex = Math.floor(
              newOrder.length * (e.clientX / window.innerWidth)
            );
            newOrder.splice(newOrder.indexOf(draggedLaneId), 1);
            newOrder.splice(targetIndex, 0, draggedLaneId);
            reorderLanes(planner.id, newOrder).then(() => {
              onPlannerUpdate({
                ...planner,
                lanes: newOrder.map(
                  (id) => planner.lanes.find((l) => l.id === id)!
                ),
              });
            });
          }
        }}
      >
        {/* Lanes */}
        {planner.lanes
          .filter((lane) => !(lane as any).parentId)
          .map((lane) => {
            const childLanes = planner.lanes.filter(
              (l) => (l as any).parentId === lane.id
            );
            return (
              <div
                key={lane.id}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("laneId", lane.id)}
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
                  onSplitLane={(laneId, newTitle, newDesc, pos, color) =>
                    handleSplitLane(laneId, newTitle, newDesc, pos, color).then(
                      (newLane) => {
                        (newLane as any).parentId = lane.id;
                      }
                    )
                  }
                  onMoveCard={handleMoveCard}
                />
                {/* Render child lanes */}
                {childLanes.length > 0 && (
                  <div className="ml-4 mt-2 space-y-2">
                    {childLanes.map((child) => (
                      <Lane
                        key={child.id}
                        lane={child}
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
            );
          })}

        {/* Add Lane Form */}
        {isAddingLane ? (
          <div className="bg-white rounded-lg p-3 w-72 flex-shrink-0 shadow">
            <input
              type="text"
              value={newLaneTitle}
              onChange={(e) => setNewLaneTitle(e.target.value)}
              className="w-full mb-2 p-2 border border-gray-300 rounded"
              placeholder="Lane title"
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
                className="px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
              >
                Cancel
              </button>
              <button
                onClick={handleAddLane}
                className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
              >
                Add
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsAddingLane(true)}
            className="bg-gray-100 rounded-lg p-3 w-72 flex-shrink-0 h-16 flex items-center justify-center hover:bg-gray-200"
          >
            <Plus size={20} className="mr-2" />
            <span>Add Lane</span>
          </button>
        )}
      </div>
    </div>
  );
};

export default Board;
