import React, { useEffect, useState } from "react";
import NavBar from "./NavBar";
import { useAuth } from "../auth/AuthContext";
import { getNote } from "../notes/api";
import { getTemplates, getPlanner } from "../planner/api";

interface DashboardItem {
  id: string;
  title: string;
  type: "note" | "planner";
  updatedAt: string;
  coverUrl?: string;
}

const Dashboard: React.FC = () => {
  const { user, loading } = useAuth();
  const [items, setItems] = useState<DashboardItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || !user) return;

    const fetchUserContent = async () => {
      try {
        setError(null);

        const base = import.meta.env.API_ENDPOINT || "/api";

        // Include user filtering to prevent data leaks
        // Use only known fields on the user object to identify ownership
        const userId =
          (user as any)?.id ||
          (user as any)?.uid ||
          (user as any)?.email ||
          (user as any)?.name;

        // Fetch notes belonging to the signed-in user only
        // Fallback to backend endpoints that exist, removing query params if unsupported
        const notesUrl = `${base}/notes?user_id=${encodeURIComponent(userId)}`;
        const notesResp = await fetch(notesUrl, {
          headers: { Accept: "application/json" },
          credentials: "include",
        });
        let notes: DashboardItem[] = [];
        if (notesResp.ok) {
          const contentType = notesResp.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
            throw new SyntaxError("Invalid JSON response for notes");
          }
          const data = await notesResp.json();
          // Defensive safeguard for potential null API response
          notes = (data || [])
            .filter((n: any) => n.user_id === userId)
            .map((n: any) => ({
              id: n.id,
              title: n.title || "Untitled Note",
              type: "note" as const,
              updatedAt: n.updated_at || new Date().toISOString(),
              coverUrl: n.cover_url,
            }));
        }

        // Fetch planners belonging to the signed-in user only
        const plannersUrl = `${base}/planner/list?user_id=${encodeURIComponent(
          userId
        )}`;
        const plannersResp = await fetch(plannersUrl, {
          headers: { Accept: "application/json" },
          credentials: "include",
        });
        let planners: DashboardItem[] = [];
        if (plannersResp.ok) {
          const contentType = plannersResp.headers.get("content-type");
          if (!contentType || !contentType.includes("application/json")) {
            throw new SyntaxError("Invalid JSON response for planners");
          }
          const data = await plannersResp.json();
          // Defensive safeguard for potential null API response
          planners = (data || [])
            .filter((p: any) => p.user_id === userId)
            .map((p: any) => ({
              id: p.id,
              title: p.title || "Untitled Planner",
              type: "planner" as const,
              updatedAt: p.updated_at || new Date().toISOString(),
            }));
        }

        // Merge and sort user-owned items
        const combined = [...notes, ...planners].sort(
          (a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
        );

        setItems(combined);
      } catch (err) {
        console.error("[Dashboard] Error loading user content", err);

        if (err instanceof SyntaxError) {
          setError(
            "Received invalid response from API. Ensure backend endpoints return JSON and you're authenticated."
          );
          console.error(
            "[Dashboard] Possible HTML response (server returned redirect or error page instead of JSON)"
          );
        } else {
          setError("Failed to load user content.");
        }
      }
    };

    fetchUserContent();
  }, [user, loading]);

  if (loading) return <div className="p-8 text-center">Loading...</div>;
  if (!user)
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-semibold">Sign in required</h2>
        <p className="text-gray-600 mt-2">
          Please sign in with your Google account to view your dashboard.
        </p>
      </div>
    );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        {error && (
          <div className="bg-red-100 border border-red-300 text-red-800 p-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => (
            <a
              key={item.id}
              href={`/${
                item.type === "note"
                  ? `notes/${item.id}`
                  : `${item.type}/${item.id}`
              }`}
              className="bg-white rounded-lg shadow hover:shadow-md transition overflow-hidden"
            >
              {item.coverUrl && (
                <img
                  src={item.coverUrl}
                  alt={item.title}
                  className="w-full h-40 object-cover"
                />
              )}
              <div className="p-4">
                <h3 className="text-lg font-semibold mb-1">
                  {item.title && item.title.trim().length > 0
                    ? item.title
                    : "Untitled Note"}
                </h3>
                <div className="text-sm text-gray-500 space-y-0.5">
                  <p className="capitalize">{item.type}</p>
                  <p>{`Created on ${new Date(item.updatedAt).toLocaleDateString(
                    undefined,
                    { month: "short", day: "numeric", year: "numeric" }
                  )}`}</p>
                  <p className="italic">
                    {`Updated ${(() => {
                      const now = new Date();
                      const updated = new Date(item.updatedAt);
                      const diffMs = now.getTime() - updated.getTime();
                      const diffMins = Math.floor(diffMs / 60000);
                      if (diffMins < 1) return "just now";
                      if (diffMins < 60)
                        return `${diffMins} minute${
                          diffMins !== 1 ? "s" : ""
                        } ago`;
                      const diffHours = Math.floor(diffMins / 60);
                      if (diffHours < 24)
                        return `${diffHours} hour${
                          diffHours !== 1 ? "s" : ""
                        } ago`;
                      const diffDays = Math.floor(diffHours / 24);
                      return `${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
                    })()}`}
                  </p>
                </div>
              </div>
            </a>
          ))}
        </div>

        {items.length === 0 && (
          <p className="text-gray-600 mt-6 text-center">
            No saved items.
            <br /> Get started above!
          </p>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
// Ensure there’s only one export default
