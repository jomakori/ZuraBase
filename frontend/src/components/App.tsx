import React from "react";
import { NotePencil, ListChecks } from "@phosphor-icons/react";
import NavBar from "./NavBar";

/**
 * Main App component that serves as a landing page for the application.
 * It allows users to choose between the Notes and Planner features.
 */
function App() {
  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar currentPage="home" />

      <main>
        <div className="mx-auto max-w-7xl py-12 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <h2 className="text-2xl font-semibold text-gray-900 mb-8">
              Choose an application
            </h2>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              {/* Notes Card */}
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-blue-500 rounded-md p-3">
                      <NotePencil
                        size={24}
                        weight="bold"
                        className="text-white"
                      />
                    </div>
                    <div className="ml-5">
                      <h3 className="text-lg leading-6 font-medium text-gray-900">
                        Notes
                      </h3>
                      <p className="mt-2 text-sm text-gray-500">
                        Create and manage your markdown notes with ease. Add
                        cover images, format with markdown, and share with
                        others.
                      </p>
                    </div>
                  </div>
                  <div className="mt-6">
                    <a
                      href="/notes"
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Open Notes
                    </a>
                  </div>
                </div>
              </div>

              {/* Planner Card */}
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-green-500 rounded-md p-3">
                      <ListChecks
                        size={24}
                        weight="bold"
                        className="text-white"
                      />
                    </div>
                    <div className="ml-5">
                      <h3 className="text-lg leading-6 font-medium text-gray-900">
                        Planner
                      </h3>
                      <p className="mt-2 text-sm text-gray-500">
                        Organize your work with customizable boards. Choose from
                        templates like Scrum, Kanban, or Personal to get started
                        quickly.
                      </p>
                    </div>
                  </div>
                  <div className="mt-6">
                    <a
                      href="/planner"
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      Open Planner
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

export default App;
