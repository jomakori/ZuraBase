import React from "react";
import "../index.css";

/**
 * A visually appealing splash screen that animates the favicon with a smooth spin.
 * The icon is centered responsively, scales across devices,
 * and uses clean minimal styling consistent with the rest of the app.
 */
const LoadingSplash: React.FC = () => {
  return (
    <div className="flex items-center justify-center h-screen w-screen bg-gray-50 select-none">
      <div className="flex flex-col items-center justify-center space-y-6">
        <img
          src="/favicon.ico"
          alt="Loading..."
          className="w-24 h-24 animate-spin-slow drop-shadow-lg"
        />
      </div>
    </div>
  );
};

export default LoadingSplash;
