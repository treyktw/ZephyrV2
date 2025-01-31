'use client'

import React, { useState } from 'react';
import { Search, Plus, Sidebar, Layout, FileText, FolderTree, Settings, ChevronRight, GitGraph } from 'lucide-react';

const NoteInterface = () => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [graphView, setGraphView] = useState(false);

  return (
    <div className="h-screen w-full bg-gray-50 flex">
      {/* Left Sidebar - File Explorer */}
      {sidebarOpen && (
        <div className="w-64 bg-white border-r flex flex-col">
          {/* Search and New Note */}
          <div className="p-4 border-b">
            <div className="flex items-center space-x-2 mb-4">
              <div className="flex-1 h-10 bg-gray-100 rounded-lg flex items-center px-3">
                <Search className="w-4 h-4 text-gray-400 mr-2"/>
                <span className="text-gray-400 text-sm">Search notes...</span>
              </div>
              <button className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
                <Plus className="w-4 h-4 text-gray-600"/>
              </button>
            </div>

            {/* Quick Filters */}
            <div className="flex space-x-2">
              <div className="px-3 py-1 bg-gray-100 rounded text-sm">All Notes</div>
              <div className="px-3 py-1 bg-gray-100 rounded text-sm">Recent</div>
              <div className="px-3 py-1 bg-gray-100 rounded text-sm">Favorites</div>
            </div>
          </div>

          {/* Folder Structure */}
          <div className="flex-1 overflow-auto p-4">
            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <ChevronRight className="w-4 h-4"/>
                <FolderTree className="w-4 h-4"/>
                <span>University</span>
              </div>
              <div className="ml-6 space-y-2">
                <div className="flex items-center space-x-2">
                  <FileText className="w-4 h-4"/>
                  <span>Mathematics</span>
                </div>
                <div className="flex items-center space-x-2">
                  <FileText className="w-4 h-4"/>
                  <span>Physics</span>
                </div>
              </div>
              {/* More folders */}
              <div className="h-8 bg-gray-100 rounded"/>
              <div className="h-8 bg-gray-100 rounded"/>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col">
        {/* Top Toolbar */}
        <div className="h-12 bg-white border-b flex items-center justify-between px-4">
          <div className="flex items-center space-x-2">
            <button onClick={() => setSidebarOpen(!sidebarOpen)}>
              <Sidebar className="w-5 h-5"/>
            </button>
            <div className="h-8 w-40 bg-gray-100 rounded"/>
          </div>
          <div className="flex items-center space-x-4">
            <button onClick={() => setGraphView(!graphView)}>
              <GitGraph className="w-5 h-5"/>
            </button>
            <Layout className="w-5 h-5"/>
            <Settings className="w-5 h-5"/>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex">
          {/* Note Editor */}
          <div className="flex-1 p-8 overflow-auto">
            {/* Title */}
            <div className="mb-8">
              <div className="h-12 bg-gray-100 rounded mb-2 w-2/3"/>
              <div className="flex space-x-2">
                <div className="px-3 py-1 bg-gray-100 rounded text-sm">Mathematics</div>
                <div className="px-3 py-1 bg-gray-100 rounded text-sm">Notes</div>
              </div>
            </div>

            {/* Block-based Content */}
            <div className="space-y-4 max-w-3xl">
              {/* Text Block */}
              <div className="h-24 bg-gray-100 rounded"/>

              {/* Math Block */}
              <div className="h-16 bg-gray-100 rounded border-l-4 border-blue-300"/>

              {/* Code Block */}
              <div className="h-32 bg-gray-100 rounded border-l-4 border-green-300"/>

              {/* Image/Diagram Block */}
              <div className="h-64 bg-gray-100 rounded"/>

              {/* Embedded Content Block */}
              <div className="h-40 bg-gray-100 rounded border border-dashed"/>
            </div>
          </div>

          {/* Graph View / Relations Panel */}
          {graphView && (
            <div className="w-80 border-l bg-white p-4">
              {/* Graph Visualization */}
              <div className="h-64 bg-gray-100 rounded mb-4"/>

              {/* Connected Notes */}
              <h3 className="font-semibold mb-2">Connected Notes</h3>
              <div className="space-y-2">
                <div className="h-12 bg-gray-100 rounded"/>
                <div className="h-12 bg-gray-100 rounded"/>
                <div className="h-12 bg-gray-100 rounded"/>
              </div>

              {/* References */}
              <h3 className="font-semibold mb-2 mt-4">References</h3>
              <div className="space-y-2">
                <div className="h-12 bg-gray-100 rounded"/>
                <div className="h-12 bg-gray-100 rounded"/>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default NoteInterface;
