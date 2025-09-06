import React, { useState } from "react";
import { PlannerLane, PlannerCard } from "../types";
import Card from "./Card";
import {
  Plus,
  Pencil,
  Trash,
  DotsSixVertical,
  ArrowsHorizontal,
} from "@phosphor-icons/react";

interface LaneProps {
  lane: PlannerLane;
  onAddCard: (
    laneId: string,
    title: string,
    content: string,
    position: number
  ) => void;
  onUpdateCard: (cardId: string, title: string, content: string) => void;
  onDeleteCard: (cardId: string) => void;
  onUpdateLane: (laneId: string, title: string, description: string) => void;
  onDeleteLane: (laneId: string) => void;
  onSplitLane: (
    laneId: string,
    newTitle: string,
    newDescription: string,
    splitPosition: number
  ) => void;
  dragHandleProps?: any;
}

const Lane: React.FC<LaneProps> = ({
  lane,
  onAddCard,
  onUpdateCard,
  onDeleteCard,
  onUpdateLane,
  onDeleteLane,
  onSplitLane,
  dragHandleProps,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(lane.title);
  const [description, setDescription] = useState(lane.description || "");
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [newCardContent, setNewCardContent] = useState("");
  const [isSplittingLane, setIsSplittingLane] = useState(false);
  const [splitTitle, setSplitTitle] = useState("");
  const [splitDescription, setSplitDescription] = useState("");
  const [splitPosition, setSplitPosition] = useState(0);

  const handleSaveLane = () => {
    onUpdateLane(lane.id, title, description);
    setIsEditing(false);
  };

  const handleAddCard = () => {
    if (newCardTitle.trim()) {
      onAddCard(
        lane.id,
        newCardTitle,
        newCardContent,
        lane.cards.length // Add to the end of the lane
      );
      setNewCardTitle("");
      setNewCardContent("");
      setIsAddingCard(false);
    }
  };

  const handleSplitLane = () => {
    if (splitTitle.trim()) {
      onSplitLane(lane.id, splitTitle, splitDescription, splitPosition);
      setSplitTitle("");
      setSplitDescription("");
      setSplitPosition(0);
      setIsSplittingLane(false);
    }
  };

  return (
    <div className="bg-gray-100 rounded-lg p-3 w-72 flex-shrink-0 max-h-full flex flex-col">
      {/* Lane Header */}
      {isEditing ? (
        <div className="mb-3">
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full mb-2 p-1 border border-gray-300 rounded"
            placeholder="Lane title"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full mb-2 p-1 border border-gray-300 rounded"
            placeholder="Lane description"
            rows={2}
          />
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => setIsEditing(false)}
              className="px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveLane}
              className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Save
            </button>
          </div>
        </div>
      ) : (
        <div className="flex justify-between items-center mb-3">
          <div className="flex-1">
            <h3 className="font-bold text-gray-800">{lane.title}</h3>
            {lane.description && (
              <p className="text-xs text-gray-600">{lane.description}</p>
            )}
          </div>
          <div className="flex space-x-1">
            <div {...dragHandleProps} className="cursor-grab">
              <DotsSixVertical size={16} />
            </div>
            <button
              onClick={() => setIsEditing(true)}
              className="text-gray-500 hover:text-blue-500"
            >
              <Pencil size={16} />
            </button>
            <button
              onClick={() => setIsSplittingLane(true)}
              className="text-gray-500 hover:text-blue-500"
            >
              <ArrowsHorizontal size={16} />
            </button>
            <button
              onClick={() => onDeleteLane(lane.id)}
              className="text-gray-500 hover:text-red-500"
            >
              <Trash size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Split Lane Form */}
      {isSplittingLane && (
        <div className="mb-3 p-2 bg-white rounded shadow">
          <h4 className="font-medium text-sm mb-2">Split Lane</h4>
          <input
            type="text"
            value={splitTitle}
            onChange={(e) => setSplitTitle(e.target.value)}
            className="w-full mb-2 p-1 border border-gray-300 rounded"
            placeholder="New lane title"
          />
          <textarea
            value={splitDescription}
            onChange={(e) => setSplitDescription(e.target.value)}
            className="w-full mb-2 p-1 border border-gray-300 rounded"
            placeholder="New lane description"
            rows={2}
          />
          <div className="mb-2">
            <label className="block text-xs text-gray-700 mb-1">
              Split after card:
            </label>
            <select
              value={splitPosition}
              onChange={(e) => setSplitPosition(parseInt(e.target.value))}
              className="w-full p-1 border border-gray-300 rounded"
            >
              {lane.cards.map((card, index) => (
                <option key={card.id} value={index}>
                  {index + 1}. {card.title}
                </option>
              ))}
            </select>
          </div>
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => setIsSplittingLane(false)}
              className="px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              onClick={handleSplitLane}
              className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Split
            </button>
          </div>
        </div>
      )}

      {/* Cards Container */}
      <div className="overflow-y-auto flex-1">
        {lane.cards.map((card) => (
          <Card
            key={card.id}
            card={card}
            onUpdate={onUpdateCard}
            onDelete={onDeleteCard}
          />
        ))}
      </div>

      {/* Add Card Form */}
      {isAddingCard ? (
        <div className="mt-2 p-2 bg-white rounded shadow">
          <input
            type="text"
            value={newCardTitle}
            onChange={(e) => setNewCardTitle(e.target.value)}
            className="w-full mb-2 p-1 border border-gray-300 rounded"
            placeholder="Card title"
          />
          <textarea
            value={newCardContent}
            onChange={(e) => setNewCardContent(e.target.value)}
            className="w-full mb-2 p-1 border border-gray-300 rounded"
            placeholder="Card content (markdown supported)"
            rows={3}
          />
          <div className="flex justify-end space-x-2">
            <button
              onClick={() => setIsAddingCard(false)}
              className="px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300"
            >
              Cancel
            </button>
            <button
              onClick={handleAddCard}
              className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
            >
              Add
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setIsAddingCard(true)}
          className="mt-2 w-full py-1 bg-gray-200 hover:bg-gray-300 rounded flex items-center justify-center"
        >
          <Plus size={16} className="mr-1" />
          <span>Add Card</span>
        </button>
      )}
    </div>
  );
};

export default Lane;
