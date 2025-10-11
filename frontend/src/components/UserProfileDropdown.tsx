import React, { useState } from "react";
import { CaretDown, SignOut } from "@phosphor-icons/react";
import { useAuth } from "../auth/AuthContext";

const UserProfileDropdown: React.FC = () => {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center space-x-2 rounded-full bg-gray-100 px-3 py-1 hover:bg-gray-200 focus:outline-none"
      >
        <img
          src={user.picture}
          alt="Profile"
          className="w-8 h-8 rounded-full border border-gray-300"
        />
        <span className="font-medium text-gray-800 hidden sm:inline">
          {user.name.split(" ")[0]}
        </span>
        <CaretDown size={16} />
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-48 rounded-md bg-white shadow-lg border border-gray-100">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-sm font-medium text-gray-900">{user.name}</p>
            <p className="text-xs text-gray-500 truncate">{user.email}</p>
          </div>
          <button
            onClick={logout}
            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
          >
            <SignOut size={16} className="mr-2" /> Logout
          </button>
        </div>
      )}
    </div>
  );
};

export default UserProfileDropdown;
