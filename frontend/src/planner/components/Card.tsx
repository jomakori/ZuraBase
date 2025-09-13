import React, { useState } from "react";
import { PlannerCard } from "../types";
import {
  Pencil,
  Trash,
  DotsSixVertical,
  CaretDown,
  CaretRight,
} from "@phosphor-icons/react";
import { MilkdownProvider } from "@milkdown/react";
import MarkdownEditor from "../../components/MarkdownEditor";
import { Draggable } from "@hello-pangea/dnd";

interface CardProps {
  card: PlannerCard;
  onUpdate: (cardId: string, title: string, content: string) => void;
  onDelete: (cardId: string) => void;
  dragHandleProps?: React.HTMLAttributes<HTMLDivElement>;
}

const Card: React.FC<CardProps> = ({
  card,
  onUpdate,
  onDelete,
  dragHandleProps,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isFolded, setIsFolded] = useState(true); // New state for folding
  const [title, setTitle] = useState(card.fields?.title || "");
  const [content, setContent] = useState(card.fields?.content || "");

  const handleSave = () => {
    onUpdate(card.id, title, content);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTitle(card.fields?.title || "");
    setContent(card.fields?.content || "");
    setIsEditing(false);
  };

  // Render markdown content
  const renderMarkdown = () => {
    return (
      <div
        className="prose prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: card.fields?.content || "" }}
      />
    );
  };

  if (isEditing) {
    return (
      <div className="bg-white p-3 rounded shadow mb-2 border border-blue-300">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="w-full mb-2 p-1 border border-gray-300 rounded"
          placeholder="Card title"
        />
        <div className="mb-2 border border-gray-200 rounded">
          <MilkdownProvider>
            <MarkdownEditor content={content} setContent={setContent} />
          </MilkdownProvider>
        </div>
        <div className="flex justify-end space-x-2">
          <button
            onClick={handleCancel}
            className="px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            className="px-2 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Save
          </button>
        </div>
      </div>
    );
  }

  return (
    /* @ts-ignore */
    <Draggable draggableId={card.id} index={0}>
      {/* @ts-ignore */}
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          className="bg-white p-3 rounded shadow mb-2 hover:shadow-md transition-shadow duration-200 transition-transform ease-in-out"
        >
          <div className="flex justify-between items-start">
            <div className="flex items-center">
              <button
                onClick={() => setIsFolded(!isFolded)}
                className="text-gray-500 hover:text-gray-700 mr-2"
                aria-expanded={!isFolded}
              >
                {isFolded ? <CaretRight size={16} /> : <CaretDown size={16} />}
              </button>
              <h3 className="font-medium text-gray-900">
                {card.fields?.title || "Untitled"}
              </h3>
            </div>
            <div className="flex space-x-1">
              <div {...provided.dragHandleProps} className="cursor-grab">
                <DotsSixVertical size={16} />
              </div>
              <button
                onClick={() => setIsEditing(true)}
                className="text-gray-500 hover:text-blue-500"
              >
                <Pencil size={16} />
              </button>
              <button
                onClick={() => onDelete(card.id)}
                className="text-gray-500 hover:text-red-500"
              >
                <Trash size={16} />
              </button>
            </div>
          </div>
          {!isFolded && (
            <div className="mt-2 text-sm text-gray-700">{renderMarkdown()}</div>
          )}
        </div>
      )}
    </Draggable>
  );
};

export default Card;
