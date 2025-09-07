import { useState, useRef, useCallback, useEffect } from "react";

/**
 * A custom hook that provides save functionality for both Notes and Planner apps
 *
 * @param initialId - The initial ID from URL or null if creating new
 * @param saveFunction - The function to call to save the entity
 * @param content - The content to be saved
 * @param hasUnsavedChanges - Whether there are unsaved changes
 * @returns Save-related state and functions
 */
export function useSaveHandler(
  initialId: string | null,
  saveFunction: (id: string | null, data: any) => Promise<any>,
  content: any,
  hasUnsavedChanges: boolean
) {
  const [queryParamID, setQueryParamID] = useState<string | null>(initialId);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [showSharingModal, setShowSharingModal] = useState(false);

  // Track if we've already shown the initial save modal
  // This is stored in a ref to persist across renders but not trigger re-renders
  const hasShownInitialSaveModalRef = useRef<boolean>(false);

  // Store the latest content in a ref to ensure we always use the most up-to-date version
  const contentRef = useRef(content);

  // Store the last saved content to compare and avoid unnecessary saves
  const lastSavedContentRef = useRef<any>(null);

  // Update the content ref whenever content changes
  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  // Clean up timeout on unmount
  useEffect(() => {
    return () => {
      // No timeouts to clean up in this implementation
    };
  }, []);

  // Function to check if content has actually changed
  const hasContentChanged = useCallback(() => {
    if (!lastSavedContentRef.current) return true;

    try {
      // Deep comparison of content
      return (
        JSON.stringify(lastSavedContentRef.current) !==
        JSON.stringify(contentRef.current)
      );
    } catch (e) {
      // If comparison fails (e.g., circular references), assume content has changed
      console.warn("Content comparison failed, assuming content changed:", e);
      return true;
    }
  }, []);

  const saveDocument = useCallback(
    async (force = false) => {
      // Only save if there are unsaved changes or force is true
      if (!force && !hasUnsavedChanges) {
        console.log("No unsaved changes, skipping save");
        return null;
      }

      // Check if content has actually changed
      if (!force && !hasContentChanged()) {
        console.log("Content hasn't changed, skipping save");
        return null;
      }

      // Always use the latest content from the ref - defined outside try/catch so it's accessible in catch block
      const currentContent = contentRef.current;

      try {
        setIsSaving(true);
        const isInitialSave = !queryParamID;

        // Determine if this is a note or planner based on content structure
        const isNote = currentContent && "text" in currentContent;
        const entityType = isNote ? "NOTE" : "PLANNER";

        console.log(`[API] [${entityType}] Saving document`, {
          id: queryParamID,
          content: currentContent,
        });

        // Send request to save the document
        const response = await saveFunction(queryParamID, currentContent);

        // Only update URL and state if we got a valid response
        if (response && response.id) {
          // Update the URL and component state
          const url = new URL(window.location.href);
          url.searchParams.set("id", response.id);
          window.history.pushState(null, "", url.toString());
          setQueryParamID(response.id);
        }

        // Update lastSaved timestamp to trigger UI updates
        setLastSaved(new Date());

        // Store the saved content for future comparison
        lastSavedContentRef.current = JSON.parse(
          JSON.stringify(currentContent)
        );

        // Only show the sharing modal on the initial save and if we haven't shown it before
        // Also make sure we have a valid response before showing the modal
        if (
          isInitialSave &&
          !hasShownInitialSaveModalRef.current &&
          response &&
          response.id
        ) {
          setShowSharingModal(true);
          hasShownInitialSaveModalRef.current = true;
        }

        return response;
      } catch (err) {
        console.error("Error saving document:", err);

        // Check if this is a temporary document (starts with temp-)
        if (queryParamID && queryParamID.toString().startsWith("temp-")) {
          console.log("Using temporary document, ignoring save error");
          // Return the current content as a mock response to prevent errors
          return {
            id: queryParamID,
            ...currentContent,
          };
        }

        throw err;
      } finally {
        setIsSaving(false);
      }
    },
    [queryParamID, hasUnsavedChanges, hasContentChanged, saveFunction]
  );

  return {
    queryParamID,
    setQueryParamID,
    isSaving,
    lastSaved,
    showSharingModal,
    setShowSharingModal,
    saveDocument,
  };
}
