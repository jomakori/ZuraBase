import React, { useState } from "react";
import { PlannerCard } from "../types";
import { Pencil, Trash, DotsSixVertical } from "@phosphor-icons/react";
import { MilkdownProvider } from "@milkdown/react";
import MarkdownEditor from "../../components/MarkdownEditor";

interface CardProps {
  card: PlannerCard;
  onUpdate: (cardId: string, title: string, content: string) => void;
  onDelete: (cardId: string) => void;
  dragHandleProps?: any;
}

const Card: React.FC<CardProps> = ({
  card,
  onUpdate,
  onDelete,
  dragHandleProps,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(card.title);
  const [content, setContent] = useState(card.content);

  const handleSave = () => {
    onUpdate(card.id, title, content);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setTitle(card.title);
    setContent(card.content);
    setIsEditing(false);
  };

  // Render markdown content
  const renderMarkdown = () => {
    return (
      <div
        className="prose prose-sm max-w-none"
        dangerouslySetInnerHTML={{ __html: card.content }}
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
    <div className="bg-white p-3 rounded shadow mb-2 hover:shadow-md transition-shadow duration-200">
      <div className="flex justify-between items-start">
        <h3 className="font-medium text-gray-900">{card.title}</h3>
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
            onClick={() => onDelete(card.id)}
            className="text-gray-500 hover:text-red-500"
          >
            <Trash size={16} />
          </button>
        </div>
      </div>
      <div className="mt-2 text-sm text-gray-700">{renderMarkdown()}</div>
    </div>
  );
};

export default Card;
