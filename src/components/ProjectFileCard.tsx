import React from 'react';
import { Code } from 'lucide-react';
import { Project } from '../types';

interface ProjectFileCardProps {
  project: Project;
  onOpen: () => void;
}

const ProjectFileCard: React.FC<ProjectFileCardProps> = ({ project, onOpen }) => {
  const formattedDate = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hour12: true,
  });

  return (
    <div className="my-4 p-4 bg-gray-100 dark:bg-gray-800/60 rounded-xl flex items-center justify-between">
      <div className="flex items-center gap-4 min-w-0">
        <div className="flex-shrink-0 bg-white dark:bg-gray-700/50 p-2 rounded-lg">
          <Code className="h-5 w-5 text-gray-600 dark:text-gray-300" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate" title={project.name}>
            {project.name}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{formattedDate}</p>
        </div>
      </div>
      <button
        onClick={onOpen}
        className="flex-shrink-0 px-4 py-2 bg-white text-gray-800 text-sm font-semibold rounded-lg hover:bg-gray-50 border border-gray-300 dark:border-gray-500 shadow-sm transition-colors dark:bg-gray-200 dark:text-black dark:hover:bg-gray-300"
        data-tooltip-text="Open in Code Interpreter"
        data-tooltip-position="top"
      >
        Open
      </button>
    </div>
  );
};

export default ProjectFileCard;