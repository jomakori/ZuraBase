import React, { useState, useEffect } from "react";
import { PlannerLane } from "../types";
import Card from "./Card";
import {
  Plus,
  Pencil,
  Trash,
  DotsSixVertical,
  ArrowsHorizontal,
  CaretDown,
  CaretRight,
} from "@phosphor-icons/react";
import { Droppable, Draggable } from "@hello-pangea/dnd";

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
  onUpdateLane: (
    laneId: string,
    title: string,
    description: string,
    color?: string
  ) => void;
  onDeleteLane: (laneId: string) => void;
  onSplitLane: (
    laneId: string,
    newTitle: string,
    newDescription: string,
    splitPosition: number,
    newColor: string
  ) => void;
  dragHandleProps?: any;
  onMoveCard: (cardId: string, laneId: string, position: number) => void;
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
  onMoveCard,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(lane.title);
  const [description, setDescription] = useState(lane.description || "");
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [newCardTitle, setNewCardTitle] = useState("");
  const [newCardContent, setNewCardContent] = useState("");

  const [laneColor, setLaneColor] = useState(lane.color || "#E5E7EB");
  const [collapsed, setCollapsed] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);

  // Split states
  const [isSplittingLane, setIsSplittingLane] = useState(false);
  const [splitTitle, setSplitTitle] = useState("");
  const [splitColor, setSplitColor] = useState("#60A5FA");
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const handleSaveLane = () => {
    onUpdateLane(lane.id, title, description, lane.color);
    setIsEditing(false);
  };

  const handleAddCard = () => {
    if (newCardTitle.trim()) {
      // Ensure content is never empty to avoid default template
      const cardContent = newCardContent.trim() || " ";
      onAddCard(lane.id, newCardTitle, cardContent, lane.cards?.length ?? 0);
      setNewCardTitle("");
      setNewCardContent("");
      setIsAddingCard(false);
    }
  };

  const [isMobile, setIsMobile] = useState(window.innerWidth < 640);
  useEffect(() => {
    const onResize = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const laneColors = [
    "#F87171",
    "#FBBF24",
    "#34D399",
    "#60A5FA",
    "#A78BFA",
    "#F472B6",
  ];

  return (
    <div
      className={`rounded-lg p-3 w-full sm:min-w-[260px] flex-shrink-0 sm:max-h-full flex flex-col border-2 ${
        lane.template_lane_id ? "split-lane" : ""
      }`}
      style={{
        borderColor: lane.color || "#E5E7EB",
        backgroundColor: "#FAFAFA",
        // Add a subtle left border to indicate split lanes
        ...(lane.template_lane_id && {
          borderLeft: `4px solid ${lane.color || "#E5E7EB"}`,
          boxShadow: "0 0 5px rgba(0,0,0,0.1)",
        }),
      }}
      data-lane-group={lane.template_lane_id || lane.id} // Add data attribute for lane grouping
    >
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
        <div
          className="flex justify-between items-center mb-3 px-2 py-1 rounded cursor-pointer"
          style={{ backgroundColor: lane.color || "#E5E7EB" }}
          onDoubleClick={() => setIsEditing(true)}
        >
          <div className="flex-1">
            <h3 className="font-bold text-white">{lane.title}</h3>
            {lane.description && (
              <p className="text-xs text-white opacity-90">
                {lane.description}
              </p>
            )}
          </div>
          <div className="flex space-x-1 items-center">
            <button
              onClick={() => setCollapsed(!collapsed)}
              className="text-white hover:text-gray-200"
              title={collapsed ? "Expand lane" : "Collapse lane"}
            >
              {collapsed ? <CaretRight size={16} /> : <CaretDown size={16} />}
            </button>
            <div
              {...dragHandleProps}
              className="cursor-grab"
              onClick={(e) => e.stopPropagation()}
            >
              <DotsSixVertical size={16} />
            </div>
            {/* Custom Color Picker */}
            <div className="relative">
              <button
                className="w-6 h-6 rounded-full border-2 border-white shadow"
                style={{ backgroundColor: laneColor }}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowColorPicker(!showColorPicker);
                }}
                title="Change lane color"
              />
              {showColorPicker && (
                <div className="absolute right-0 mt-2 w-40 bg-white border rounded shadow p-2 z-50">
                  <input
                    type="text"
                    value={laneColor}
                    onChange={(e) => setLaneColor(e.target.value)}
                    onBlur={() => {
                      onUpdateLane(lane.id, title, description, laneColor);
                      setShowColorPicker(false);
                    }}
                    className="w-full mb-2 p-1 border rounded text-xs"
                  />
                  <div className="grid grid-cols-6 gap-1">
                    {laneColors.map((c) => (
                      <button
                        key={c}
                        className={`w-6 h-6 rounded-full border ${
                          laneColor === c ? "border-black" : "border-gray-300"
                        }`}
                        style={{ backgroundColor: c }}
                        onClick={() => {
                          setLaneColor(c);
                          onUpdateLane(lane.id, title, description, c);
                          setShowColorPicker(false);
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => {
                setSplitTitle("");
                setSplitColor(laneColors[0]);
                setIsSplittingLane(true);
              }}
              className="text-gray-500 hover:text-blue-500"
              title={isMobile ? "Split Vertically" : "Split Horizontally"}
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

      {/* Split Lane Preview */}
      {isSplittingLane && (
        <div
          className={`flex ${isMobile ? "flex-col" : "flex-row"} gap-2 mb-3`}
        >
          {/* Original half */}
          <div className="flex-1 p-2 bg-gray-50 rounded border">
            {(() => {
              // Calculate split position based on selected card or default to middle
              let splitPosition = Math.floor((lane.cards?.length ?? 0) / 2);

              if (selectedCardId) {
                const selectedCardIndex =
                  lane.cards?.findIndex((c) => c.id === selectedCardId) ?? -1;
                if (selectedCardIndex >= 0) {
                  splitPosition = selectedCardIndex;
                }
              }

              return (lane.cards?.slice(0, splitPosition) || []).map((card) => (
                <div
                  key={card.id}
                  className={`bg-white p-1 mb-1 rounded shadow text-xs ${
                    card.id === selectedCardId ? "border-2 border-blue-500" : ""
                  }`}
                >
                  {(card.fields?.title as string) || "Untitled"}
                </div>
              ));
            })()}
          </div>
          {/* New half (form) */}
          <div className="flex-1 p-2 bg-white rounded border shadow space-y-2">
            <input
              type="text"
              value={splitTitle}
              onChange={(e) => setSplitTitle(e.target.value)}
              className="w-full p-1 border border-gray-300 rounded"
              placeholder="New lane title"
            />
            <select
              value={splitColor}
              onChange={(e) => setSplitColor(e.target.value)}
              className="w-full p-1 border border-gray-300 rounded"
            >
              <option value="#34D399">Green</option>
              <option value="#FBBF24">Yellow</option>
              <option value="#F87171">Red</option>
              <option value="#60A5FA">Blue</option>
              <option value="#A78BFA">Purple</option>
              <option value="#F472B6">Pink</option>
            </select>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setIsSplittingLane(false)}
                className="text-red-500 hover:text-red-700"
                title="Cancel"
              >
                ✖
              </button>
              <button
                onClick={() => {
                  // Get the selected card index if any card is selected
                  let splitIndex = Math.floor((lane.cards?.length ?? 0) / 2); // Default to middle

                  // If a card is selected, use its position as the split point
                  if (selectedCardId) {
                    const selectedCardIndex =
                      lane.cards?.findIndex((c) => c.id === selectedCardId) ??
                      -1;
                    if (selectedCardIndex >= 0) {
                      splitIndex = selectedCardIndex;
                    }
                  }

                  // Use empty string for description to avoid null issues
                  onSplitLane(lane.id, splitTitle, "", splitIndex, splitColor);
                  setIsSplittingLane(false);
                  setSelectedCardId(null); // Clear selection after split
                }}
                className="text-green-600 hover:text-green-800"
                title="Confirm"
              >
                ✔
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cards / Collapsed Content */}
      {!collapsed ? (
        <>
          {/* @ts-ignore */}
          <Droppable droppableId={lane.id} type="card">
            {/* @ts-ignore */}
            {(droppableProvided, droppableSnapshot) => (
              <div
                className={`flex-1 space-y-2 min-h-[50px] transition-colors duration-200 ${
                  droppableSnapshot.isDraggingOver
                    ? "bg-blue-50 rounded border-2 border-dashed border-blue-300"
                    : ""
                }`}
                ref={droppableProvided.innerRef}
                {...droppableProvided.droppableProps}
              >
                {lane.cards?.map((card, idx) => (
                  /* @ts-ignore */
                  <Draggable key={card.id} draggableId={card.id} index={idx}>
                    {/* @ts-ignore */}
                    {(draggableProvided, draggableSnapshot) => (
                      <div
                        ref={draggableProvided.innerRef}
                        {...draggableProvided.draggableProps}
                        {...draggableProvided.dragHandleProps}
                        className="bg-white rounded shadow"
                      >
                        <Card
                          card={card}
                          onUpdate={onUpdateCard}
                          onDelete={onDeleteCard}
                          onSelect={(cardId) =>
                            setSelectedCardId(
                              cardId === selectedCardId ? null : cardId
                            )
                          }
                          isSelected={selectedCardId === card.id}
                        />
                      </div>
                    )}
                  </Draggable>
                ))}
                {/* Always render placeholder even for empty lanes */}
                {droppableProvided.placeholder as any}
                {/* Empty state for droppable area */}
                {(!lane.cards || lane.cards.length === 0) && (
                  <div className="h-12 border-2 border-dashed border-gray-300 rounded flex items-center justify-center text-gray-400 text-sm">
                    Drop cards here
                  </div>
                )}
              </div>
            )}
          </Droppable>

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
        </>
      ) : (
        <div className="text-center text-sm text-gray-600 py-2">
          {lane.cards?.length ?? 0} cards
        </div>
      )}
    </div>
  );
};

export default Lane;
