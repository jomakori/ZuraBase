import { useState, useEffect, useCallback } from "react";
import { StrandsApi } from "./api";
import { Strand, StrandRequest, StrandQueryParams } from "./types";

/**
 * Custom hooks for the Strands module
 */

/**
 * Hook to fetch all strands
 * @param params Query parameters for filtering and pagination
 * @returns Query result with strands data
 */
export const useStrands = (params?: StrandQueryParams) => {
  const [strands, setStrands] = useState<Strand[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [count, setCount] = useState<number>(0);

  useEffect(() => {
    const fetchStrands = async () => {
      try {
        setLoading(true);
        const response = await StrandsApi.getStrands(params);
        setStrands(response.strands || []);
        setCount(response.count || 0);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    };

    // run once on mount
    fetchStrands();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { strands, loading, error, count };
};

/**
 * Hook to fetch a single strand by ID
 * @param id The ID of the strand to fetch
 * @returns Query result with strand data
 */
export const useStrand = (id: string) => {
  const [strand, setStrand] = useState<Strand | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }

    const fetchStrand = async () => {
      try {
        setLoading(true);
        const response = await StrandsApi.getStrand(id);
        setStrand(response.strand || null);
        setError(null);
      } catch (err) {
        console.error(`Error fetching strand ${id}:`, err);
        setError(err instanceof Error ? err : new Error(String(err)));

        // Add retry logic with exponential backoff
        const retryFetch = (retryCount = 0, maxRetries = 3) => {
          if (retryCount >= maxRetries) {
            console.error(
              `Max retries (${maxRetries}) reached for strand ${id}`
            );
            return;
          }

          const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff: 1s, 2s, 4s
          console.log(
            `Retrying fetch for strand ${id} in ${delay}ms (attempt ${
              retryCount + 1
            }/${maxRetries})`
          );

          setTimeout(async () => {
            try {
              const retryResponse = await StrandsApi.getStrand(id);
              setStrand(retryResponse.strand || null);
              setError(null);
              setLoading(false);
            } catch (retryErr) {
              console.error(
                `Retry ${retryCount + 1} failed for strand ${id}:`,
                retryErr
              );
              retryFetch(retryCount + 1, maxRetries);
            }
          }, delay);
        };

        // Start retry process
        retryFetch();
      } finally {
        setLoading(false);
      }
    };

    // Only fetch if we have a valid ID
    if (id) {
      fetchStrand();
    }
  }, [id]);

  return { strand, loading, error };
};

/**
 * Hook to create a new strand
 * @returns Mutation functions and state for creating a strand
 */
export const useCreateStrand = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [createdStrand, setCreatedStrand] = useState<Strand | null>(null);

  const createStrand = useCallback(async (strandRequest: StrandRequest) => {
    setLoading(true);
    setError(null);
    try {
      const response = await StrandsApi.createStrand(strandRequest);
      setCreatedStrand(response.strand || null);

      // Provide feedback about AI sync status
      const strand = response.strand;
      if (strand && !strand.synced_with_ai) {
        console.info("Strand created successfully but pending AI enrichment");
      }

      return response;
    } catch (err) {
      const normalizedError =
        err instanceof Error ? err : new Error(String(err));
      console.error("Strand creation failed:", normalizedError);
      setError(normalizedError);

      // More informative error message
      alert(
        "Your strand was not saved. Please try again or contact support if the problem persists."
      );
      return Promise.reject(normalizedError);
    } finally {
      setLoading(false);
    }
  }, []);

  return { createStrand, loading, error, createdStrand };
};

/**
 * Hook to update an existing strand
 * @returns Mutation functions and state for updating a strand
 */
export const useUpdateStrand = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [updatedStrand, setUpdatedStrand] = useState<Strand | null>(null);
  const [retryCount, setRetryCount] = useState<number>(0);
  const maxRetries = 3;

  const updateStrand = useCallback(
    async (id: string, strandRequest: StrandRequest) => {
      try {
        setLoading(true);
        const response = await StrandsApi.updateStrand(id, strandRequest);
        setUpdatedStrand(response.strand || null);
        setError(null);
        setRetryCount(0); // Reset retry count on success
        return response;
      } catch (err) {
        const normalizedError =
          err instanceof Error ? err : new Error(String(err));
        console.error(`Error updating strand ${id}:`, normalizedError);
        setError(normalizedError);

        // Check if it's a network error or connection refused
        const isNetworkError =
          normalizedError.message.includes("Failed to fetch") ||
          normalizedError.message.includes("net::ERR_CONNECTION_REFUSED");

        // If we have network errors and haven't exceeded max retries
        if (isNetworkError && retryCount < maxRetries) {
          const nextRetryCount = retryCount + 1;
          setRetryCount(nextRetryCount);

          const delay = Math.pow(2, retryCount) * 1000; // Exponential backoff
          console.log(
            `Network error detected. Retrying in ${delay}ms (attempt ${nextRetryCount}/${maxRetries})`
          );

          // Return a promise that will resolve after the retry
          return new Promise((resolve, reject) => {
            setTimeout(async () => {
              try {
                // Try to verify if the strand was actually saved despite the error
                const verifyResponse = await StrandsApi.getStrand(id);
                if (verifyResponse.strand) {
                  // If the strand exists and has updated content, consider it a success
                  const savedStrand = verifyResponse.strand;
                  if (savedStrand.content === strandRequest.content) {
                    console.log(
                      `Strand ${id} was actually saved successfully despite network error`
                    );
                    setUpdatedStrand(savedStrand);
                    setError(null);
                    resolve({ strand: savedStrand });
                    return;
                  }
                }

                // If verification failed or content doesn't match, retry the update
                const retryResponse = await StrandsApi.updateStrand(
                  id,
                  strandRequest
                );
                setUpdatedStrand(retryResponse.strand || null);
                setError(null);
                resolve(retryResponse);
              } catch (retryErr) {
                console.error(`Retry ${nextRetryCount} failed:`, retryErr);
                if (nextRetryCount >= maxRetries) {
                  reject(retryErr);
                } else {
                  // Let the user know something is happening but don't reject yet
                  console.log("Still trying to save your changes...");
                }
              } finally {
                setLoading(false);
              }
            }, delay);
          });
        }

        // If it's not a network error or we've exceeded retries, propagate the error
        throw normalizedError;
      } finally {
        if (retryCount >= maxRetries || !error) {
          setLoading(false);
        }
      }
    },
    [retryCount, error]
  );

  return { updateStrand, loading, error, updatedStrand };
};

/**
 * Hook to delete a strand
 * @returns Mutation functions and state for deleting a strand
 */
export const useDeleteStrand = () => {
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const [success, setSuccess] = useState<boolean>(false);

  const deleteStrand = useCallback(async (id: string) => {
    try {
      setLoading(true);
      await StrandsApi.deleteStrand(id);
      setSuccess(true);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setSuccess(false);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return { deleteStrand, loading, error, success };
};

/**
 * Hook to fetch all tags
 * @returns Query result with tags data
 */
export const useTags = () => {
  const [tags, setTags] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchTags = async () => {
      try {
        setLoading(true);
        const tagsData = await StrandsApi.getTags();
        setTags(tagsData || []);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    };

    fetchTags();
  }, []);

  return { tags, loading, error };
};
