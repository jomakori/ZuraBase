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
            <img
              src="/ZuraBase.png"
              alt="Home"
              className="h-8 w-auto mr-4 object-contain"
            />
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
      className="flex items-center border border-gray-300 rounded-full px-4 py-2 bg-white text-gray-700 font-medium shadow-sm hover:shadow-md transition focus:outline-none"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 48 48"
        className="w-5 h-5 mr-2"
      >
        <path
          fill="#EA4335"
          d="M24 9.5c3.15 0 5.32 1.36 6.54 2.5l4.8-4.8C32.01 4.9 28.29 3 24 3 14.95 3 7.4 8.98 4.54 17.12l5.96 4.63C11.55 15.45 17.25 9.5 24 9.5z"
        />
        <path
          fill="#34A853"
          d="M46.1 24.5c0-1.59-.14-3.07-.39-4.5H24v9h12.5c-.57 2.9-2.29 5.37-4.88 7.06l7.5 5.82C43.34 38.03 46.1 31.8 46.1 24.5z"
        />
        <path
          fill="#4A90E2"
          d="M10.5 29.25A14.4 14.4 0 0 1 9.5 24c0-1.82.33-3.57.91-5.25l-5.96-4.63A23.9 23.9 0 0 0 2 24c0 3.91.94 7.6 2.58 10.88l5.92-4.63z"
        />
        <path
          fill="#FBBC05"
          d="M24 46c6.29 0 11.56-2.09 15.41-5.68l-7.5-5.82c-2.08 1.39-4.74 2.2-7.91 2.2-6.75 0-12.45-5.95-13.5-13.25l-5.96 4.63C7.4 39.02 14.95 46 24 46z"
        />
      </svg>
      <span>Sign in with Google</span>
    </button>
  );
};

export default NavBar;
