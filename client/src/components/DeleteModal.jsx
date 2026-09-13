import React from 'react';
import { Trash2 } from 'lucide-react';

const DeleteModal = ({ isOpen, onClose, onConfirm }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 overflow-y-auto h-full w-full z-50 flex items-center justify-center p-4">
      <div className="relative bg-white dark:bg-gray-900 rounded-xl shadow-2xl w-full max-w-sm p-6 text-center">
        <Trash2 size={32} className="text-red-500 mx-auto mb-4" />
        <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Confirm Deletion
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
          Are you sure you want to permanently delete this book?
        </p>
        <div className="flex justify-center space-x-4">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800 transition duration-150"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg shadow-sm text-white bg-red-600 hover:bg-red-700 transition duration-150"
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
};

export default DeleteModal;
