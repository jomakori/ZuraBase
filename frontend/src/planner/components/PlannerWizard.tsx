import React, { useState } from "react";
import { PlannerTemplate } from "../types";
import { Dialog, Transition } from "@headlessui/react";
import { Fragment } from "react";

interface PlannerWizardProps {
  open: boolean;
  setOpen: (open: boolean) => void;
  templates: PlannerTemplate[];
  onCreatePlanner: (
    templateId: string,
    title: string,
    description: string
  ) => void;
  onCancel: () => void;
}

const PlannerWizard: React.FC<PlannerWizardProps> = ({
  open,
  setOpen,
  templates,
  onCreatePlanner,
  onCancel,
}) => {
  const [selectedTemplate, setSelectedTemplate] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [step, setStep] = useState(1);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedTemplate && title) {
      onCreatePlanner(selectedTemplate, title, description);
      setOpen(false);
      // Reset form
      setSelectedTemplate(null);
      setTitle("");
      setDescription("");
      setStep(1);
    }
  };

  const handleCancel = () => {
    setOpen(false);
    onCancel();
    // Reset form
    setSelectedTemplate(null);
    setTitle("");
    setDescription("");
    setStep(1);
  };

  return (
    <Transition.Root show={open} as={Fragment}>
      <Dialog as="div" className="relative z-10" onClose={setOpen}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <div>
                  <div className="mt-3 text-center sm:mt-5">
                    <Dialog.Title
                      as="h3"
                      className="text-xl font-semibold leading-6 text-gray-900"
                    >
                      Create New Planner
                    </Dialog.Title>
                    <div className="mt-2">
                      <form onSubmit={handleSubmit}>
                        {step === 1 && (
                          <div className="space-y-4">
                            <div className="mt-4">
                              <label className="block text-gray-700 text-sm font-bold mb-2 text-left">
                                Title
                              </label>
                              <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                placeholder="Enter planner title"
                                required
                              />
                            </div>

                            <div className="mt-4">
                              <label className="block text-gray-700 text-sm font-bold mb-2 text-left">
                                Description
                              </label>
                              <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                placeholder="Enter planner description"
                                rows={3}
                              />
                            </div>

                            <div className="mt-6 flex justify-end space-x-2">
                              <button
                                type="button"
                                onClick={handleCancel}
                                className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                onClick={() => setStep(2)}
                                disabled={!title}
                                className={`font-bold py-2 px-4 rounded ${
                                  !title
                                    ? "bg-blue-300 cursor-not-allowed"
                                    : "bg-blue-500 hover:bg-blue-700 text-white"
                                }`}
                              >
                                Next
                              </button>
                            </div>
                          </div>
                        )}

                        {step === 2 && (
                          <div className="space-y-4">
                            <div className="mt-4">
                              <label className="block text-gray-700 text-sm font-bold mb-2 text-left">
                                Select Template
                              </label>
                              <div className="grid grid-cols-1 gap-4 mt-2">
                                {templates.map((template) => (
                                  <div
                                    key={template.id}
                                    className={`border p-4 rounded cursor-pointer text-left ${
                                      selectedTemplate === template.id
                                        ? "border-blue-500 bg-blue-50"
                                        : "border-gray-300 hover:border-blue-300"
                                    }`}
                                    onClick={() =>
                                      setSelectedTemplate(template.id)
                                    }
                                  >
                                    <h3 className="font-bold">
                                      {template.name}
                                    </h3>
                                    <p className="text-sm text-gray-600">
                                      {template.description}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="mt-6 flex justify-end space-x-2">
                              <button
                                type="button"
                                onClick={() => setStep(1)}
                                className="bg-gray-300 hover:bg-gray-400 text-gray-800 font-bold py-2 px-4 rounded"
                              >
                                Back
                              </button>
                              <button
                                type="submit"
                                disabled={!selectedTemplate}
                                className={`font-bold py-2 px-4 rounded ${
                                  !selectedTemplate
                                    ? "bg-blue-300 cursor-not-allowed"
                                    : "bg-blue-500 hover:bg-blue-700 text-white"
                                }`}
                              >
                                Create Planner
                              </button>
                            </div>
                          </div>
                        )}
                      </form>
                    </div>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
};

export default PlannerWizard;
