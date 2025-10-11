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
        // In a real API, we’d use /api/user/notes, /api/user/planners, etc.
        // Here, mock with demo data
        // Clear out demo placeholders; we only show message if empty
        setItems([]);
      } catch (err) {
        console.error(err);
        setError("Failed to load user content.");
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
        <h1 className="text-3xl font-bold mb-4">
          Welcome back, {user.name.split(" ")[0]}!
        </h1>

        {error && (
          <div className="bg-red-100 border border-red-300 text-red-800 p-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map((item) => (
            <a
              key={item.id}
              href={`/${item.type}?id=${item.id}`}
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
                <h3 className="text-lg font-semibold mb-1">{item.title}</h3>
                <p className="text-sm text-gray-500 capitalize">
                  {item.type} •{" "}
                  {new Date(item.updatedAt).toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
              </div>
            </a>
          ))}
        </div>

        {items.length === 0 && (
          <p className="text-gray-600 mt-6 text-center">
            No recent items to display.
          </p>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
