import React from "react";
import { NotePencil, ListChecks, Sparkle } from "@phosphor-icons/react";
import Dashboard from "./Dashboard";
import { Link } from "react-router-dom";

/**
 * HomePage component that displays the main landing page with feature cards
 */
const HomePage: React.FC = () => {
  return (
    <>
      <main>
        <div className="mx-auto max-w-7xl py-12 sm:px-6 lg:px-8">
          <div className="px-4 py-6 sm:px-0">
            <h2 className="text-2xl font-semibold text-gray-900 mb-8">
              Create
            </h2>

            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
                    <Link
                      to="/notes"
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      Open Notes
                    </Link>
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
                    <Link
                      to="/planner"
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                    >
                      Open Planner
                    </Link>
                  </div>
                </div>
              </div>

              {/* Strands Card */}
              <div className="bg-white overflow-hidden shadow rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <div className="flex items-center">
                    <div className="flex-shrink-0 bg-purple-500 rounded-md p-3">
                      <Sparkle size={24} weight="bold" className="text-white" />
                    </div>
                    <div className="ml-5">
                      <h3 className="text-lg leading-6 font-medium text-gray-900">
                        Strands
                      </h3>
                      <p className="mt-2 text-sm text-gray-500">
                        Capture and organize scattered insights from WhatsApp,
                        images, or text snippets into smart, interconnected
                        knowledge entries.
                      </p>
                    </div>
                  </div>
                  <div className="mt-6">
                    <Link
                      to="/strands"
                      className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500"
                    >
                      Open Strands
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Dashboard Elements Below */}
      <section className="border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto py-8 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-semibold text-gray-900 mb-4">
            Dashboard
          </h2>
          <Dashboard />
        </div>
      </section>
    </>
  );
};

export default HomePage;
