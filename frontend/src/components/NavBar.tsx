import React from "react";
import { NotePencil, ListChecks, House } from "@phosphor-icons/react";

interface NavBarProps {
  currentPage: "home" | "notes" | "planner";
  isAuthenticated?: boolean;
}

import { useAuth } from "../auth/AuthContext";
import UserProfileDropdown from "./UserProfileDropdown";

const NavBar: React.FC<NavBarProps> = ({ currentPage }) => {
  return (
    <div className="bg-white shadow">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center">
          <div className="flex items-center">
            <h1 className="text-2xl font-bold text-gray-900 mr-8">ZuraBase</h1>
            <nav className="flex space-x-4">
              <a
                href="/"
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium ${
                  currentPage === "home"
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}
              >
                <House size={20} className="mr-1" />
                Home
              </a>
              <a
                href="/notes"
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium ${
                  currentPage === "notes"
                    ? "bg-blue-100 text-blue-900"
                    : "text-gray-600 hover:bg-blue-50 hover:text-blue-900"
                }`}
              >
                <NotePencil size={20} className="mr-1" />
                Notes
              </a>
              <a
                href="/planner"
                className={`flex items-center px-3 py-2 rounded-md text-sm font-medium ${
                  currentPage === "planner"
                    ? "bg-green-100 text-green-900"
                    : "text-gray-600 hover:bg-green-50 hover:text-green-900"
                }`}
              >
                <ListChecks size={20} className="mr-1" />
                Planner
              </a>
            </nav>
          </div>
          <div>
            <NavAuthSection />
          </div>
        </div>
      </div>
    </div>
  );
};

const NavAuthSection: React.FC = () => {
  const { user, login, loading } = useAuth();

  if (loading) return null;
  if (user) return <UserProfileDropdown />;
  return (
    <button
      onClick={login}
      className="px-4 py-2 bg-blue-600 text-white rounded-md font-medium hover:bg-blue-700 focus:outline-none"
    >
      Sign in with Google
    </button>
  );
};

export default NavBar;
