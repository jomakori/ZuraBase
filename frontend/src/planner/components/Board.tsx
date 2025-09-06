import React, { useState } from "react";
import { Planner, PlannerLane } from "../types";
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
}

const Board: React.FC<BoardProps> = ({ planner, onPlannerUpdate }) => {
  const [isAddingLane, setIsAddingLane] = useState(false);
  const [newLaneTitle, setNewLaneTitle] = useState("");
  const [newLaneDescription, setNewLaneDescription] = useState("");

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
    description: string
  ) => {
    try {
      const updatedLane = await updateLane(
        planner.id,
        laneId,
        title,
        description
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
    splitPosition: number
  ) => {
    try {
      const newLane = await splitLane(
        planner.id,
        laneId,
        newTitle,
        newDescription,
        splitPosition
      );

      // Find the lane that was split
      const originalLane = planner.lanes.find((lane) => lane.id === laneId);
      if (!originalLane) return;

      // Create updated lanes with cards split between them
      const updatedOriginalLane = {
        ...originalLane,
        cards: originalLane.cards.slice(0, splitPosition + 1),
      };

      // Update the planner with both lanes
      onPlannerUpdate({
        ...planner,
        lanes: [
          ...planner.lanes.filter((lane) => lane.id !== laneId),
          updatedOriginalLane,
          newLane,
        ].sort((a, b) => a.position - b.position),
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
              cards: [...lane.cards, newCard],
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

      // Update the planner with the updated card
      onPlannerUpdate({
        ...planner,
        lanes: planner.lanes.map((lane) => {
          const cardIndex = lane.cards.findIndex((card) => card.id === cardId);
          if (cardIndex >= 0) {
            const updatedCards = [...lane.cards];
            updatedCards[cardIndex] = updatedCard;
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

  return (
    <div className="h-full">
      <div className="flex overflow-x-auto pb-4 h-full items-start">
        {/* Lanes */}
        {planner.lanes.map((lane) => (
          <Lane
            key={lane.id}
            lane={lane}
            onAddCard={handleAddCard}
            onUpdateCard={handleUpdateCard}
            onDeleteCard={handleDeleteCard}
            onUpdateLane={handleUpdateLane}
            onDeleteLane={handleDeleteLane}
            onSplitLane={handleSplitLane}
          />
        ))}

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
