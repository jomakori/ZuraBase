import { useEffect, useState, useRef, useCallback } from "react";
import NavBar from "../components/NavBar";
import { MilkdownProvider } from "@milkdown/react";
import { FloppyDisk, Image } from "@phosphor-icons/react";
import { getNote, saveNote } from "./api";
import { Note } from "./types";
import { v4 as uuidv4 } from "uuid";
import CoverSelector from "../components/CoverSelector";
import MarkdownEditor from "../components/MarkdownEditor";
import SharingModal from "../components/SharingModal";
import { useSaveHandler } from "../utils/saveUtils";

interface NotesAppProps {
  onInit?: () => void;
}

function NotesApp({ onInit }: NotesAppProps) {
  // Get ID from URL query parameter
  const initialId = (() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("id");
  })();

  const [isLoading, setIsLoading] = useState(true);
  const [coverImage, setCoverImage] = useState("");
  const [content, setContent] = useState<string>(() => {
    // Use default content if creating a new note, otherwise fetch will set content
    if (!initialId) {
      return `
# Markdown Meeting Notes

- *Date:* ${new Date().toLocaleDateString()}
- *Note taker:* Simon Johansson
- *Attendees:* Marcus, Johan, Erik

---

Write your notes in **markdown** to make pretty meeting notes.
After saving the document you will get a link that you can share.

`;
    }
    return ""; // Content will be fetched in useEffect
  });
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showCoverSelector, setShowCoverSelector] = useState(false);

  // Track the save state for UI display
  const [saveState, setSaveState] = useState<"unsaved" | "saving" | "saved">(
    "saved"
  );

  // Use the modular save handler
  const saveNoteWrapper = async (id: string | null, data: any) => {
    const noteId = id || uuidv4();
    console.log("[NOTES] Saving note", { id: noteId });
    return saveNote({
      text: data.text,
      cover_url: data.cover_url,
      id: noteId,
    });
  };

  // Create a memoized content object that updates when content or coverImage changes
  const noteContent = { text: content, cover_url: coverImage };

  const {
    queryParamID,
    isSaving,
    lastSaved,
    showSharingModal,
    setShowSharingModal,
    saveDocument,
  } = useSaveHandler(
    initialId,
    saveNoteWrapper,
    noteContent,
    hasUnsavedChanges
  );

  // Track content changes to set unsaved changes flag and trigger auto-save
  const lastChangeTimeRef = useRef<number>(0);
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Function to schedule auto-save
  const scheduleAutoSave = useCallback(() => {
    // Clear any existing timer
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    // Only schedule auto-save if we have an ID (not first save)
    if (queryParamID && hasUnsavedChanges) {
      // Set a timer for auto-save
      autoSaveTimerRef.current = setTimeout(() => {
        console.log("[NOTES] Auto-saving due to content change");
        saveDocument();
        autoSaveTimerRef.current = null;
      }, 2000); // Auto-save after 2 seconds of no changes
    }
  }, [queryParamID, hasUnsavedChanges, saveDocument]);

  // Track content changes
  useEffect(() => {
    if (!content) return;

    // Set unsaved changes flag
    setHasUnsavedChanges(true);
    setSaveState("unsaved");

    // Record the time of this change
    lastChangeTimeRef.current = Date.now();

    // Schedule auto-save
    scheduleAutoSave();

    // Clean up function
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [content, coverImage, scheduleAutoSave]);

  useEffect(() => {
    const fetchNote = async () => {
      // If we do not have an id then we are creating a new note, nothing needs to be fetched
      if (!queryParamID) {
        setIsLoading(false);
        if (onInit) onInit();
        return;
      }
      try {
        // Fetch the note from the backend
        const response = await getNote(queryParamID);
        setCoverImage(response.cover_url || "");
        setContent(response.text || "");
      } catch (err) {
        console.error(err);
      }
      setIsLoading(false);
      if (onInit) onInit();
    };
    fetchNote();
  }, [queryParamID, onInit]);

  // Handle save button click
  const handleSave = async () => {
    try {
      setSaveState("saving");
      await saveDocument();
      setHasUnsavedChanges(false);
      setSaveState("saved");
    } catch (err) {
      console.error(err);
      setSaveState("unsaved");
    }
  };

  // Update save state when relevant states change
  useEffect(() => {
    if (isSaving) {
      setSaveState("saving");
    } else if (hasUnsavedChanges) {
      setSaveState("unsaved");
    } else if (lastSaved) {
      setSaveState("saved");

      // Show a brief visual confirmation that save was successful
      const saveConfirmation = document.querySelector(".save-button");
      if (saveConfirmation) {
        saveConfirmation.classList.add("save-success-flash");
        setTimeout(() => {
          saveConfirmation.classList.remove("save-success-flash");
        }, 1000);
      }
    }
  }, [isSaving, hasUnsavedChanges, lastSaved]);

  return (
    <div className="min-h-full">
      <NavBar currentPage="notes" />
      <div
        className={` pb-32 ${coverImage ? "" : "border-b-2 border-dashed"}`}
        style={{
          backgroundImage: `url(${coverImage})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <header className="relative py-10">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" />

          <button
            className="absolute bottom-0 right-5 flex items-center space-x-1 rounded border border-black border-opacity-50 bg-white px-2 py-0.5 opacity-70 transition-opacity duration-200 hover:opacity-100 xl:-bottom-28"
            onClick={() => setShowCoverSelector(true)}
          >
            <Image size={20} />{" "}
            <span>{coverImage ? "Change" : "Add"} cover</span>
          </button>
        </header>
      </div>

      <main className="-mt-20 h-full">
        <div className="mx-auto h-full max-w-4xl rounded-none pb-12 xl:rounded-sm">
          <div className="prose h-full w-full max-w-none rounded-none border border-black border-opacity-10 xl:rounded-sm">
            <CoverSelector
              open={showCoverSelector}
              setOpen={setShowCoverSelector}
              setCoverImage={setCoverImage}
            />
            {isLoading ? (
              <span>Loading...</span>
            ) : (
              <MilkdownProvider>
                <MarkdownEditor content={content} setContent={setContent} />
              </MilkdownProvider>
            )}
          </div>
        </div>
      </main>

      <div className="fixed bottom-5 right-5 flex items-center space-x-4">
        <button
          onClick={handleSave}
          disabled={saveState === "saving" || saveState === "saved"}
          className={`save-button flex items-center space-x-2 rounded px-3 py-2 text-sm font-medium ${
            saveState === "unsaved"
              ? "bg-blue-600 text-white hover:bg-blue-700 cursor-pointer"
              : saveState === "saving"
              ? "bg-yellow-500 text-white cursor-wait"
              : "bg-green-500 text-white cursor-default opacity-75"
          } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors duration-300`}
        >
          <FloppyDisk size={16} />
          <span>
            {saveState === "saving"
              ? "Saving..."
              : saveState === "unsaved"
              ? "Save"
              : "Saved"}
          </span>
        </button>
      </div>

      <SharingModal open={showSharingModal} setOpen={setShowSharingModal} />
    </div>
  );
}

export default NotesApp;
