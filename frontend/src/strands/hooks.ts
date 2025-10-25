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

    fetchStrands();
  }, [params]);

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
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        setLoading(false);
      }
    };

    fetchStrand();
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
    try {
      setLoading(true);
      const response = await StrandsApi.createStrand(strandRequest);
      setCreatedStrand(response.strand || null);
      setError(null);
      return response;
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      throw err;
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

  const updateStrand = useCallback(
    async (id: string, strandRequest: StrandRequest) => {
      try {
        setLoading(true);
        const response = await StrandsApi.updateStrand(id, strandRequest);
        setUpdatedStrand(response.strand || null);
        setError(null);
        return response;
      } catch (err) {
        setError(err instanceof Error ? err : new Error(String(err)));
        throw err;
      } finally {
        setLoading(false);
      }
    },
    []
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
