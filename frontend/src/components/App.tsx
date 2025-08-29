import { useEffect, useState, useCallback, useRef } from "react";
import { MilkdownProvider } from "@milkdown/react";
import { FloppyDisk, Image } from "@phosphor-icons/react";
import { getNote, saveNote, Note } from "../client";
import { v4 as uuidv4 } from "uuid";
import CoverSelector from "./CoverSelector";
import MarkdownEditor from "./MarkdownEditor";
import SharingModal from "./SharingModal";

/**
 * Returns the request client for either the local or staging environment.
 * If we are running the frontend locally (dev mode) we assume that our backend is also running locally
 * and make requests to that, otherwise we use the staging client.
 */

interface AppProps {
  onInit?: () => void;
}

function App({ onInit }: AppProps) {

  const [queryParamID, setQueryParamID] = useState<string | null>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get("id");
  });

  const [isLoading, setIsLoading] = useState(true);
  const [coverImage, setCoverImage] = useState("");
  const [content, setContent] = useState<string>(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const id = urlParams.get("id");
    // Use default content if creating a new note, otherwise fetch will set content
    if (!id) {
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
 const autosaveTimeout = useRef<NodeJS.Timeout | null>(null);
// Autosave: call saveDocument after user stops typing for 1 second

useEffect(() => {
  if (!content) return;
  if (autosaveTimeout.current) clearTimeout(autosaveTimeout.current);
  autosaveTimeout.current = setTimeout(() => {
    saveDocument();
  }, 1000); // 1 second debounce
  return () => {
    if (autosaveTimeout.current) clearTimeout(autosaveTimeout.current);
  };
}, [content]);

  const [showCoverSelector, setShowCoverSelector] = useState(false);
  const [showSharingModal, setShowSharingModal] = useState(false);

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
  }, [queryParamID]);

  const saveDocument = useCallback(async () => {
    try {
      const isInitialSave = !queryParamID;
      const noteId = queryParamID || uuidv4();
      console.log("[API] Saving note", { id: noteId, cover_url: coverImage });
      // Send POST request to the backend for saving the note
      const response = await saveNote({
        text: content,
        cover_url: coverImage,
        id: noteId,
      });

      // Update the URL and component state
      const url = new URL(window.location.href);
      url.searchParams.set("id", response.id);
      window.history.pushState(null, "", url.toString());
      setQueryParamID(response.id); // Update the component state with the new ID

      // Only show the sharing modal on the initial save
      if (isInitialSave) {
        setShowSharingModal(true);
      }
    } catch (err) {
      console.error(err);
    }
  }, [content, coverImage, queryParamID]);

  return (
    <div className="min-h-full">
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
        <div className="flex items-center space-x-2 rounded bg-gray-200 px-2 py-1 text-lg text-gray-700 cursor-default select-none">
          <FloppyDisk size={20} /> <span>Autosaved</span>
        </div>
      </div>

      <SharingModal open={showSharingModal} setOpen={setShowSharingModal} />
    </div>
  );
}

export default App;
